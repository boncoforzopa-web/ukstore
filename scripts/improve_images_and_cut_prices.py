#!/usr/bin/env python3
"""Replace/improve low-quality product images and cut all prices by 25%."""
from __future__ import annotations

import json
import re
import sys
import urllib.request
from concurrent.futures import ProcessPoolExecutor, as_completed, ThreadPoolExecutor
from pathlib import Path

from PIL import Image

ROOT = Path("/workspace")
RAW = Path("/tmp/christmas-palace/raw")
SHOPIFY = Path("/tmp/christmas-palace/shopify/catalog.json")
OUT_IMAGES = ROOT / "public" / "images"
WIDTHS = [160, 320, 480, 640, 800, 1000, 1600]
QUALITY = 92  # was 82 on original import
WORKERS = 8
SHORT_SIDE_BAD = 480  # treat source short-side below this as low quality
PRICE_FACTOR = 0.75


def norm(s: str) -> str:
    s = (s or "").lower()
    s = s.replace("’", "").replace("'", "").replace('"', "").replace("“", "").replace("”", "")
    s = s.replace("&", " and ").replace("#", " ").replace(":", "")
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def encode_one(args):
    """Resize source image path to WebP variants. args: (src_path_or_bytes_path, dest_dir, base, is_temp)"""
    src, dest_dir, base = args
    dest_dir = Path(dest_dir)
    dest_dir.mkdir(parents=True, exist_ok=True)
    im = Image.open(src)
    if im.mode in ("P", "RGBA"):
        bg = Image.new("RGB", im.size, (255, 255, 255))
        rgba = im.convert("RGBA")
        bg.paste(rgba, mask=rgba.split()[-1])
        im = bg
    else:
        im = im.convert("RGB")
    w0, h0 = im.size
    made = []
    for w in WIDTHS:
        if w > w0:
            continue
        if w == w0:
            out = im
            ww, hh = w0, h0
        else:
            hh = max(1, round(h0 * (w / w0)))
            out = im.resize((w, hh), Image.Resampling.LANCZOS)
            ww, hh = w, hh
        out_path = dest_dir / f"{base}-{ww}.webp"
        out.save(out_path, "WEBP", quality=QUALITY, method=6)
        made.append(ww)
    if not made:
        out_path = dest_dir / f"{base}-{w0}.webp"
        im.save(out_path, "WEBP", quality=QUALITY, method=6)
        made = [w0]
    # remove stale larger widths from previous encode if source shrank (rare)
    for old in dest_dir.glob(f"{base}-*.webp"):
        try:
            ow = int(old.stem.rsplit("-", 1)[-1])
        except ValueError:
            continue
        if ow not in made:
            old.unlink(missing_ok=True)
    return str(src), w0, h0, made


def shopify_full_url(src: str) -> str:
    # Prefer large CDN asset; strip width param and request large
    u = src.split("?")[0]
    if "cdn.shopify.com" in u:
        return u + "?width=2000"
    return src


def download(url: str, dest: Path) -> bool:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "ukstore-image-improve/1.0"})
        with urllib.request.urlopen(req, timeout=60) as r:
            data = r.read()
        if len(data) < 500:
            return False
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        return True
    except Exception as e:
        print(f"  download fail {url}: {e}", file=sys.stderr)
        return False


def short_side(w: int, h: int) -> int:
    return min(w, h)


def collect_raw():
    files = []
    for p in RAW.rglob("*"):
        if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}:
            files.append(p)
    return files


def stem_index(name: str):
    m = re.match(r"^(.*)_(\d{2})\.(jpe?g|png|webp)$", name, re.I)
    if not m:
        return None
    return m.group(1), int(m.group(2))


