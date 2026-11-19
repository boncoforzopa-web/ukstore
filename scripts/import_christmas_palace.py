#!/usr/bin/env python3
"""Import Christmas Palace CSV + zip images into ukstore with GBP prices."""
from __future__ import annotations

import csv
import json
import re
import sys
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

from PIL import Image

ROOT = Path("/workspace")
RAW = Path("/tmp/christmas-palace/raw")
CSV_DIR = Path("/tmp/christmas-palace/csv")
SHOPIFY = Path("/tmp/christmas-palace/shopify/catalog.json")
OUT_IMAGES = ROOT / "public" / "images"
USD_TO_GBP = 0.757596
WIDTHS = [160, 320, 480, 640, 800, 1000, 1600]
CREATED = "2026-11-18T00:00:00Z"
WORKERS = 8


def norm(s: str) -> str:
    s = (s or "").lower()
    s = s.replace("’", "").replace("'", "").replace('"', "").replace("“", "").replace("”", "")
    s = s.replace("&", " and ").replace("#", " ").replace(":", "")
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def slugify(s: str) -> str:
    s = (s or "").lower().replace("’", "").replace("'", "").replace("&", " and ")
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return (s[:80] or "product")


def gbp(usd) -> str | None:
    try:
        n = float(usd)
    except (TypeError, ValueError):
        return None
    if n <= 0:
        return None
    return f"{round(n * USD_TO_GBP * 100) / 100:.2f}"


