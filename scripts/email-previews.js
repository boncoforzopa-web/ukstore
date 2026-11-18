// Renders every e-mail template with sample data: node scripts/email-previews.js <outDir> [origin]
const fs = require('fs');
const path = require('path');
const T = require('../lib/emails');
const D = require('../lib/data');

const out = process.argv[2] || 'email-previews';
const origin = process.argv[3] || 'https://tawagold.store';
fs.mkdirSync(out, { recursive: true });

const pick = (h) => D.productByHandle(h);
const line = (h, q) => {
  const p = pick(h); const img = p.featured_image;
  return { id: p.variants[0].id, quantity: q, title: p.title, price: p.price, handle: p.handle,
    image: `/images/${img.__img.base}-${img.__img.widths.find((w) => w >= 160) || img.__img.widths[0]}.webp`,
    preorder: p.tags.includes('Pre-order'), release: p.__r.release_date ? p.__r.release_date.split('-').reverse().join('.') : '' };
};
const lines = [line('mega-evolution-delta-reign-booster-box-36-packs-eng', 1), line('burst-protocol-booster-display', 2), line(D.ACTIVE.find((p) => p.tags.includes('Pre-order') && p.__r.release_date).handle, 1)];
const total = lines.reduce((a, l) => a + l.price * l.quantity, 0);
const order = {
  id: 'cs_live_a1B2c3D4e5F6', number: '#1100', created: new Date().toISOString(), email: 'lena.schmidt@example.de', name: 'Lena Schmidt', phone: '',
  shipName: 'Lena Schmidt', address: { line1: 'Kastanienallee 12', line2: '', postal_code: '10435', city: 'Berlin', country: 'DE' },
  subtotal: total, discount: 0, total, paymentLabel: 'Apple Pay · Visa •••• 4242', invoiceUrl: 'https://invoice.stripe.com/i/acct_example', lines,
};

const files = {
  '1-bestellbestaetigung.html': T.orderConfirmation(order, origin),
  '2-versandbestaetigung.html': T.shippingConfirmation(order, origin, { carrier: 'DHL', tracking: '00340434161234567890' }),
  '3-neue-bestellung-inhaber.html': T.ownerNewOrder(order, origin, `${origin}/admin/orders/${order.id}`),
  '4-kontakt-autoantwort.html': T.contactAutoReply({ name: 'Lena Schmidt', body: 'Hallo, kommt die Delta Reign Booster Box noch diese Woche bei mir an? Danke!' }, origin),
  '5-widerruf-eingangsbestaetigung.html': T.withdrawalReceipt({ Name: 'Lena Schmidt', 'E-Mail': 'lena.schmidt@example.de', Bestellnummer: '#1100', Artikel: 'Yu-Gi-Oh! Burst Protocol Booster-Display', 'Bestellt / erhalten am': '06.11.2026 / 08.11.2026' }, origin, new Date().toISOString()),
  '6-newsletter-bestaetigen.html': T.newsletterConfirm(`${origin}/newsletter/confirm?e=lena%40example.de&t=xyz`, origin),
  '7-newsletter-willkommen.html': T.newsletterWelcome(origin, `${origin}/newsletter/unsubscribe?e=lena%40example.de&t=xyz`),
};
for (const [f, m] of Object.entries(files)) fs.writeFileSync(path.join(out, f), m.html);
fs.writeFileSync(path.join(out, 'subjects.json'), JSON.stringify(Object.fromEntries(Object.entries(files).map(([f, m]) => [f, m.subject])), null, 2));
console.log(Object.keys(files).length, 'previews in', out);