def map_raw_to_products(products, raw_files):
    """Best-effort: assign raw zip files to product indexes by title stem (longest match)."""
    indexes_by_norm = {}
    for i, p in enumerate(products):
        indexes_by_norm.setdefault(norm(p["title"]), []).append(i)
    assigned = {i: [] for i in range(len(products))}
    for img in raw_files:
        parsed = stem_index(img.name)
        if not parsed:
            continue
        stem, index = parsed
        n_stem = norm(stem)
        cand = list(indexes_by_norm.get(n_stem) or [])
        if not cand:
            best_nk, best_len = None, 0
            for nk in indexes_by_norm:
                if n_stem.startswith(nk + " ") and len(nk) > best_len:
                    best_nk, best_len = nk, len(nk)
            if best_nk:
                cand = list(indexes_by_norm[best_nk])
        if not cand:
            continue
        # prefer product still needing images / with fewest so far among same title
        cand.sort(key=lambda i: (len(assigned[i]), i))
        assigned[cand[0]].append({"path": img, "index": index})
    for lst in assigned.values():
        lst.sort(key=lambda x: (x["index"], str(x["path"])))
    return assigned


def main():
    products = json.loads((ROOT / "data" / "products.json").read_text())
    manifest = json.loads((ROOT / "data" / "image-manifest.json").read_text())
    shopify = json.loads(SHOPIFY.read_text())
    shop_by_norm = {}
    for p in shopify:
        shop_by_norm.setdefault(norm(p["title"]), []).append(p)

    # --- identify bad local images ---
    bad_keys = set()
    for key, meta in manifest.items():
        if short_side(meta["width"], meta["height"]) < SHORT_SIDE_BAD:
            bad_keys.add(key)
            continue
        handle, fname = key.split("/", 1)
        base_name = Path(meta["base"]).name
        webps = list((OUT_IMAGES / handle).glob(f"{base_name}-*.webp"))
        if not webps:
            bad_keys.add(key)
            continue
        largest = max(webps, key=lambda p: p.stat().st_size)
        max_w = max(meta.get("widths") or [0])
        if largest.stat().st_size < 8000 and max_w >= 640:
            bad_keys.add(key)
        if largest.stat().st_size < 3000:
            bad_keys.add(key)

    print(f"Bad local image keys: {len(bad_keys)}")

    # products that need work
    need_replace = []  # (product_index, reason)
    for i, p in enumerate(products):
        locals_ = [im for im in p.get("images") or [] if im.get("local")]
        cdn_only = bool(p.get("images")) and not locals_ and any(im.get("src") for im in p["images"])
        no_images = not p.get("images")
        bad_local = False
        for im in locals_:
            key = str(im["local"]).replace("images/", "")
            if key in bad_keys:
                bad_local = True
                break
            # also check short side on image record
            if short_side(im.get("width") or 0, im.get("height") or 0) < SHORT_SIDE_BAD:
                bad_local = True
                break
        if bad_local:
            need_replace.append((i, "bad_local"))
        elif cdn_only:
            need_replace.append((i, "cdn_only"))
        elif no_images:
            need_replace.append((i, "no_images"))

    print(f"Products needing image work: {len(need_replace)}")
    from collections import Counter
    print(" reasons", Counter(r for _, r in need_replace))

    raw_files = collect_raw()
    raw_assigned = map_raw_to_products(products, raw_files)

    tmp_dl = Path("/tmp/christmas-palace/improved-src")
    tmp_dl.mkdir(parents=True, exist_ok=True)

    jobs = []
    plan = []  # (product_index, new_images_spec list of dicts with encode info)

    replaced_from_shopify = 0
    replaced_from_zip = 0
    reencoded_better = 0
    improved_products = set()

    def pick_shop(p):
        cands = shop_by_norm.get(norm(p["title"])) or []
        if not cands:
            return None
        # prefer candidate with largest first image
        def score(sp):
            imgs = sp.get("images") or []
            if not imgs:
                return -1
            return (imgs[0].get("width") or 0) * (imgs[0].get("height") or 0)

        cands = sorted(cands, key=score, reverse=True)
        return cands[0] if cands and score(cands[0]) > 0 else (cands[0] if cands else None)

    # Download / gather sources first (IO bound)
    sources_for_product = {}  # i -> list of local Path sources to encode

    def gather(i_reason):
        i, reason = i_reason
        p = products[i]
        handle = p["handle"]
        sources = []

        # 1) Prefer larger zip originals for this product if their short side is good
        zip_imgs = raw_assigned.get(i) or []
        good_zip = []
        for z in zip_imgs:
            try:
                with Image.open(z["path"]) as im:
                    w, h = im.size
            except Exception:
                continue
            if short_side(w, h) >= SHORT_SIDE_BAD:
                good_zip.append(z["path"])
        if good_zip:
            return i, reason, "zip", good_zip

        # 2) Shopify CDN full-res
        shop = pick_shop(p)
        if shop and shop.get("images"):
            paths = []
            for idx, im in enumerate(shop["images"][:8]):
                url = shopify_full_url(im["src"])
                ext = ".png" if ".png" in url.lower() else ".jpg"
                dest = tmp_dl / handle / f"{idx+1:02d}{ext}"
                if dest.exists() and dest.stat().st_size > 1000:
                    paths.append(dest)
                    continue
                if download(url, dest):
                    # verify dimensions
                    try:
                        with Image.open(dest) as im2:
                            w, h = im2.size
                        if short_side(w, h) < 200:
                            dest.unlink(missing_ok=True)
                            continue
                    except Exception:
                        dest.unlink(missing_ok=True)
                        continue
                    paths.append(dest)
            if paths:
                return i, reason, "shopify", paths

        # 3) Fall back: re-encode existing zip originals even if small, at higher quality
        if zip_imgs:
            return i, reason, "zip_small", [z["path"] for z in zip_imgs]

        # 4) Re-encode existing local sources from current webp largest? skip if nothing
        return i, reason, "none", []

    print("Gathering better source images…")
    gathered = []
    with ThreadPoolExecutor(max_workers=12) as ex:
        futs = [ex.submit(gather, item) for item in need_replace]
        for fut in as_completed(futs):
            gathered.append(fut.result())

    for i, reason, how, paths in gathered:
        if not paths:
            continue
        p = products[i]
        handle = p["handle"]
        dest_dir = OUT_IMAGES / handle
        # clear old webps for this product before rewrite
        if dest_dir.exists():
            for old in dest_dir.glob("*.webp"):
                old.unlink()
        # remove old manifest keys for this handle
        for k in list(manifest.keys()):
            if k.startswith(handle + "/"):
                del manifest[k]

        new_images = []
        for idx, src in enumerate(paths):
            base = f"{idx+1:02d}"
            ext = ".png" if Path(src).suffix.lower() == ".png" else ".jpg"
            jobs.append((str(src), str(dest_dir), base))
            plan.append((i, idx, str(src), handle, base, ext, how))
            new_images.append({"src": src, "base": base, "ext": ext})
        sources_for_product[i] = (how, new_images)
        improved_products.add(i)
        if how == "shopify":
            replaced_from_shopify += 1
        elif how == "zip":
            replaced_from_zip += 1
        else:
            reencoded_better += 1

    print(f"Encoding {len(jobs)} images for {len(improved_products)} products…")
    results = {}
    done = 0
    with ProcessPoolExecutor(max_workers=WORKERS) as ex:
        futs = {ex.submit(encode_one, job): job[0] for job in jobs}
        for fut in as_completed(futs):
            src, w0, h0, made = fut.result()
            # key by (src, dest) — same src unlikely; use job identity via plan later
            results.setdefault(src, []).append((w0, h0, made))
            done += 1
            if done % 40 == 0 or done == len(jobs):
                print(f"  {done}/{len(jobs)}")

    # Apply new image metadata onto products (consume results in plan order)
    used_src_count = {}
    for i, idx, src, handle, base, ext, how in plan:
        occ = used_src_count.get(src, 0)
        used_src_count[src] = occ + 1
        versions = results.get(src) or []
        if not versions:
            continue
        w0, h0, made = versions[min(occ, len(versions) - 1)]
        key = f"{handle}/{base}{ext}"
        manifest[key] = {
            "width": w0,
            "height": h0,
            "widths": made,
            "base": f"{handle}/{base}",
        }
        # build images list incrementally
        p = products[i]
        if idx == 0:
            p["images"] = []
        # ensure list long enough
        while len(p["images"]) <= idx:
            p["images"].append(None)
        p["images"][idx] = {
            "position": idx + 1,
            "src": "",
            "local": f"images/{key}",
            "alt": p["title"],
            "width": w0,
            "height": h0,
        }

    # compact None holes
    for i in improved_products:
        products[i]["images"] = [im for im in products[i]["images"] if im]

    # Also re-encode remaining "ok but soft" images? Skip — targeted only.
    # Additionally: bump quality for products whose featured webp is under 15KB at >=800px
    soft = []
    for i, p in enumerate(products):
        if i in improved_products:
            continue
        for im in p.get("images") or []:
            local = im.get("local")
            if not local:
                continue
            key = local.replace("images/", "")
            meta = manifest.get(key)
            if not meta:
                continue
            handle = p["handle"]
            base_name = Path(meta["base"]).name
            webps = list((OUT_IMAGES / handle).glob(f"{base_name}-*.webp"))
            if not webps:
                continue
            largest = max(webps, key=lambda x: x.stat().st_size)
            max_w = max(meta.get("widths") or [0])
            if max_w >= 800 and largest.stat().st_size < 15000:
                soft.append((i, key, meta))
                break
    print(f"Soft/overcompressed remaining products: {len(soft)}")

    # Re-encode soft from zip if available else skip
    soft_jobs = []
    soft_plan = []
    for i, key, meta in soft:
        zip_imgs = raw_assigned.get(i) or []
        if not zip_imgs:
            continue
        # match by index from key .../01.jpg
        base_name = Path(meta["base"]).name  # 01
        try:
            want = int(base_name)
        except ValueError:
            want = 1
        src = None
        for z in zip_imgs:
            if z["index"] == want:
                src = z["path"]
                break
        if src is None:
            src = zip_imgs[0]["path"]
        handle = products[i]["handle"]
        dest_dir = OUT_IMAGES / handle
        soft_jobs.append((str(src), str(dest_dir), base_name))
        soft_plan.append((i, key, str(src), handle, base_name, Path(key).suffix or ".jpg"))

    if soft_jobs:
        print(f"Re-encoding {len(soft_jobs)} soft images at q={QUALITY}…")
        with ProcessPoolExecutor(max_workers=WORKERS) as ex:
            futs = {ex.submit(encode_one, job): job for job in soft_jobs}
            for fut in as_completed(futs):
                src, w0, h0, made = fut.result()
                # find plan entry
                for i, key, psrc, handle, base, ext in soft_plan:
                    if psrc == src and Path(key).stem.startswith(base):
                        manifest[key] = {
                            "width": w0,
                            "height": h0,
                            "widths": made,
                            "base": f"{handle}/{base}",
                        }
                        for im in products[i]["images"]:
                            if im.get("local") == f"images/{key}":
                                im["width"] = w0
                                im["height"] = h0
                        improved_products.add(i)
                        reencoded_better += 1
                        break

    # --- price cut 25% ---
    price_updates = 0
    for p in products:
        for v in p.get("variants") or []:
            if v.get("price"):
                v["price"] = f"{round(float(v['price']) * PRICE_FACTOR * 100) / 100:.2f}"
                price_updates += 1
            if v.get("compare_at_price"):
                v["compare_at_price"] = f"{round(float(v['compare_at_price']) * PRICE_FACTOR * 100) / 100:.2f}"

    hires = [m["base"] for m in manifest.values() if 1600 in (m.get("widths") or [])]

    (ROOT / "data" / "products.json").write_text(json.dumps(products, indent=1) + "\n")
    (ROOT / "data" / "image-manifest.json").write_text(json.dumps(manifest) + "\n")
    (ROOT / "data" / "hires.json").write_text(json.dumps(hires) + "\n")

    # verify sample price
    sample = products[0]
    print("---")
    print(f"Improved products: {len(improved_products)}")
    print(f"  from better zip originals: {replaced_from_zip}")
    print(f"  from Shopify hi-res: {replaced_from_shopify}")
    print(f"  re-encoded higher quality: {reencoded_better}")
    print(f"Variant prices updated: {price_updates} (×{PRICE_FACTOR})")
    print(f"Sample {sample['title']} price now {sample['variants'][0]['price']}")
    print(f"Manifest entries: {len(manifest)} hires: {len(hires)}")


if __name__ == "__main__":
    main()
