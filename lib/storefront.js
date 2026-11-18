// Storefront extras that Shopify could not do: visit beacon, back-in-stock alerts, order status page, cart restore, cron.
'use strict';
const D = require('./data');
const C = require('./cart');
const stock = require('./stock');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const json = (res, status, obj) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(obj)); };

// POST /api/visit  {path, product, ref}  – anonymous counters only (no cookie, no IP stored)
function deviceInfo(ua) {
  ua = String(ua || '');
  const device = /iPad|Tablet/i.test(ua) ? 'tablet' : /Mobi|Android|iPhone/i.test(ua) ? 'mobile' : 'desktop';
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Other';
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return { device, browser, os };
}
async function visit(req, res, body) {
  try {
    const b = body || {};
    const path = String(b.path || '').slice(0, 200);
    const vid = /^[a-z0-9]{8,24}$/i.test(String(b.vid || '')) ? String(b.vid) : '';
    const geo = { country: String(req.headers['x-vercel-ip-country'] || '').slice(0, 2), city: decodeURIComponent(String(req.headers['x-vercel-ip-city'] || '')).slice(0, 40), region: decodeURIComponent(String(req.headers['x-vercel-ip-country-region'] || '')).slice(0, 40), lat: String(req.headers['x-vercel-ip-latitude'] || '').slice(0, 12), lon: String(req.headers['x-vercel-ip-longitude'] || '').slice(0, 12) };
    if (vid && path && !/^\/(admin|api)/.test(path)) {
      let sref = '';
      try { const r = String(b.ref || ''); if (r) { const h = new URL(r).hostname.replace(/^www\./, ''); sref = /google|bing|duckduckgo|ecosia/.test(h) ? 'Search (organic)' : /instagram|tiktok|facebook|youtube|reddit/.test(h) ? h.split('.')[0] : h; } } catch (e) { sref = ''; }
      const sq = String(b.q || ''); if (/gclid|gad_source|utm_source=google/.test(sq)) sref = 'Google Ads'; else if (/utm_source=([^&]+)/.test(sq)) sref = decodeURIComponent(/utm_source=([^&]+)/.exec(sq)[1]).slice(0, 30); if (!sref && !b.ref) sref = 'Direct';
      stock.touchSession({ vid, path, ...geo, ref: sref, ...deviceInfo(req.headers['user-agent']), heartbeat: !!b.hb, first: !!b.first }).catch(() => {});
    }
    if (vid) { const bl = await stock.getTimeoutFor(vid).catch(() => null); if (bl) { res.statusCode = 200; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); return res.end(JSON.stringify({ timeout: { until: bl.until, minutes: bl.minutes } })); } }
    if (b.hb || /^\/(admin|api|checkout|cart)/.test(path) || !path) { res.statusCode = 204; return res.end(); }
    let ref = '';
    try { const r = String(b.ref || ''); if (r) { const h = new URL(r).hostname.replace(/^www\./, ''); ref = /google|bing|duckduckgo|ecosia/.test(h) ? 'Search (organic)' : /instagram|tiktok|facebook|youtube|reddit/.test(h) ? h.split('.')[0] : h; } } catch (e) { ref = ''; }
    const q = String(b.q || '');
    if (/gclid|gad_source|utm_source=google/.test(q)) ref = 'Google Ads';
    else if (/utm_source=([^&]+)/.test(q)) ref = decodeURIComponent(/utm_source=([^&]+)/.exec(q)[1]).slice(0, 30);
    if (!ref && !b.ref) ref = 'Direct';
    const product = String(b.product || '').slice(0, 120);
    await stock.recordVisit({ path, country: String(req.headers['x-vercel-ip-country'] || '').slice(0, 2), city: decodeURIComponent(String(req.headers['x-vercel-ip-city'] || '')).slice(0, 40), ref, product: D.productByHandle(product) ? product : '', device: ((ua) => (/iPad|Tablet|Android(?!.*Mobile)/i.test(ua) ? 'tablet' : /Mobi|iPhone|Android/i.test(ua) ? 'mobile' : ua ? 'desktop' : ''))(String(req.headers['user-agent'] || '')) });
  } catch (e) { /* analytics must never break anything */ }
  res.statusCode = 204; res.end();
}