def html_escape(s: str) -> str:
    return (s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def to_html(desc: str) -> str:
    t = (desc or "").strip()
    if not t:
        return ""
    if re.search(r"<[a-z][\s\S]*>", t, re.I):
        return t
    parts = re.split(r"\n\s*\n", t)
    return "".join(f"<p>{html_escape(p).replace(chr(10), '<br>')}</p>" for p in parts if p.strip())


def summary_from(desc: str) -> str:
    plain = re.sub(r"<[^>]+>", " ", desc or "")
    plain = re.sub(r"\s+", " ", plain).strip()
    if not plain:
        return ""
    if len(plain) <= 140:
        return plain
    cut = plain[:140]
    return re.sub(r"\s+\S*$", "", cut) + "…"


def parse_options(options_str: str) -> list[dict]:
    out = []
    for chunk in re.split(r"[\n;]", options_str or ""):
        m = re.match(r"^\s*([A-Za-z]+)\s*:\s*(.+)\s*$", chunk)
        if not m:
            continue
        name = m.group(1).capitalize()
        if name == "Color":
            name = "Colour"
        values = [v.strip() for v in m.group(2).split("|") if v.strip()]
        if values:
            out.append({"name": name, "values": values})
    return out


def collect_images() -> list[Path]:
    exts = {".jpg", ".jpeg", ".png", ".webp"}
    return [p for p in RAW.rglob("*") if p.suffix.lower() in exts]


def stem_and_index(name: str):
    m = re.match(r"^(.*)_(\d{2})\.(jpe?g|png|webp)$", name, re.I)
    if not m:
        return None
    return m.group(1), int(m.group(2)), m.group(3).lower()


def map_shopify(products: list[dict], shopify: list[dict]):
    """Attach a unique Shopify product to each CSV row (title, then title+price)."""
    by_norm: dict[str, list] = {}
    for p in shopify:
        by_norm.setdefault(norm(p["title"]), []).append(p)
    used_ids: set[int] = set()
    out = []
    for row in products:
        cands = list(by_norm.get(norm(row["Product_Name"])) or [])
        pick = None
        if len(cands) == 1 and cands[0]["id"] not in used_ids:
            pick = cands[0]
        else:
            try:
                price = float(row["Price"])
            except ValueError:
                price = None
            scored = []
            for p in cands:
                if p["id"] in used_ids:
                    continue
                prices = [float(v["price"]) for v in p.get("variants") or [] if v.get("price")]
                if not prices or price is None:
                    scored.append((999, p))
                    continue
                dist = min(abs(x - price) for x in prices)
                scored.append((dist, p))
            scored.sort(key=lambda x: x[0])
            if scored and scored[0][0] < 0.05:
                pick = scored[0][1]
            elif scored:
                pick = scored[0][1]
        if pick:
            used_ids.add(pick["id"])
        out.append(pick)
    return out


def map_images(products: list[dict], image_paths: list[Path]):
    """Assign each image file to at most one product row index (longest name match).

    When several CSV rows share a title, fill each row up to its Image_Count.
    """
    # groups of row indexes by normalized title, longest titles first for matching
    indexes_by_norm: dict[str, list[int]] = {}
    for i, p in enumerate(products):
        indexes_by_norm.setdefault(norm(p["Product_Name"]), []).append(i)

    capacity = []
    for p in products:
        try:
            cap = int(p.get("Image_Count") or 0)
        except ValueError:
            cap = 0
        capacity.append(max(cap, 1))

    assigned: dict[int, list[dict]] = {i: [] for i in range(len(products))}
    leftovers = []

    # Prefer exact stem matches before prefix matches; sort images for stability
    parsed_imgs = []
    for img in image_paths:
        parsed = stem_and_index(img.name)
        if not parsed:
            leftovers.append(img)
            continue
        stem, index, _ext = parsed
        parsed_imgs.append((norm(stem), index, stem, img))
    parsed_imgs.sort(key=lambda x: (x[0], x[1], str(x[3])))

    for n_stem, index, stem, img in parsed_imgs:
        # candidates: exact norm title, else longest prefix title
        cand_idxs = list(indexes_by_norm.get(n_stem) or [])
        if not cand_idxs:
            best_nk = None
            best_len = 0
            for nk in indexes_by_norm:
                if n_stem.startswith(nk + " ") and len(nk) > best_len:
                    best_nk, best_len = nk, len(nk)
            if best_nk:
                cand_idxs = list(indexes_by_norm[best_nk])
        if not cand_idxs:
            leftovers.append(img)
            continue
        # pick the candidate with the most remaining capacity
        cand_idxs.sort(key=lambda i: (len(assigned[i]) - capacity[i], i))
        pick = cand_idxs[0]
        assigned[pick].append({"path": img, "index": index, "stem": stem})

    for lst in assigned.values():
        lst.sort(key=lambda x: (x["index"], str(x["path"])))
    return assigned, leftovers

def process_one(args):
    src, dest_dir, base = args
    dest_dir = Path(dest_dir)
    dest_dir.mkdir(parents=True, exist_ok=True)
    im = Image.open(src)
    if im.mode in ("P", "RGBA"):
        # flatten onto white for consistent webp
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
        out.save(out_path, "WEBP", quality=82, method=4)
        made.append(ww)
    if not made:
        # source smaller than smallest width — emit native
        out_path = dest_dir / f"{base}-{w0}.webp"
        im.save(out_path, "WEBP", quality=82, method=4)
        made = [w0]
    return str(src), w0, h0, made


def product_type_and_collections(title: str, shopify_type: str | None, tags: list | None):
    t = f"{title} {shopify_type or ''} {' '.join(tags or [])}".lower()
    cols = {"christmas"}
    product_type = "Seasonal décor"

    def add(*hs):
        cols.update(hs)

    if re.search(r"halloween|jack o|pumpkin|witch|frankenstein|skeleton|spooky", t):
        cols.discard("christmas")
        add("halloween", "seasonal-collections")
        product_type = "Halloween"
    elif "valentine" in t:
        cols.discard("christmas")
        add("valentines-day", "seasonal-collections")
        product_type = "Valentine's Day"
    elif re.search(r"easter|bunny", t):
        cols.discard("christmas")
        add("easter", "seasonal-collections")
        product_type = "Easter"
    elif re.search(r"st\.?\s*patrick|shamrock", t):
        cols.discard("christmas")
        add("other-seasons", "seasonal-collections")
    elif re.search(r"harvest|autumn|thanksgiving", t):
        cols.discard("christmas")
        add("harvest-autumn", "seasonal-collections")
        product_type = "Harvest"

    if re.search(r"\btree\b", t) and not re.search(r"tree skirt|tree topper|tree stand|ornament", t):
        add("christmas-trees", "artificial-trees")
        product_type = "Artificial tree"
        if re.search(r"pre-?lit|led|lights", t):
            add("pre-lit-trees")
        if "unlit" in t:
            add("unlit-trees")
        if re.search(r"flock|snow", t):
            add("flocked-trees")
        if re.search(r"slim|pencil", t):
            add("slim-pencil-trees")
        if re.search(r"commercial|olympia|14'|16'|18'|20'|24'|30'|40'", t):
            add("commercial-trees")
        if re.search(r"potted|\bpot\b", t):
            add("potted-trees")
    elif "garland" in t:
        add("home-decor-greenery", "garlands", "tree-decorations", "tree-garlands")
        product_type = "Garland"
    elif "wreath" in t:
        add("home-decor-greenery", "wreaths")
        product_type = "Wreath"
    elif re.search(r"ornament|bauble|ball ornament", t):
        add("tree-decorations", "ornaments")
        product_type = "Ornament"
        if "shatterproof" in t:
            add("shatterproof-ornaments")
        if "glass" in t:
            add("glass-ornaments")
        if re.search(r"set|bundle", t):
            add("ornament-sets")
    elif "topper" in t:
        add("tree-decorations", "tree-toppers")
        product_type = "Tree topper"
    elif re.search(r"skirt|runner", t):
        add("tree-decorations", "tree-skirts-runners")
        product_type = "Tree skirt"
    elif re.search(r"ribbon|bow", t):
        add("tree-decorations", "ribbons-bows")
        product_type = "Ribbon"
    elif "santa" in t:
        add("oversized-displays", "santa-figures", "figurines", "home-decor-greenery")
        product_type = "Santa figure"
    elif re.search(r"reindeer|\bdeer\b", t):
        add("oversized-displays", "reindeer", "figurines", "home-decor-greenery")
        product_type = "Reindeer"
    elif "nutcracker" in t:
        add("oversized-displays", "nutcrackers")
        product_type = "Nutcracker"
    elif re.search(r"\belf\b|elves", t):
        add("oversized-displays", "elves")
        product_type = "Elf figure"
    elif "gingerbread" in t:
        add("oversized-displays", "gingerbread-figures")
        product_type = "Gingerbread figure"
    elif re.search(r"topiary|boxwood", t):
        add("home-decor-greenery", "topiary")
        product_type = "Topiary"
    elif re.search(r"light|led|rope light|sculpture|kinara|angel wings|\barch\b", t):
        add("christmas-lighting")
        product_type = "Lighting"
        if re.search(r"outdoor|commercial|\bft\b", t):
            add("outdoor-lighting", "oversized-displays", "light-sculptures", "commercial-displays")
        if re.search(r"string|twinkle", t):
            add("led-string-lights")
        if "battery" in t:
            add("battery-lights")
    elif re.search(r"figurine|nativity|polar bear|village", t):
        add("home-decor-greenery", "figurines", "tabletop-decor")
        product_type = "Figurine"
    elif re.search(r"bundle|set of|gift", t):
        add("bundles-gift-sets")
    else:
        add("home-decor-greenery", "decorative-accessories")

    if re.search(r"bundle|set of", t):
        add("bundles-gift-sets")

    return product_type, sorted(cols)


def attributes_from(title: str, options: list[dict]) -> dict:
    attrs = {}
    hm = re.search(r"(\d+(?:\.\d+)?)\s*(?:FT|ft|')\b", title or "")
    if hm:
        attrs["Height"] = f"{hm.group(1)}ft"
    if re.search(r"pre-?lit|led lights|micro led|rgbww", title or "", re.I):
        attrs["Lighting"] = "Unlit" if re.search(r"unlit", title or "", re.I) else "Pre-lit"
    elif re.search(r"unlit", title or "", re.I):
        attrs["Lighting"] = "Unlit"
    if re.search(r"flock|snow pine", title or "", re.I):
        attrs["Style"] = "Flocked"
    if re.search(r"outdoor|commercial|uv ", title or "", re.I):
        attrs["Use"] = "Outdoor"
    for o in options:
        if o["name"] == "Height" and len(o["values"]) == 1:
            attrs["Height"] = o["values"][0].replace("'", "ft")
        if o["name"] == "Colour" and len(o["values"]) == 1:
            v = o["values"][0]
            attrs["Colour"] = v.title() if v.isupper() else v
        if o["name"] == "Size" and len(o["values"]) == 1:
            attrs["Size"] = o["values"][0]
    return attrs


def unique_handles(products: list[dict]):
    seen: dict[str, int] = {}
    for p in products:
        h = p["handle"]
        if h not in seen:
            seen[h] = 1
            continue
        n = seen[h] + 1
        while f"{h}-{n}" in seen:
            n += 1
        seen[h] = n
        seen[f"{h}-{n}"] = 1
        p["handle"] = f"{h}-{n}"


def main():
    products_csv = list(
        csv.DictReader((CSV_DIR / "thechristmaspalace-com-products.csv").open(encoding="utf-8-sig"))
    )
    variants_csv = list(
        csv.DictReader((CSV_DIR / "thechristmaspalace-com-variants.csv").open(encoding="utf-8-sig"))
    )
    shopify = json.loads(SHOPIFY.read_text())
    shops = map_shopify(products_csv, shopify)

    variants_by_product: dict[str, list] = {}
    for v in variants_csv:
        variants_by_product.setdefault(v["Product_Name"], []).append(v)

    print(f"CSV products={len(products_csv)} variants={len(variants_csv)} shopify={len(shopify)}")
    image_paths = collect_images()
    print(f"Raw images={len(image_paths)}")
    assigned, leftovers = map_images(products_csv, image_paths)
    with_imgs = sum(1 for lst in assigned.values() if lst)
    print(f"Products with zip images={with_imgs} unmatched files={len(leftovers)}")

    # Build product shells first so image dirs use final unique handles.
    out_products = []
    pid = 2000
    vid = 200000
    for row_i, row in enumerate(products_csv):
        pid += 1
        title = row["Product_Name"]
        shop = shops[row_i]
        options = parse_options(row.get("Options") or "")
        product_type, collections = product_type_and_collections(
            title, (shop or {}).get("product_type"), (shop or {}).get("tags")
        )
        handle = slugify((shop or {}).get("handle") or title)
        desc = to_html(
            row.get("Description") or row.get("Original_Text") or (shop or {}).get("body_html") or ""
        )
        vendor = (shop or {}).get("vendor") or "The Christmas Sweet Shop"
        tags = []
        for tag in (shop or {}).get("tags") or []:
            if re.search(r"new", tag, re.I):
                tags.append("New")
            if re.search(r"sale|clearance", tag, re.I):
                tags.append("Sale")

        csv_vars = variants_by_product.get(title) or []
        variants = []

        if csv_vars:
            opt_names = []
            for key in ("HEIGHT", "SIZE", "COLOR", "WIDTH"):
                if any(v.get(key) for v in csv_vars):
                    opt_names.append("Colour" if key == "COLOR" else key.capitalize())
            if not options and opt_names:
                options = []
                for name in opt_names:
                    src_key = "COLOR" if name == "Colour" else name.upper()
                    values = []
                    for v in csv_vars:
                        if v.get(src_key) and v[src_key] not in values:
                            values.append(v[src_key])
                    options.append({"name": name, "values": values})
            for v in csv_vars:
                vid += 1
                opt_obj = {}
                for o in options:
                    src_key = "COLOR" if o["name"] == "Colour" else o["name"].upper()
                    if v.get(src_key):
                        opt_obj[o["name"]] = v[src_key]
                title_parts = list(opt_obj.values())
                price_usd = v.get("Price") or row.get("Price")
                shop_var = None
                if shop and shop.get("variants"):
                    for sv in shop["variants"]:
                        if norm(sv.get("title") or "") == norm(v.get("Variant") or "") or norm(
                            sv.get("option1") or ""
                        ) == norm(v.get("Variant") or ""):
                            shop_var = sv
                            break
                compare_usd = shop_var.get("compare_at_price") if shop_var else None
                variants.append(
                    {
                        "id": str(vid),
                        "title": " / ".join(title_parts) if title_parts else (v.get("Variant") or "Default Title"),
                        "sku": (shop_var or {}).get("sku") or "",
                        "price": gbp(price_usd),
                        "compare_at_price": gbp(compare_usd) if compare_usd else None,
                        "taxable": True,
                        "inventory_quantity": 25,
                        "inventory_tracked": True,
                        "inventory_policy": "DENY",
                        "requires_shipping": True,
                        "options": opt_obj or {"Title": "Default Title"},
                    }
                )
        elif shop and len(shop.get("variants") or []) > 1:
            options = [
                {"name": ("Colour" if o["name"] == "Color" else o["name"]), "values": o["values"]}
                for o in (shop.get("options") or [])
            ]
            for sv in shop["variants"]:
                vid += 1
                opt_obj = {}
                for i, o in enumerate(options):
                    val = sv.get(f"option{i + 1}")
                    if val:
                        opt_obj[o["name"]] = val
                variants.append(
                    {
                        "id": str(vid),
                        "title": sv.get("title") or "Default Title",
                        "sku": sv.get("sku") or "",
                        "price": gbp(sv.get("price")),
                        "compare_at_price": gbp(sv.get("compare_at_price")) if sv.get("compare_at_price") else None,
                        "taxable": True,
                        "inventory_quantity": 25 if sv.get("available") else 0,
                        "inventory_tracked": True,
                        "inventory_policy": "DENY",
                        "requires_shipping": True,
                        "options": opt_obj or {"Title": "Default Title"},
                    }
                )
        else:
            vid += 1
            shop_var = (shop or {}).get("variants", [None])[0]
            options = [{"name": "Title", "values": ["Default Title"]}]
            variants.append(
                {
                    "id": str(vid),
                    "title": "Default Title",
                    "sku": (shop_var or {}).get("sku") or "",
                    "price": gbp(row.get("Price") or (shop_var or {}).get("price")),
                    "compare_at_price": gbp(shop_var.get("compare_at_price"))
                    if shop_var and shop_var.get("compare_at_price")
                    else None,
                    "taxable": True,
                    "inventory_quantity": 25,
                    "inventory_tracked": True,
                    "inventory_policy": "DENY",
                    "requires_shipping": True,
                    "options": {"Title": "Default Title"},
                }
            )

        priced = [v for v in variants if v.get("price")]
        if not priced:
            print(f"Skipping {title}: no price", file=sys.stderr)
            continue
        if not options:
            options = [{"name": "Title", "values": ["Default Title"]}]

        out_products.append(
            {
                "id": str(pid),
                "handle": handle,
                "title": title,
                "status": "active",
                "vendor": vendor,
                "product_type": product_type,
                "tags": sorted(set(tags)),
                "summary": summary_from(row.get("Description") or row.get("Original_Text") or ""),
                "description_html": desc,
                "collections": collections,
                "attributes": attributes_from(title, options),
                "images": [],
                "options": options,
                "variants": priced,
                "created_at": CREATED,
                "published_at": CREATED,
                "updated_at": CREATED,
                "_shop": shop,
                "_row_i": row_i,
            }
        )

    unique_handles(out_products)

    jobs = []
    image_plan = []  # (product_index, idx, src, handle, base, ext)
    for pi, p in enumerate(out_products):
        zip_imgs = assigned.get(p["_row_i"]) or []
        if not zip_imgs:
            continue
        dest_dir = OUT_IMAGES / p["handle"]
        for idx, img in enumerate(zip_imgs):
            base = f"{idx + 1:02d}"
            ext = ".png" if img["path"].suffix.lower() == ".png" else ".jpg"
            jobs.append((str(img["path"]), str(dest_dir), base))
            image_plan.append((pi, idx, str(img["path"]), p["handle"], base, ext))

    print(f"Processing {len(jobs)} images with {WORKERS} workers…")
    OUT_IMAGES.mkdir(parents=True, exist_ok=True)
    results = {}
    done = 0
    with ProcessPoolExecutor(max_workers=WORKERS) as ex:
        futs = {ex.submit(process_one, job): job[0] for job in jobs}
        for fut in as_completed(futs):
            src, w0, h0, made = fut.result()
            results[src] = (w0, h0, made)
            done += 1
            if done % 50 == 0 or done == len(jobs):
                print(f"  {done}/{len(jobs)}")

    manifest = {}
    for pi, idx, src, handle, base, ext in image_plan:
        w0, h0, made = results[src]
        key = f"{handle}/{base}{ext}"
        manifest[key] = {
            "width": w0,
            "height": h0,
            "widths": made,
            "base": f"{handle}/{base}",
        }
        out_products[pi]["images"].append(
            {
                "position": idx + 1,
                "src": "",
                "local": f"images/{key}",
                "alt": out_products[pi]["title"],
                "width": w0,
                "height": h0,
            }
        )

    shopify_fallback = 0
    for p in out_products:
        shop = p.pop("_shop", None)
        p.pop("_row_i", None)
        if p["images"]:
            continue
        if shop and shop.get("images"):
            shopify_fallback += 1
            for i, im in enumerate(shop["images"]):
                p["images"].append(
                    {
                        "position": i + 1,
                        "src": im["src"],
                        "alt": p["title"],
                        "width": im.get("width") or 1200,
                        "height": im.get("height") or 1200,
                    }
                )

    (ROOT / "data" / "products.json").write_text(json.dumps(out_products, indent=1) + "\n")
    (ROOT / "data" / "image-manifest.json").write_text(json.dumps(manifest) + "\n")
    hires = [m["base"] for m in manifest.values() if 1600 in m["widths"]]
    (ROOT / "data" / "hires.json").write_text(json.dumps(hires) + "\n")

    with_local = sum(1 for p in out_products if any(i.get("local") for i in p["images"]))
    print(f"Wrote {len(out_products)} products")
    print(f"Manifest entries={len(manifest)} hires={len(hires)}")
    print(f"Products with local images={with_local} shopify CDN fallback={shopify_fallback}")
    print(f"FX USD→GBP={USD_TO_GBP}")


if __name__ == "__main__":
    main()
