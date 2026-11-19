// Google Merchant Center product feed (/feeds/google.xml and /feeds/google.txt). Item IDs: shopify_ZZ_<product>_<variant>.
'use strict';
const D = require('./data');
const SHOP = require('./shop');

const x = (s) => String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', euro: '€', ndash: '–', mdash: '—', hellip: '…', laquo: '«', raquo: '»', bdquo: '„', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', szlig: 'ß', auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', eacute: 'é', copy: '©', reg: '®', trade: '™' };
const decode = (t) => String(t).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e] !== undefined ? ENT[e] : m));
const strip = (h) => decode(String(h || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|li|h\d)>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ')).replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
const HIRES = new Set(require('../data/hires.json')); // 1600px versions generated for Merchant Center
const TOPSELLER = new Set(require('../data/topseller.json')); // custom_label_4 = topseller → PMax asset group "Top-Seller"
const label4 = (p, mf) => mf['mm-google-shopping.custom_label_4'] || (TOPSELLER.has(p.handle) ? 'topseller' : '');
// Google product category by product type (exact names from Google's taxonomy). Anything else is a seasonal decoration.
const SEASONAL = 'Home & Garden > Decor > Seasonal & Holiday Decorations';
const GCAT = {
  Ornament: `${SEASONAL} > Holiday Ornaments`,
  'Tree skirt': `${SEASONAL} > Christmas Tree Skirts`,
  Wreath: 'Home & Garden > Decor > Wreaths & Garlands',
  Garland: 'Home & Garden > Decor > Wreaths & Garlands',
  Topiary: 'Home & Garden > Decor > Artificial Flora',
  Nutcracker: 'Home & Garden > Kitchen & Dining > Kitchen Tools & Utensils > Food Cracking Tools > Nutcrackers > Decorative Nutcrackers',
  Ribbon: 'Arts & Entertainment > Hobbies & Creative Arts > Arts & Crafts > Art & Crafting Materials > Embellishments & Trims > Ribbons & Trim',
};
const gcat = (p, mf) => mf['mm-google-shopping.google_product_category'] || GCAT[p.type] || SEASONAL;
// a photo that is still hosted elsewhere already has a full address; ours get the shop's origin in front
const abs = (origin, u) => (/^https?:\/\//i.test(u) ? u : `${origin}${u}`);
const big = (img) => (img && img.__img && img.__img.base ? `/images/${img.__img.base}-${HIRES.has(img.__img.base) ? 1600 : img.__img.widths[img.__img.widths.length - 1]}.webp` : img ? img.src : '');

function google(origin) {
  const items = [];
  for (const p of D.ACTIVE) {
    const mf = p.__r.metafields || {};
    for (const v of p.variants) {
      const pre = p.tags.includes('Pre-order') && v.inventory_policy === 'continue';
      let availability = v.available ? 'in_stock' : 'out_of_stock';
      if (pre && p.__r.release_date) availability = 'preorder';
      const imgs = p.images.map(big).filter(Boolean);
      const parts = [
        `<g:id>shopify_ZZ_${p.id}_${v.id}</g:id>`,
        `<g:item_group_id>shopify_ZZ_${p.id}</g:item_group_id>`,
        `<g:title>${x((p.has_only_default_variant ? mf['global.title_tag'] || p.title : `${p.title} - ${v.title}`).slice(0, 150))}</g:title>`,
        `<g:description>${x((mf['global.description_tag'] || strip(p.description) || p.title).slice(0, 4900))}</g:description>`,
        `<g:link>${origin}${p.url}${p.has_only_default_variant ? '' : `?variant=${v.id}`}</g:link>`,
        imgs[0] ? `<g:image_link>${x(abs(origin, imgs[0]))}</g:image_link>` : '',
        ...imgs.slice(1, 10).map((i) => `<g:additional_image_link>${x(abs(origin, i))}</g:additional_image_link>`),
        `<g:availability>${availability}</g:availability>`,
        availability === 'preorder' ? `<g:availability_date>${p.__r.release_date}T00:00:00+01:00</g:availability_date>` : '',
        `<g:price>${(v.compare_at_price && v.compare_at_price > v.price ? v.compare_at_price : v.price) / 100} GBP</g:price>`,
        v.compare_at_price && v.compare_at_price > v.price ? `<g:sale_price>${v.price / 100} GBP</g:sale_price>` : '',
        `<g:condition>${x((mf['mm-google-shopping.condition'] || 'new').toLowerCase())}</g:condition>`,
        `<g:brand>${x(p.vendor)}</g:brand>`,
        v.barcode ? `<g:gtin>${x(v.barcode)}</g:gtin>` : '',
        v.sku ? `<g:mpn>${x(v.sku)}</g:mpn>` : '',
        v.barcode ? '' : `<g:identifier_exists>no</g:identifier_exists>`,
        `<g:google_product_category>${x(gcat(p, mf))}</g:google_product_category>`,
        p.type ? `<g:product_type>${x(p.type)}</g:product_type>` : '',
        ...[0, 1, 2, 3].map((n) => (mf[`mm-google-shopping.custom_label_${n}`] ? `<g:custom_label_${n}>${x(mf[`mm-google-shopping.custom_label_${n}`])}</g:custom_label_${n}>` : '')),
        label4(p, mf) ? `<g:custom_label_4>${x(label4(p, mf))}</g:custom_label_4>` : '',
        // delivery prices and times are set in the Merchant Center account, not in the feed
      ].filter(Boolean);
      items.push(`<item>${parts.join('')}</item>`);
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>${SHOP.name.replace(/&/g, '&amp;')}</title><link>${origin}</link><description>Product feed</description>\n${items.join('\n')}\n</channel></rss>\n`;
}

// Same products as TSV (/feeds/google.txt) – Merchant Center's most robust format.
function googleTsv(origin) {
  const cols = ['id', 'item_group_id', 'title', 'description', 'link', 'image_link', 'additional_image_link', 'availability', 'availability_date', 'price', 'sale_price', 'condition', 'brand', 'gtin', 'mpn', 'identifier_exists', 'google_product_category', 'product_type', 'custom_label_0', 'custom_label_1', 'custom_label_2', 'custom_label_3', 'custom_label_4', 'shipping(country:service:price:min_handling_time:max_handling_time:min_transit_time:max_transit_time)'];
  const clean = (v) => String(v === undefined || v === null ? '' : v).replace(/[\t\r\n]+/g, ' ').trim();
  const rows = [cols.join('\t')];
  for (const p of D.ACTIVE) {
    const mf = p.__r.metafields || {};
    for (const v of p.variants) {
      const pre = p.tags.includes('Pre-order') && v.inventory_policy === 'continue';
      let availability = v.available ? 'in_stock' : 'out_of_stock';
      if (pre && p.__r.release_date) availability = 'preorder';
      const imgs = p.images.map(big).filter(Boolean);
      const sale = v.compare_at_price && v.compare_at_price > v.price;
      const r = {
        id: `shopify_ZZ_${p.id}_${v.id}`, item_group_id: `shopify_ZZ_${p.id}`,
        title: (p.has_only_default_variant ? mf['global.title_tag'] || p.title : `${p.title} - ${v.title}`).slice(0, 150),
        description: (mf['global.description_tag'] || strip(p.description) || p.title).slice(0, 4900),
        link: `${origin}${p.url}${p.has_only_default_variant ? '' : `?variant=${v.id}`}`,
        image_link: imgs[0] ? abs(origin, imgs[0]) : '', additional_image_link: imgs.slice(1, 10).map((i) => abs(origin, i)).join(','),
        availability, availability_date: availability === 'preorder' ? `${p.__r.release_date}T00:00:00+01:00` : '',
        price: `${((sale ? v.compare_at_price : v.price) / 100).toFixed(2)} GBP`, sale_price: sale ? `${(v.price / 100).toFixed(2)} GBP` : '',
        condition: (mf['mm-google-shopping.condition'] || 'new').toLowerCase(), brand: p.vendor, gtin: v.barcode || '', mpn: v.sku || '', identifier_exists: v.barcode ? '' : 'no',
        google_product_category: gcat(p, mf), product_type: p.type || '',
        custom_label_0: mf['mm-google-shopping.custom_label_0'] || '', custom_label_1: mf['mm-google-shopping.custom_label_1'] || '', custom_label_2: mf['mm-google-shopping.custom_label_2'] || '', custom_label_3: mf['mm-google-shopping.custom_label_3'] || '', custom_label_4: label4(p, mf),
        'shipping(country:service:price:min_handling_time:max_handling_time:min_transit_time:max_transit_time)': '',
      };
      rows.push(cols.map((c) => clean(r[c])).join('\t'));
    }
  }
  return `${rows.join('\r\n')}\r\n`;
}

module.exports = { google, googleTsv };