// POST /api/back-in-stock {variant_id, email}
async function backInStock(req, res, body) {
  const b = body || {};
  const email = String(b.email || '').trim().toLowerCase();
  const v = D.BY_VARIANT[Number(b.variant_id)];
  if (!EMAIL_RE.test(email)) return json(res, 400, { error: 'Enter a valid email address.' });
  if (!v) return json(res, 404, { error: 'That product is no longer available.' });
  if (!stock.enabled()) return json(res, 503, { error: 'Stock alerts are not available right now. Try again later.' });
  await stock.addBackInStock(v.id, email);
  stock.logActivity('waitlist', `Back-in-stock request · ${v.product ? v.product.title : v.id}`, { who: email, href: v.product ? `/admin/products/${v.product.handle}` : '/admin/products' }).catch(() => {});
  return json(res, 200, { ok: true, message: 'Done. We will email you once, when this item is back in stock.' });
}

// GET/POST /bestellung  – order status for customers (order number + e-mail)
async function orderStatus(req, res, url, cart, body, renderPage) {
  const num = String((body && body.number) || url.searchParams.get('nr') || '').trim().replace(/^#/, '');
  const email = String((body && body.email) || url.searchParams.get('email') || '').trim().toLowerCase();
  let order = null, error = '';
  if (num || email) {
    const o = /^\d{3,}$/.test(num) ? await stock.getOrderByNumber(num) : null;
    if (o && o.email && o.email.toLowerCase() === email && o.status !== 'pending') {
      const CARR = { 'Royal Mail': (t) => `https://www.royalmail.com/track-your-item#/tracking-results/${encodeURIComponent(t)}`, DPD: (t) => `https://track.dpd.co.uk/search?reference=${encodeURIComponent(t)}`, Evri: (t) => `https://www.evri.com/track/parcel/${encodeURIComponent(t)}`, DHL: (t) => `https://www.dhl.com/gb-en/home/tracking.html?tracking-id=${encodeURIComponent(t)}`, UPS: (t) => `https://www.ups.com/track?loc=en_GB&tracknum=${encodeURIComponent(t)}`, Parcelforce: (t) => `https://www.parcelforce.com/track-trace?trackNumber=${encodeURIComponent(t)}` };
      const ev = (await stock.listEvents(o.id)).filter((e) => ['paid', 'shipped', 'refund', 'cancelled'].includes(e.type)).map((e) => ({ at: e.at, text: { paid: 'Payment received and order confirmed', shipped: `Parcel handed to ${o.carrier || 'the carrier'}`, refund: 'Refund issued', cancelled: 'Order cancelled' }[e.type] }));
      order = { ...o, events: ev, tracking_url: o.tracking && CARR[o.carrier] ? CARR[o.carrier](o.tracking) : '', step: { paid: 2, shipped: 3, refunded: 0, cancelled: 0 }[o.status] || 1, lines: o.lines.map((l) => { const pr = l.handle ? D.productByHandle(l.handle) : null; const pre = !!l.preorder && !(pr && pr.released); return { ...l, preorder: pre, release: pre ? l.release : '', line_total: l.price * l.quantity }; }) };
    } else error = 'No order matches that number and email address. Check both: the order number is in your confirmation email.';
  }
  return renderPage(req, res, url, cart, { pageType: 'page', template: 'order-status', forms: {}, extra: { order_status: { order, error, number: num, email }, page_title: order ? `Order #${order.number}` : 'Track an order', page_description: 'Check the status of your order.' } });
}

// /checkout?cart=<token> (link from the reminder mail): restore the saved cart when the current one is empty
async function restoreCart(cart, token) {
  if (!token || cart.lines.length) return false;
  const saved = await stock.getCart(String(token).slice(0, 80));
  if (!saved || !saved.lines) return false;
  for (const l of saved.lines) { try { C.add(cart, l.id, l.quantity, {}); } catch (e) { /* sold out meanwhile */ } }
  return cart.lines.length > 0;
}

module.exports = { visit, backInStock, orderStatus, restoreCart };
