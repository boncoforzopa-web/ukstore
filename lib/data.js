// Store data layer: builds Shopify-like objects (product, variant, collection, page, linklist…)
// from the exported JSON in /data. Everything the theme reads goes through here.
'use strict';
const fs = require('fs');
const path = require('path');
const { Drop } = require('liquidjs');

const ROOT = path.join(__dirname, '..');
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', f), 'utf8'));
const stripComments = (s) => s.replace(/^﻿/, '').replace(/\/\*[\s\S]*?\*\//g, '');
const readTheme = (f) => JSON.parse(stripComments(fs.readFileSync(path.join(ROOT, 'theme', f), 'utf8')));

const cents = (v) => (v === null || v === undefined || v === '' ? null : Math.round(parseFloat(v) * 100));

// ---------- images ----------
const MANIFEST = read('image-manifest.json');

class ImageDrop {
  constructor({ base, widths, width, height, alt, id, position, src }) {
    this.__img = { base, widths, src };
    this.width = width;
    this.height = height;
    this.alt = alt || '';
    this.id = id;
    this.position = position;
    this.aspect_ratio = width && height ? width / height : 1;
    this.media_type = 'image';
    this.src = src || (base ? `/images/${base}-${widths[widths.length - 1]}.webp` : '');
    this.url = this.src;
  }
  get preview_image() { return this; }
  get presentation() { return { focal_point: null }; }
  toString() { return this.src; }
  valueOf() { return this.src; }
}

// shop images (logo, favicon) referenced as shopify://shop_images/<file>
// A catalogue photo ("images/<product>/01.jpg") referenced from settings or collections.json:
// served from the pre-sized webp renditions so it gets a proper srcset.
function catalogueImage(ref, alt, id) {
  if (!ref || typeof ref !== 'string') return null;
  const key = ref.replace('shopify://shop_images/', '').replace(/^\/?images\//, '');
  const m = MANIFEST[key];
  if (!m) return null;
  return new ImageDrop({ base: m.base, widths: m.widths, width: m.width, height: m.height, alt: alt || '', id: id || key });
}

function shopImage(ref) {
  if (!ref || typeof ref !== 'string') return null;
  const cat = catalogueImage(ref);
  if (cat) return cat;
  const file = ref.replace('shopify://shop_images/', '');
  const meta = SHOP_IMAGE_SIZES[file] || { width: 800, height: 800 };
  return new ImageDrop({ src: `/${file}`, width: meta.width, height: meta.height, alt: '', id: file });
}
const SHOP_IMAGE_SIZES = {};

// ---------- metafields ----------
class MetafieldDrop extends Drop {
  constructor(value, type) { super(); this.value = value; this.type = type || 'single_line_text_field'; }
  valueOf() { return this.value; }
  toString() { return this.value === null || this.value === undefined ? '' : String(this.value); }
}
const MF_TYPES = { 'custom.set_name': 'single_line_text_field', 'custom.language': 'single_line_text_field', 'custom.release_date': 'date', 'custom.contents': 'multi_line_text_field', 'global.title_tag': 'string', 'global.description_tag': 'string', 'mm-google-shopping.custom_product': 'boolean' };
function buildMetafields(map) {
  const out = {};
  for (const [k, v] of Object.entries(map || {})) {
    const i = k.indexOf('.');
    const ns = k.slice(0, i);
    const key = k.slice(i + 1);
    out[ns] = out[ns] || {};
    out[ns][key] = new MetafieldDrop(v, MF_TYPES[k] || 'string');
  }
  return out;
}

// ---------- inventory overlay (live stock after Stripe orders) ----------
let STOCK = {};
let PRICE = {};
function setStockOverlay(map) { STOCK = map || {}; }
function setPriceOverlay(map) { PRICE = map || {}; }

// ---------- products ----------
const RAW_PRODUCTS = read('products.json');
const PRODUCTS = [];
const BY_HANDLE = {};
const BY_VARIANT = {};

class VariantDrop {
  constructor(v, product, idx) {
    this.__p = product;
    this.id = Number(v.id);
    this.title = v.title;
    this.sku = v.sku || '';
    this.barcode = v.barcode || '';
    this.__price = cents(v.price);
    this.compare_at_price = cents(v.compare_at_price);
    this.taxable = v.taxable;
    this.requires_shipping = v.requires_shipping;
    this.weight = v.weight || 0;
    this.inventory_management = v.inventory_tracked ? 'shopify' : null;
    this.inventory_policy = (v.inventory_policy || 'DENY').toLowerCase();
    this.__qty = v.inventory_quantity || 0;
    const opts = Object.values(v.options || {});
    this.options = opts;
    this.option1 = opts[0] || null;
    this.option2 = opts[1] || null;
    this.option3 = opts[2] || null;
    this.position = idx + 1;
    this.selling_plan_allocations = [];
    this.unit_price_measurement = null;
    this.quantity_rule = { min: 1, max: null, increment: 1 };
  }
  get inventory_quantity() { const s = STOCK[this.id]; return s === undefined ? this.__qty : s; }
  get price() { const p = PRICE[this.id]; return p === undefined ? this.__price : p; }
  get base_price() { return this.__price; }
  get available() {
    if (!this.inventory_management) return true;
    if (this.inventory_policy === 'continue') return true;
    return this.inventory_quantity > 0;
  }
  get product() { return this.__p; }
  get url() { return `/products/${this.__p.handle}?variant=${this.id}`; }
  get featured_image() { return null; }
  get featured_media() { return null; }
  get image() { return null; }
}

class ProductDrop {
  constructor(r) {
    this.__r = r;
    this.id = Number(r.id);
    this.handle = r.handle;
    this.title = r.title;
    this.type = r.product_type || '';
    this.vendor = r.vendor || '';
    this.__rawTags = r.tags || [];
    this.__rawDescription = r.description_html || '';
    this.created_at = r.created_at;
    this.published_at = r.published_at;
    this.updated_at = r.updated_at;
    this.template_suffix = r.template_suffix || null;
    this.url = `/products/${r.handle}`;
    this.object_type = 'product';
    this.status = r.status;
    this.metafields = buildMetafields(r.metafields);
    this.seo_title = r.seo_title;
    this.seo_description = r.seo_description;
    // attributes: { Height: '6ft', Colour: ['Green'], Lighting: 'Pre-lit' … } – shown as specifications and used as filters
    this.attributes = r.attributes || {};
    this.specs = Object.entries(this.attributes).map(([name, v]) => ({ name, value: Array.isArray(v) ? v.join(', ') : String(v) }));
    this.summary = r.summary || '';
    this.release_date = r.release_date || null;
    this.images = (r.images || []).map((im, i) => {
      const key = String(im.local || '').replace(/^images\//, '');
      const m = MANIFEST[key];
      return new ImageDrop({
        base: m ? m.base : null, widths: m ? m.widths : [], width: m ? m.width : im.width, height: m ? m.height : im.height,
        alt: im.alt || r.title, id: Number(`${r.id}`.slice(-6) + String(i + 1).padStart(2, '0')), position: i + 1,
        src: m ? undefined : im.src,
      });
    });
    this.media = this.images;
    this.featured_image = this.images[0] || null;
    this.featured_media = this.images[0] || null;
    this.variants = (r.variants || []).map((v, i) => new VariantDrop(v, this, i));
    this.options = (r.options || []).map((o) => o.name);
    this.has_only_default_variant = this.variants.length === 1 && this.variants[0].title === 'Default Title';
    this.requires_selling_plan = false;
    this.selling_plan_groups = [];
    this.gift_card = false;
    this.quantity_price_breaks_configured = false;
  }
  get available() { return this.variants.some((v) => v.available); }
  get price() { return Math.min(...this.variants.map((v) => v.price)); }
  get price_min() { return this.price; }
  get price_max() { return Math.max(...this.variants.map((v) => v.price)); }
  get price_varies() { return this.price_min !== this.price_max; }
  // "was" price of the cheapest variant (comparing across different variants would overstate the saving)
  get compare_at_price() { const p = this.price; const v = this.variants.find((x) => x.price === p); return v && v.compare_at_price && v.compare_at_price > p ? v.compare_at_price : null; }
  get on_sale() { return this.variants.some((v) => v.compare_at_price && v.compare_at_price > v.price); }
  get compare_at_price_min() { return this.compare_at_price; }
  get compare_at_price_max() { const c = this.variants.map((v) => v.compare_at_price).filter((x) => x); return c.length ? Math.max(...c) : null; }
  get first_available_variant() { return this.variants.find((v) => v.available) || null; }
  get selected_variant() { return this.__selected || null; }
  get selected_or_first_available_variant() { return this.__selected || this.first_available_variant || this.variants[0]; }
  get options_with_values() {
    const sel = this.selected_or_first_available_variant;
    return (this.__r.options || []).map((o, i) => ({ name: o.name, position: i + 1, values: o.values, selected_value: sel ? sel.options[i] : o.values[0] }));
  }
  get collections() {
    return (this.__r.collections || []).map((h) => COLLECTIONS_BY_HANDLE[h]).filter(Boolean);
  }
  get total_inventory() { return this.variants.reduce((a, v) => a + (v.inventory_quantity || 0), 0); }
  withVariant(id) {
    const p = Object.create(this);
    p.__selected = this.variants.find((v) => String(v.id) === String(id)) || null;
    return p;
  }
}
// A product stops being a pre-order automatically once its release date (custom.release_date, Berlin time) is reached:
// the "Pre-order" tag disappears everywhere (storefront, cart, checkout, e-mails, Google feed) without any manual change.
const berlinToday = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/London' });
Object.defineProperty(ProductDrop.prototype, 'tags', {
  get() {
    const t = this.__rawTags || [];
    if (!t.includes('Pre-order')) return t;
    const rd = this.__r && this.__r.release_date;
    if (rd && String(rd).slice(0, 10) <= berlinToday()) return t.filter((x) => x !== 'Pre-order');
    return t;
  },
  set(v) { this.__rawTags = v || []; },
});
// once released, the pre-order sentences in the description go too ("Erscheinungstermin: …", "Vorbestellung: Der Versand erfolgt …")
function releasedDescription(html) {
  return String(html)
    .replace(/<li>\s*Erscheinungstermin:[^<]*<\/li>\s*/gi, '')
    .replace(/Vorbestellung:\s*Der Versand erfolgt zum offiziellen Erscheinungstermin\.\s*/gi, '')
    .replace(/Verschiebt der Hersteller den Termin, informieren wir dich per E-Mail\.\s*/gi, '')
    .replace(/<p><small>\s*<\/small><\/p>/gi, '');
}
Object.defineProperty(ProductDrop.prototype, 'description', { get() { return this.released ? releasedDescription(this.__rawDescription) : this.__rawDescription; }, set(v) { this.__rawDescription = v || ''; } });
Object.defineProperty(ProductDrop.prototype, 'content', { get() { return this.description; } });
Object.defineProperty(ProductDrop.prototype, 'released', { get() { const rd = this.__r && this.__r.release_date; return !!rd && String(rd).slice(0, 10) <= berlinToday(); } });


for (const r of RAW_PRODUCTS) {
  const p = new ProductDrop(r);
  PRODUCTS.push(p);
  BY_HANDLE[p.handle] = p;
  for (const v of p.variants) BY_VARIANT[v.id] = v;
}
const ACTIVE = PRODUCTS.filter((p) => p.status === 'active');
const productByHandle = (h) => { const p = BY_HANDLE[h]; return p && p.status === 'active' ? p : null; };
const variantById = (id) => { const v = BY_VARIANT[Number(id)]; return v && v.product.status === 'active' ? v : null; };

// ---------- collections ----------
// data/collections.json: [{ handle, title, parent, description, art, image, sort, rule, featured, position }]
//   parent   handle of the parent category (null = top level). A category lists its own products plus those of its sub-categories.
//   rule     'sale' = every product with a reduced price · 'new' = newest products · null = products assigned to it
//   a product is assigned through its own "collections": [handles] list in data/products.json
// data/collection-order.json: optional manual order per collection { handle: [product handles] }
const ORDER = read('collection-order.json');
const BEST = (() => { try { return read('collection-bestselling.json'); } catch (e) { return {}; } })();
const RAW_COLLECTIONS = read('collections.json');
const COLLECTIONS_BY_HANDLE = {};
const SORTS = [
  { value: 'manual', name: 'Featured' },
  { value: 'best-selling', name: 'Best selling' },
  { value: 'created-descending', name: 'Newest' },
  { value: 'price-ascending', name: 'Price: low to high' },
  { value: 'price-descending', name: 'Price: high to low' },
  { value: 'title-ascending', name: 'A to Z' },
];
const NEW_LIMIT = 48;
// product attributes offered as filters, in this order, when a category has products that carry them
const FILTER_ATTRIBUTES = ['Height', 'Size', 'Colour', 'Lighting', 'Shape', 'Style', 'Material', 'Use', 'Season'];

const titleKey = (t) => String(t).toLowerCase();
const cmpKey = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
const hashId = (s) => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) % 2147483647; return h; };
const toPence = (v) => (v === null || v === undefined || v === '' ? null : Math.round(parseFloat(String(v).replace(',', '.')) * 100));

class CollectionDrop {
  constructor(c) {
    this.id = hashId(c.handle);
    this.handle = c.handle;
    this.title = c.title;
    this.description = c.description || '';
    this.url = `/collections/${c.handle}`;
    this.art = c.art || 'tree';
    this.image = c.image ? catalogueImage(c.image, c.title, c.handle) || new ImageDrop({ src: c.image, width: c.imageWidth || 1200, height: c.imageHeight || 1500, alt: c.title, id: c.handle }) : null;
    this.featured_image = this.image;
    this.featured = !!c.featured;
    this.position = c.position || 0;
    this.template_suffix = null;
    this.default_sort_by = c.sort || 'manual';
    this.sort_options = SORTS;
    this.seo_title = c.seoTitle || null;
    this.seo_description = c.seoDescription || null;
    this.metafields = {};
    this.__parent = c.parent || null;
    this.__rule = c.rule || null;
    this.__sort = null;
    this.__tags = [];
    this.__params = null;
    this.__path = this.url;
  }
  get parent() { return this.__parent ? COLLECTIONS_BY_HANDLE[this.__parent] || null : null; }
  get children() { return RAW_COLLECTIONS.filter((c) => c.parent === this.handle).map((c) => COLLECTIONS_BY_HANDLE[c.handle]); }
  get all_products() {
    if (this.handle === 'all') return ACTIVE;
    if (this.__rule === 'sale') return ACTIVE.filter((p) => p.on_sale);
    if (this.__rule === 'new') return [...ACTIVE].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))).slice(0, NEW_LIMIT);
    const mine = new Set([this.handle, ...RAW_COLLECTIONS.filter((c) => c.parent === this.handle).map((c) => c.handle)]);
    const list = ACTIVE.filter((p) => (p.__r.collections || []).some((h) => mine.has(h)));
    const manual = ORDER[this.handle];
    if (manual && manual.length) { const rank = Object.fromEntries(manual.map((h, i) => [h, i])); list.sort((a, b) => (rank[a.handle] ?? 1e6) - (rank[b.handle] ?? 1e6)); }
    return list;
  }
  get __tagged() {
    let list = this.all_products;
    if (this.__tags.length) list = list.filter((p) => this.__tags.every((t) => p.tags.includes(t)));
    return list;
  }
  // every filter except `skip` applied: lets each filter group show counts for its own values
  __applyFilters(list, skip) {
    const q = this.__params;
    if (!q) return list;
    const av = q.getAll('filter.v.availability');
    if (skip !== 'filter.v.availability' && av.length) list = list.filter((p) => av.includes(p.available ? '1' : '0'));
    if (skip !== 'filter.v.price') {
      const gte = toPence(q.get('filter.v.price.gte')); const lte = toPence(q.get('filter.v.price.lte'));
      if (gte !== null) list = list.filter((p) => p.price >= gte);
      if (lte !== null) list = list.filter((p) => p.price <= lte);
    }
    if (skip !== 'filter.v.sale' && q.getAll('filter.v.sale').includes('1')) list = list.filter((p) => p.on_sale);
    const brands = q.getAll('filter.p.vendor');
    if (skip !== 'filter.p.vendor' && brands.length) list = list.filter((p) => brands.includes(p.vendor));
    for (const name of FILTER_ATTRIBUTES) {
      const param = `filter.p.a.${handleize(name)}`;
      const want = q.getAll(param);
      if (skip !== param && want.length) list = list.filter((p) => attrValues(p, name).some((v) => want.includes(v)));
    }
    return list;
  }
  __url(mutate) {
    const q = new URLSearchParams(this.__params ? this.__params.toString() : '');
    q.delete('page'); q.delete('section_id');
    mutate(q);
    const str = q.toString().replace(/%2C/g, ',');
    return this.__path + (str ? `?${str}` : '');
  }
  __listFilter(label, param, options, base, test) {
    const q = this.__params || new URLSearchParams();
    const pool = this.__applyFilters(base, param);
    const active = q.getAll(param);
    const values = options.map(([value, text]) => ({
      label: text, value, param_name: param, active: active.includes(value),
      count: pool.filter((p) => test(p, value)).length,
      url_to_add: this.__url((u) => u.append(param, value)),
      url_to_remove: this.__url((u) => { const keep = u.getAll(param).filter((x) => x !== value); u.delete(param); keep.forEach((k) => u.append(param, k)); }),
    }));
    return { label, param_name: param, type: 'list', values, active_values: values.filter((v) => v.active), inactive_values: values.filter((v) => !v.active), url_to_remove: this.__url((u) => u.delete(param)) };
  }
  get filters() {
    const q = this.__params || new URLSearchParams();
    const base = this.__tagged;
    const out = [];
    out.push(this.__listFilter('Availability', 'filter.v.availability', [['1', 'In stock'], ['0', 'Out of stock']], base, (p, v) => (p.available ? '1' : '0') === v));
    out.push({
      label: 'Price', param_name: 'filter.v.price', type: 'price_range', range_max: base.length ? Math.max(...base.map((p) => p.price_max)) : 0, active_values: [], values: [],
      min_value: { param_name: 'filter.v.price.gte', value: toPence(q.get('filter.v.price.gte')) }, max_value: { param_name: 'filter.v.price.lte', value: toPence(q.get('filter.v.price.lte')) },
      url_to_remove: this.__url((u) => { u.delete('filter.v.price.gte'); u.delete('filter.v.price.lte'); }),
    });
    if (this.__rule !== 'sale' && base.some((p) => p.on_sale)) out.push(this.__listFilter('Offers', 'filter.v.sale', [['1', 'On sale']], base, (p) => p.on_sale));
    const brands = [...new Set(base.map((p) => p.vendor).filter(Boolean))].sort();
    if (brands.length > 1) out.push(this.__listFilter('Brand', 'filter.p.vendor', brands.map((b) => [b, b]), base, (p, v) => p.vendor === v));
    for (const name of FILTER_ATTRIBUTES) {
      const vals = [...new Set(base.flatMap((p) => attrValues(p, name)))].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
      if (vals.length > 1) out.push(this.__listFilter(name, `filter.p.a.${handleize(name)}`, vals.map((v) => [v, v]), base, (p, v) => attrValues(p, name).includes(v)));
    }
    return out;
  }
  get products() {
    let list = this.__applyFilters(this.__tagged);
    const s = this.__sort || this.default_sort_by;
    if (s === 'best-selling' && BEST[this.handle]) {
      const rank = Object.fromEntries(BEST[this.handle].map((h, i) => [h, i]));
      return [...list].sort((a, b) => (rank[a.handle] ?? 1e6) - (rank[b.handle] ?? 1e6));
    }
    const by = {
      'title-ascending': (a, b) => cmpKey(titleKey(a.title), titleKey(b.title)),
      'title-descending': (a, b) => cmpKey(titleKey(b.title), titleKey(a.title)),
      'price-ascending': (a, b) => a.price - b.price,
      'price-descending': (a, b) => b.price - a.price,
      'created-ascending': (a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')),
      'created-descending': (a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')),
    }[s];
    if (by) list = [...list].sort((a, b) => by(a, b) || a.id - b.id);
    return list;
  }
  get products_count() { return this.products.length; }
  get all_products_count() { return this.all_products.length; }
  get all_tags() { return [...new Set(this.all_products.flatMap((p) => p.tags))].sort(); }
  get all_types() { return [...new Set(this.all_products.map((p) => p.type).filter(Boolean))].sort(); }
  get all_vendors() { return [...new Set(this.all_products.map((p) => p.vendor).filter(Boolean))].sort(); }
  get sort_by() { return this.__sort || ''; }
  view({ sort, tags, params, path } = {}) {
    const c = Object.create(this);
    c.__sort = SORTS.some((o) => o.value === sort) ? sort : null;
    c.__tags = tags || [];
    c.__params = params || null;
    c.__path = path || this.url;
    return c;
  }
}
// a product attribute may hold one value or several ("Colour": ["Red", "Gold"])
function attrValues(p, name) { const v = (p.attributes || {})[name]; return v === undefined || v === null || v === '' ? [] : (Array.isArray(v) ? v : [v]).map(String); }

for (const c of RAW_COLLECTIONS) COLLECTIONS_BY_HANDLE[c.handle] = new CollectionDrop(c);
COLLECTIONS_BY_HANDLE.all = new CollectionDrop({ handle: 'all', title: 'All products', description: '', sort: 'manual' });

// global `collections` object: iterable list (in menu order) + lookup by handle
function collectionsGlobal() {
  const g = RAW_COLLECTIONS.map((c) => COLLECTIONS_BY_HANDLE[c.handle]);
  for (const [h, c] of Object.entries(COLLECTIONS_BY_HANDLE)) g[h] = c;
  return g;
}

// ---------- pages ----------
const RAW_PAGES = read('pages.json');
const PAGES_BY_HANDLE = {};
for (const p of RAW_PAGES) {
  PAGES_BY_HANDLE[p.handle] = {
    id: Number(String(p.id).split('/').pop()), handle: p.handle, title: p.title, content: p.body || '', url: `/pages/${p.handle}`,
    template_suffix: p.templateSuffix || null, published: p.isPublished, published_at: p.updatedAt, metafields: {},
  };
}
const pageByHandle = (h) => { const p = PAGES_BY_HANDLE[h]; return p && p.published ? p : null; };

// ---------- policies ----------
const POLICY_PATHS = { REFUND_POLICY: 'refund-policy', PRIVACY_POLICY: 'privacy-policy', TERMS_OF_SERVICE: 'terms-of-service', SHIPPING_POLICY: 'shipping-policy', CONTACT_INFORMATION: 'contact-information', LEGAL_NOTICE: 'legal-notice' };
const POLICY_TITLES = { REFUND_POLICY: 'Returns and refunds', PRIVACY_POLICY: 'Privacy policy', TERMS_OF_SERVICE: 'Terms of service', SHIPPING_POLICY: 'Delivery', CONTACT_INFORMATION: 'Contact', LEGAL_NOTICE: 'Company details' };
const POLICIES = {};
for (const p of read('policies.json')) {
  const handle = POLICY_PATHS[p.type];
  POLICIES[handle] = { title: POLICY_TITLES[p.type] || p.title, body: p.body, url: `/policies/${handle}`, handle };
}

// ---------- menus ----------
function resolveUrl(u) {
  if (!u) return u;
  return String(u);
}
const RAW_MENUS = read('menus.json');
function linkDrop(item, currentPath) {
  const url = resolveUrl(item.url);
  const links = (item.items || []).map((i) => linkDrop(i, currentPath));
  const handle = url.split('/').filter(Boolean).pop() || '';
  let object = null; let type = 'http_link';
  if (/^\/collections\//.test(url)) { object = COLLECTIONS_BY_HANDLE[handle] || null; type = 'collection_link'; }
  else if (/^\/pages\//.test(url)) { object = pageByHandle(handle); type = 'page_link'; }
  else if (/^\/products\//.test(url)) { object = productByHandle(handle); type = 'product_link'; }
  else if (url === '/') type = 'frontpage_link';
  else if (url === '/search') type = 'search_link';
  else if (url === '/collections/all') type = 'catalog_link';
  const active = currentPath === url || (/^\/collections\/[^/]+$/.test(url) && currentPath.startsWith(`${url}/`) && !currentPath.includes('/products/'));
  const child_active = links.some((l) => l.active || l.child_active);
  return { title: item.title, url, links, type, object, active, current: active, child_active, child_current: child_active, handle: handleize(item.title), levels: links.length ? (links.some((l) => l.links.length) ? 2 : 1) : 0 };
}
function linklistsGlobal(currentPath) {
  const out = {};
  for (const m of RAW_MENUS) {
    const ll = { handle: m.handle, title: m.title, links: m.items.map((i) => linkDrop(i, currentPath)), levels: 2 };
    Object.defineProperty(ll, 'toString', { value: () => m.handle, enumerable: false });
    out[m.handle] = ll;
  }
  return out;
}

function handleize(s) {
  return String(s || '').toLowerCase()
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// ---------- search ----------
function searchProducts(q) {
  const terms = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const scored = [];
  for (const p of ACTIVE) {
    const title = p.title.toLowerCase();
    const hay = [title, p.type, p.vendor, p.tags.join(' '), p.handle].join(' ').toLowerCase();
    const body = String(p.description || '').replace(/<[^>]+>/g, ' ').toLowerCase();
    if (!terms.every((t) => hay.includes(t) || body.includes(t))) continue;
    let score = 0;
    for (const t of terms) {
      if (new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(title)) score += 20;
      else if (title.includes(t)) score += 10;
      if (hay.includes(t)) score += 3;
      score += Math.min(5, body.split(t).length - 1);
    }
    scored.push([score + (p.available ? 1 : 0), p]);
  }
  scored.sort((a, b) => b[0] - a[0]);
  return scored.map((x) => x[1]);
}
function searchCollections(q) {
  const t = String(q || '').toLowerCase();
  return collectionsGlobal().filter((c) => c.title.toLowerCase().includes(t));
}

// ---------- theme settings / sections ----------
const SETTINGS_DATA = readTheme('config/settings_data.json').current;
const SETTINGS_SCHEMA = readTheme('config/settings_schema.json');

module.exports = {
  ROOT, read, readTheme, stripComments, cents,
  ImageDrop, shopImage, MetafieldDrop,
  PRODUCTS, ACTIVE, productByHandle, variantById, BY_VARIANT,
  COLLECTIONS_BY_HANDLE, collectionsGlobal,
  PAGES_BY_HANDLE, pageByHandle, POLICIES,
  linklistsGlobal, resolveUrl, handleize,
  searchProducts, searchCollections,
  SETTINGS_DATA, SETTINGS_SCHEMA,
  setStockOverlay, setPriceOverlay,
};
