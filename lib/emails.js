// Transactional e-mails. Table-based with inline styles so they hold up in Gmail, Apple Mail and Outlook.
// Shop name, address and contact e-mail come from lib/shop.js (Theme settings › Company details).
'use strict';
const SHOP = require('./shop');

const C = { pine: '#101B2E', ivory: '#F7F2E8', gold: '#B8975A', ink: '#1F2421', muted: '#5F5B53', line: '#E4DDCF', card: '#FFFFFF' };
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";

const esc = (s) => String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const money = (c) => SHOP.money(Number(c || 0));
const date = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: SHOP.timezone });

function button(href, label) {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0"><tr><td style="border-radius:2px;background:${C.pine}" bgcolor="${C.pine}">
<a href="${esc(href)}" style="display:inline-block;padding:15px 28px;font-family:${FONT};font-size:15px;font-weight:600;line-height:1;color:${C.ivory};text-decoration:none">${label}</a></td></tr></table>`;
}
const h1 = (t) => `<h1 style="margin:0 0 14px;font-family:${SERIF};font-size:27px;line-height:1.2;font-weight:400;color:${C.ink}">${t}</h1>`;
const p = (t) => `<p style="margin:0 0 14px;font-family:${FONT};font-size:15px;line-height:1.6;color:${C.ink}">${t}</p>`;
const small = (t) => `<p style="margin:0 0 8px;font-family:${FONT};font-size:13px;line-height:1.55;color:${C.muted}">${t}</p>`;
const label = (t) => `<p style="margin:0 0 6px;font-family:${FONT};font-size:13px;font-weight:600;color:${C.muted}">${t}</p>`;
const divider = () => `<tr><td class="px" style="padding:0 32px"><div style="height:1px;line-height:1px;background:${C.line}">&nbsp;</div></td></tr>`;
const section = (html, pad = '28px 32px') => `<tr><td class="px" style="padding:${pad}">${html}</td></tr>`;

function layout({ origin, preheader, body, footerNote = '' }) {
  const address = SHOP.address ? esc(SHOP.address).replace(/\n/g, ', ') : '';
  return `<!doctype html><html lang="en" xmlns="http://www.w3.org/1999/xhtml"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><title>${esc(SHOP.name)}</title>
<style>@media (max-width:620px){.wrap{width:100%!important}.px{padding-left:20px!important;padding-right:20px!important}.stack{display:block!important;width:100%!important}}a{color:${C.pine}}</style></head>
<body style="margin:0;padding:0;background:${C.ivory};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${C.ivory}" style="background:${C.ivory}"><tr><td align="center" style="padding:28px 12px 40px">
<table role="presentation" class="wrap" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;max-width:600px">
  <tr><td align="center" bgcolor="${C.pine}" style="background:${C.pine};padding:26px 24px">
    <a href="${origin}" style="text-decoration:none;font-family:${SERIF};font-size:26px;line-height:1;color:${C.ivory}">${esc(SHOP.name)}</a>
  </td></tr>
  <tr><td bgcolor="${C.gold}" style="background:${C.gold};height:3px;line-height:3px;font-size:0">&nbsp;</td></tr>
  <tr><td bgcolor="${C.card}" style="background:${C.card}">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${body}</table>
  </td></tr>
  <tr><td align="center" style="padding:22px 24px 0">
    ${footerNote ? `<p style="margin:0 0 12px;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.muted}">${footerNote}</p>` : ''}
    <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.7;color:${C.muted}">${esc(SHOP.legalName)}${address ? `, ${address}` : ''}<br>
    ${SHOP.email ? `<a href="mailto:${esc(SHOP.email)}" style="color:${C.muted}">${esc(SHOP.email)}</a><br>` : ''}
    <a href="${origin}/pages/terms" style="color:${C.muted}">Terms</a> &nbsp; <a href="${origin}/pages/returns" style="color:${C.muted}">Returns</a> &nbsp; <a href="${origin}/pages/delivery" style="color:${C.muted}">Delivery</a> &nbsp; <a href="${origin}/pages/privacy" style="color:${C.muted}">Privacy</a></p>
  </td></tr>
</table></td></tr></table></body></html>`;
}

// ---------- shared blocks ----------
function lineRows(lines, origin) {
  return lines.map((l) => `
<tr>
  <td width="72" valign="top" style="padding:14px 14px 14px 0;width:72px">${l.image ? `<img src="${esc(String(l.image).startsWith('http') ? l.image : origin + l.image)}" width="60" height="75" alt="" style="display:block;width:60px;height:75px;object-fit:cover;background:${C.ivory}">` : `<div style="width:60px;height:75px;background:${C.ivory}"></div>`}</td>
  <td valign="top" style="padding:14px 10px 14px 0;font-family:${FONT}">
    <p style="margin:0 0 4px;font-size:15px;line-height:1.4;font-weight:600;color:${C.ink}">${l.handle ? `<a href="${origin}/products/${esc(l.handle)}" style="color:${C.ink};text-decoration:none">${esc(l.title)}</a>` : esc(l.title)}</p>
    <p style="margin:0;font-size:13px;color:${C.muted}">Quantity ${l.quantity}${l.quantity > 1 ? `, ${money(l.price)} each` : ''}</p>
    ${l.preorder ? `<p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#7A5F2A">Pre-order${l.release ? `, expected ${esc(l.release)}` : ''}</p>` : ''}
  </td>
  <td valign="top" align="right" style="padding:14px 0;font-family:${FONT};font-size:15px;font-weight:600;color:${C.ink};white-space:nowrap">${money(l.price * l.quantity)}</td>
</tr>
<tr><td colspan="3"><div style="height:1px;line-height:1px;background:${C.line}">&nbsp;</div></td></tr>`).join('');
}
function itemsTable(order, origin) {
  const sum = (k, v, strong) => `<tr><td style="padding:5px 0;font-family:${FONT};font-size:${strong ? 16 : 14}px;color:${C.ink};font-weight:${strong ? 700 : 400}">${k}</td><td align="right" style="padding:5px 0;font-family:${FONT};font-size:${strong ? 18 : 14}px;color:${C.ink};font-weight:${strong ? 700 : 400};white-space:nowrap">${v}</td></tr>`;
  const vat = SHOP.vatRate ? Math.round(order.total - order.total / (1 + SHOP.vatRate / 100)) : 0;
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${lineRows(order.lines, origin)}</table>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:12px">
${sum('Subtotal', money(order.subtotal || order.total))}
${order.discount ? sum('Discount', `−${money(order.discount)}`) : ''}
${sum('Delivery', order.shipping ? money(order.shipping) : 'Free')}
<tr><td colspan="2" style="padding-top:6px"><div style="height:1px;line-height:1px;background:${C.ink}">&nbsp;</div></td></tr>
${sum('Total', money(order.total), true)}
${vat ? `<tr><td colspan="2" style="padding:2px 0 0;font-family:${FONT};font-size:12px;color:${C.muted}">Includes ${money(vat)} VAT at ${SHOP.vatRate}%</td></tr>` : ''}
</table>`;
}
function addressBlock(order) {
  const a = order.address || {};
  return [order.shipName || order.name, a.line1, a.line2, a.city, a.postal_code, a.country === 'GB' || !a.country ? 'United Kingdom' : a.country].filter(Boolean).map(esc).join('<br>');
}
function infoGrid(order) {
  const cell = (t, v) => `<td class="stack" width="50%" valign="top" style="padding:0 12px 18px 0">${label(t)}<p style="margin:0;font-family:${FONT};font-size:14px;line-height:1.55;color:${C.ink}">${v}</p></td>`;
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
<tr>${cell('Delivery address', addressBlock(order) || '–')}${cell('Order', `Number <b>${esc(order.number)}</b><br>${date(order.created)}<br>${esc(order.paymentLabel || 'Paid')}`)}</tr>
</table>`;
}

// ---------- 1. order confirmation (customer) ----------
function orderConfirmation(order, origin) {
  const first = (order.name || '').split(' ')[0];
  const hasPre = order.lines.some((l) => l.preorder);
  const allPre = order.lines.every((l) => l.preorder);
  const shipText = allPre
    ? 'This is a pre-order. We will send it when it arrives with us and email you the tracking details.'
    : hasPre
      ? 'Your order includes pre-order items. We will email you about how it will be sent.'
      : 'We are getting your order ready and will email you the tracking details when it leaves us.';
  const body = `
${section(`${h1(`Thank you${first ? `, ${esc(first)}` : ''}. Your order is confirmed.`)}${p(`Order number <b>${esc(order.number)}</b>. ${shipText}`)}
${hasPre ? small('Payment for pre-order items has been taken. Expected dates are estimates and can change; we will email you if they do. You can cancel a pre-order for a full refund at any time before it is sent.') : ''}`, '30px 32px 14px')}
${section(`${label('Your items')}${itemsTable(order, origin)}`, '8px 32px 22px')}
${divider()}
${section(infoGrid(order), '22px 32px 4px')}
${divider()}
${section(`${small(`You can cancel within 14 days of receiving your order. See <a href="${origin}/pages/returns" style="color:${C.muted}">returns and refunds</a>.`)}${small('A question about your order? Reply to this email.')}`, '20px 32px 26px')}`;
  return { subject: `Order ${order.number} confirmed`, html: layout({ origin, preheader: `Order ${order.number}, total ${money(order.total)}`, body }) };
}

// ---------- 2. dispatch confirmation (customer) ----------
function shippingConfirmation(order, origin, { carrier = '', tracking = '', trackingUrl = '' } = {}) {
  const first = (order.name || '').split(' ')[0];
  const body = `
${section(`${h1(`${first ? `${esc(first)}, your` : 'Your'} order is on its way`)}${p(`Order <b>${esc(order.number)}</b> has left us${carrier ? ` with ${esc(carrier)}` : ''}.`)}
${tracking ? `${p(`Tracking number: <b>${esc(tracking)}</b>`)}${trackingUrl ? button(trackingUrl, 'Track your parcel') : ''}` : ''}`, '30px 32px 14px')}
${section(`${label('In this parcel')}<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${lineRows(order.lines, origin)}</table>`, '8px 32px 22px')}
${divider()}
${section(`${label('Delivery address')}<p style="margin:0;font-family:${FONT};font-size:14px;line-height:1.55;color:${C.ink}">${addressBlock(order)}</p>`, '22px 32px')}
${divider()}
${section(small(`If anything arrives damaged, keep the packaging, take a photo and reply to this email. You can cancel within 14 days of delivery: see <a href="${origin}/pages/returns" style="color:${C.muted}">returns and refunds</a>.`), '20px 32px 26px')}`;
  return { subject: `Your order ${order.number} is on its way`, html: layout({ origin, preheader: tracking ? `Tracking number ${tracking}` : `Order ${order.number} has been sent`, body }) };
}

// ---------- 3. new order (shop owner) ----------
function ownerNewOrder(order, origin, adminUrl) {
  const body = `
${section(`${h1(`New order ${esc(order.number)}`)}${p(`${esc(order.name)} (${esc(order.email)}) has paid <b>${money(order.total)}</b>. ${esc(order.paymentLabel || '')}`)}${button(adminUrl, 'Open in admin')}`, '30px 32px 14px')}
${section(itemsTable(order, origin), '8px 32px 22px')}
${divider()}
${section(infoGrid(order), '22px 32px 14px')}`;
  return { subject: `New order ${order.number} – ${money(order.total)}`, html: layout({ origin, preheader: `${order.name}, ${money(order.total)}`, body }) };
}

// ---------- 4. contact form ----------
function contactAutoReply({ name, body: message }, origin) {
  const first = String(name || '').split(' ')[0];
  const body = section(`${h1('We have your message')}${p(`${first ? `Hello ${esc(first)}, t` : 'T'}hank you for getting in touch. We will reply by email.`)}
${message ? `${label('Your message')}<p style="margin:0 0 14px;padding:14px 16px;background:${C.ivory};font-family:${FONT};font-size:14px;line-height:1.6;color:${C.ink};white-space:pre-wrap">${esc(message)}</p>` : ''}
${small(`Answers to common questions: <a href="${origin}/pages/faq" style="color:${C.muted}">help and FAQ</a>.`)}`, '30px 32px 26px');
  return { subject: `We have your message – ${SHOP.name}`, html: layout({ origin, preheader: 'We will reply by email.', body }) };
}
function ownerContact(fields, origin, kind = 'Contact form') {
  const rows = Object.entries(fields).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `<tr><td valign="top" style="padding:8px 14px 8px 0;font-family:${FONT};font-size:13px;color:${C.muted};white-space:nowrap">${esc(k)}</td><td style="padding:8px 0;font-family:${FONT};font-size:14px;line-height:1.55;color:${C.ink};white-space:pre-wrap">${esc(v)}</td></tr>`).join('');
  const body = section(`${h1(esc(kind))}<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${rows}</table>`, '30px 32px 26px');
  return { subject: `${kind} – ${fields.Email || fields.Name || ''}`, html: layout({ origin, preheader: kind, body }) };
}

// ---------- 5. cancellation: acknowledgement ----------
function withdrawalReceipt(fields, origin, receivedAt) {
  const rows = Object.entries(fields).filter(([, v]) => v).map(([k, v]) => `<tr><td valign="top" style="padding:6px 14px 6px 0;font-family:${FONT};font-size:13px;color:${C.muted};white-space:nowrap">${esc(k)}</td><td style="padding:6px 0;font-family:${FONT};font-size:14px;color:${C.ink}">${esc(v)}</td></tr>`).join('');
  const body = section(`${h1('We have received your cancellation')}${p(`This confirms that we received your cancellation on ${date(receivedAt)}. We will email you with the next steps for sending the goods back and your refund.`)}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 14px">${rows}</table>
${small(`Details: <a href="${origin}/pages/returns" style="color:${C.muted}">returns and refunds</a>.`)}`, '30px 32px 26px');
  return { subject: `Cancellation received – ${SHOP.name}`, html: layout({ origin, preheader: 'We have received your cancellation.', body }) };
}

// ---------- 6. newsletter: double opt-in + welcome ----------
function newsletterConfirm(confirmUrl, origin) {
  const body = section(`${h1('Confirm your email address')}${p(`You asked to receive emails from ${esc(SHOP.name)}. Confirm your address to finish signing up.`)}${button(confirmUrl, 'Confirm my email address')}${small('If you did not ask for this, ignore this email and you will not hear from us.')}`, '30px 32px 26px');
  return { subject: `Confirm your email address – ${SHOP.name}`, html: layout({ origin, preheader: 'One click to finish signing up.', body }) };
}
function newsletterWelcome(origin, unsubscribeUrl) {
  const body = section(`${h1('You are signed up')}${p('We will email you when new collections arrive or a sale starts.')}${button(origin, 'Visit the shop')}`, '30px 32px 26px');
  return { subject: `You are signed up – ${SHOP.name}`, html: layout({ origin, preheader: 'Thanks for confirming.', body, footerNote: `<a href="${esc(unsubscribeUrl)}" style="color:${C.muted}">Unsubscribe</a>` }) };
}

// ---------- 7. basket reminder (sent once, from the admin cron) ----------
function cartReminder(cart, origin) {
  const first = String(cart.name || '').split(' ')[0];
  const body = section(`${h1(`${first ? `${esc(first)}, your` : 'Your'} basket is saved`)}${p('You left the checkout before paying. Your basket is still here if you want to finish your order.')}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${lineRows(cart.lines, origin)}</table>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:10px 0"><tr><td style="padding:8px 0;font-family:${FONT};font-size:15px;font-weight:700;color:${C.ink}">Subtotal</td><td align="right" style="font-family:${FONT};font-size:17px;font-weight:700;color:${C.ink}">${money(cart.total)}</td></tr></table>
${button(`${origin}/checkout?cart=${encodeURIComponent(cart.token)}`, 'Return to checkout')}
${small('You will only get this reminder once.')}`, '30px 32px 26px');
  return { subject: `Your basket at ${SHOP.name} is saved`, html: layout({ origin, preheader: `${cart.lines.length} ${cart.lines.length === 1 ? 'item' : 'items'}, ${money(cart.total)}`, body, footerNote: cart.unsub ? `<a href="${origin}/newsletter/unsubscribe?e=${encodeURIComponent(cart.email)}&t=${cart.unsub}" style="color:${C.muted}">Do not send reminders</a>` : '' }) };
}

// ---------- 8. back in stock ----------
function backInStock(product, origin) {
  const fi = product.featured_image;
  const img = fi && fi.__img && fi.__img.base ? `${origin}/images/${fi.__img.base}-${fi.__img.widths.find((w) => w >= 480) || fi.__img.widths[0]}.webp` : (fi && fi.src && String(fi.src).startsWith('http') ? fi.src : '');
  const body = section(`${h1(`${esc(product.title)} is back in stock`)}${p('You asked us to let you know. It is available again now.')}
${img ? `<a href="${origin}${product.url}"><img src="${esc(img)}" width="320" alt="" style="display:block;width:320px;max-width:100%;height:auto;margin:6px 0 18px"></a>` : ''}
<p style="margin:0 0 14px;font-family:${FONT};font-size:20px;font-weight:700;color:${C.ink}">${money(product.price)}</p>
${button(`${origin}${product.url}`, 'View product')}
${small('You are getting this one message because you asked for a stock alert on the product page.')}`, '30px 32px 26px');
  return { subject: `Back in stock: ${product.title}`, html: layout({ origin, preheader: `${product.title}, ${money(product.price)}`, body }) };
}

module.exports = { cartReminder, backInStock, orderConfirmation, shippingConfirmation, ownerNewOrder, contactAutoReply, ownerContact, withdrawalReceipt, newsletterConfirm, newsletterWelcome, euro: money };
