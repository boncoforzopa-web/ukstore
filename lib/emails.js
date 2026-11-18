// Branded transactional e-mails (German). Table-based, inline styles: Gmail, Apple Mail, Outlook, mobile.
'use strict';

const C = { gold: '#FFD60A', goldSoft: '#FFF6C7', ink: '#0E1320', text: '#2A3142', muted: '#6B7385', line: '#E8E4D8', bg: '#F5F2EA', card: '#FFFFFF', green: '#1F9D55', blue: '#2C5BE3' };
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const HEAD = "'Bricolage Grotesque','Arial Black',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

const esc = (s) => String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const euro = (c) => `${(Number(c || 0) / 100).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')} €`;
const date = (d) => new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' });
// delivery window in business days (Mon–Fri), e.g. "Di, 11. Nov. – Do, 13. Nov."
function addBiz(from, n) { const d = new Date(from); let k = 0; while (k < n) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) k++; } return d; }
const shortDate = (d) => d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Berlin' });
function deliveryWindow(from, minDays, maxDays) { return `${shortDate(addBiz(from, minDays))} – ${shortDate(addBiz(from, maxDays))}`; }

function button(href, label, { dark = false } = {}) {
  const bg = dark ? C.ink : C.gold; const fg = dark ? '#FFFFFF' : C.ink;
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0"><tr><td style="border-radius:999px;background:${bg}" bgcolor="${bg}">
<a href="${esc(href)}" style="display:inline-block;padding:15px 30px;font-family:${FONT};font-size:15px;font-weight:700;line-height:1;color:${fg};text-decoration:none;border-radius:999px">${label}</a></td></tr></table>`;
}
function pill(text, color = C.ink, bg = C.goldSoft) {
  return `<span style="display:inline-block;padding:5px 11px;border-radius:999px;background:${bg};color:${color};font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:.3px">${text}</span>`;
}
const h1 = (t) => `<h1 style="margin:0 0 12px;font-family:${HEAD};font-size:28px;line-height:1.15;font-weight:800;color:${C.ink};letter-spacing:-.4px">${t}</h1>`;
const p = (t, style = '') => `<p style="margin:0 0 14px;font-family:${FONT};font-size:15px;line-height:1.6;color:${C.text};${style}">${t}</p>`;
const small = (t) => `<p style="margin:0 0 8px;font-family:${FONT};font-size:12.5px;line-height:1.55;color:${C.muted}">${t}</p>`;
const label = (t) => `<p style="margin:0 0 6px;font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${C.muted}">${t}</p>`;
const divider = () => `<tr><td class="px" style="padding:0 32px"><div style="height:1px;line-height:1px;background:${C.line}">&nbsp;</div></td></tr>`;
const section = (html, pad = '28px 32px') => `<tr><td class="px" style="padding:${pad}">${html}</td></tr>`;

function layout({ origin, preheader, body, footerNote = '' }) {
  const logo = `${origin}/tawa-gold-logo-email.png`;
  return `<!doctype html><html lang="de" xmlns="http://www.w3.org/1999/xhtml"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><title>TAWAGOLD</title>
<style>
@media (max-width:620px){.wrap{width:100%!important}.px{padding-left:20px!important;padding-right:20px!important}.stack{display:block!important;width:100%!important}.hide-sm{display:none!important}.h1{font-size:24px!important}}
a{color:${C.ink}}
</style></head>
<body style="margin:0;padding:0;background:${C.bg};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(preheader)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${C.bg}" style="background:${C.bg}"><tr><td align="center" style="padding:28px 12px 40px">
<table role="presentation" class="wrap" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;max-width:600px">
  <tr><td align="center" bgcolor="${C.ink}" style="background:${C.ink};border-radius:22px 22px 0 0;padding:26px 24px 22px">
    <a href="${origin}" style="text-decoration:none"><img src="${logo}" width="150" alt="TAWA GOLD" style="display:block;width:150px;max-width:150px;height:auto;border:0;margin:0 auto"></a>
    <p style="margin:12px 0 0;font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:2.4px;text-transform:uppercase;color:${C.gold}">Versiegelt · Original · Premium</p>
  </td></tr>
  <tr><td bgcolor="${C.gold}" style="background:${C.gold};height:4px;line-height:4px;font-size:0">&nbsp;</td></tr>
  <tr><td bgcolor="${C.card}" style="background:${C.card};border-radius:0 0 22px 22px">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${body}</table>
  </td></tr>
  <tr><td align="center" style="padding:26px 24px 0">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
      <td style="padding:0 10px;font-family:${FONT};font-size:12px;color:${C.muted}">✓ 100% originalverpackt</td>
      <td class="hide-sm" style="padding:0 10px;font-family:${FONT};font-size:12px;color:${C.muted}">✓ Gratis Versand in DE</td>
      <td style="padding:0 10px;font-family:${FONT};font-size:12px;color:${C.muted}">✓ Versand in die ganze EU</td>
    </tr></table>
    ${footerNote ? `<p style="margin:16px 0 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.muted}">${footerNote}</p>` : ''}
    <p style="margin:16px 0 0;font-family:${FONT};font-size:12px;line-height:1.7;color:${C.muted}">TAWAGOLD · Friedrichstraße 110 · 10117 Berlin · Deutschland<br>
    <a href="mailto:kontakt@tawagold.store" style="color:${C.muted}">kontakt@tawagold.store</a> · <a href="${origin}" style="color:${C.muted}">tawagold.store</a><br>
    <a href="${origin}/pages/agb" style="color:${C.muted}">AGB</a> · <a href="${origin}/pages/widerrufsbelehrung" style="color:${C.muted}">Widerrufsbelehrung</a> · <a href="${origin}/pages/datenschutz" style="color:${C.muted}">Datenschutz</a> · <a href="${origin}/pages/impressum" style="color:${C.muted}">Impressum</a></p>
  </td></tr>
</table></td></tr></table></body></html>`;
}

// ---------- shared blocks ----------
function itemsTable(order, origin) {
  const rows = order.lines.map((l) => `
<tr>
  <td width="76" valign="top" style="padding:14px 14px 14px 0;width:76px">${l.image ? `<img src="${esc(l.image.startsWith('http') ? l.image : origin + l.image)}" width="64" height="64" alt="" style="display:block;width:64px;height:64px;object-fit:contain;border-radius:12px;border:1px solid ${C.line};background:#fff">` : `<div style="width:64px;height:64px;border-radius:12px;background:${C.goldSoft}"></div>`}</td>
  <td valign="top" style="padding:14px 10px 14px 0;font-family:${FONT}">
    <p style="margin:0 0 4px;font-size:14.5px;line-height:1.4;font-weight:700;color:${C.ink}">${l.gift ? esc(l.title) : `<a href="${origin}/products/${esc(l.handle)}" style="color:${C.ink};text-decoration:none">${esc(l.title)}</a>`}</p>
    <p style="margin:0;font-size:13px;color:${C.muted}">Menge: ${l.quantity}${l.quantity > 1 ? ` · je ${euro(l.price)}` : ''}</p>
    ${l.preorder ? `<p style="margin:6px 0 0">${pill(`Vorbestellung${l.release ? ` · Release ${esc(l.release)}` : ''}`, '#7A5A00')}</p>` : ''}
  </td>
  <td valign="top" align="right" style="padding:14px 0;font-family:${FONT};font-size:14.5px;font-weight:700;color:${C.ink};white-space:nowrap">${euro(l.price * l.quantity)}</td>
</tr>
<tr><td colspan="3"><div style="height:1px;line-height:1px;background:${C.line}">&nbsp;</div></td></tr>`).join('');
  const sum = (k, v, strong) => `<tr><td style="padding:5px 0;font-family:${FONT};font-size:${strong ? 16 : 14}px;color:${strong ? C.ink : C.text};font-weight:${strong ? 800 : 400}">${k}</td><td align="right" style="padding:5px 0;font-family:${FONT};font-size:${strong ? 18 : 14}px;color:${C.ink};font-weight:${strong ? 800 : 600};white-space:nowrap">${v}</td></tr>`;
  const vat = Math.round(order.total - order.total / 1.19);
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${rows}</table>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:12px">
${sum('Zwischensumme', euro(order.subtotal || order.total))}
${order.discount ? sum('Rabatt', `−${euro(order.discount)}`) : ''}
${sum('Versand', order.shipping ? euro(order.shipping) : '<span style="color:' + C.green + '">Kostenlos</span>')}
<tr><td colspan="2" style="padding-top:6px"><div style="height:2px;line-height:2px;background:${C.ink}">&nbsp;</div></td></tr>
${sum('Gesamt', euro(order.total), true)}
<tr><td colspan="2" style="padding:2px 0 0;font-family:${FONT};font-size:12px;color:${C.muted}">inkl. ${euro(vat)} MwSt. (19 %)</td></tr>
</table>`;
}
function addressBlock(order) {
  const a = order.address || {};
  const lines = [order.shipName || order.name, a.line1, a.line2, [a.postal_code, a.city].filter(Boolean).join(' '), ({ DE: 'Deutschland', BE: 'Belgien', BG: 'Bulgarien', DK: 'Dänemark', EE: 'Estland', FI: 'Finnland', FR: 'Frankreich', GR: 'Griechenland', IE: 'Irland', IT: 'Italien', HR: 'Kroatien', LV: 'Lettland', LT: 'Litauen', LU: 'Luxemburg', MT: 'Malta', NL: 'Niederlande', AT: 'Österreich', PL: 'Polen', PT: 'Portugal', RO: 'Rumänien', SE: 'Schweden', SK: 'Slowakei', SI: 'Slowenien', ES: 'Spanien', CZ: 'Tschechien', HU: 'Ungarn', CY: 'Zypern' })[a.country] || a.country].filter(Boolean).map(esc).join('<br>');
  return lines;
}
function infoGrid(order) {
  const cell = (t, v) => `<td class="stack" width="50%" valign="top" style="padding:0 12px 18px 0">${label(t)}<p style="margin:0;font-family:${FONT};font-size:14px;line-height:1.55;color:${C.ink}">${v}</p></td>`;
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
<tr>${cell('Lieferadresse', addressBlock(order) || '–')}${cell('Bestellung', `Nr. <b>${esc(order.number)}</b><br>${date(order.created)}<br>${esc(order.paymentLabel || 'Bezahlt')}`)}</tr>
</table>`;
}

// ---------- 1. Bestellbestätigung (Kunde) ----------
function orderConfirmation(order, origin) {
  const first = (order.name || '').split(' ')[0];
  const hasPre = order.lines.some((l) => l.preorder);
  const allPre = order.lines.every((l) => l.preorder);
  const shipText = allPre
    ? 'Deine Vorbestellung ist fest für dich reserviert. Wir versenden sie, sobald das Produkt erschienen ist – du bekommst dann sofort eine Versandbestätigung mit Sendungsnummer.'
    : hasPre
      ? 'Lagernde Artikel und Vorbestellungen verschicken wir gemeinsam, sobald alles erschienen ist. Möchtest du lagernde Artikel früher? Antworte einfach auf diese E-Mail.'
      : 'Wir packen deine Bestellung jetzt sorgfältig mit Kantenschutz ein und verschicken sie innerhalb von 1–2 Werktagen. Sobald das Paket unterwegs ist, bekommst du die Sendungsnummer.';
  const eta = ''; // delivery estimate removed from e-mails on request
  const steps = [
    ['1', 'Bestellt', true], ['2', allPre ? 'Reserviert' : 'Wird gepackt', true], ['3', 'Versendet', false], ['4', 'Zugestellt', false],
  ].map(([n, t, on]) => `<td align="center" width="25%" style="font-family:${FONT}"><div style="width:30px;height:30px;line-height:30px;border-radius:50%;margin:0 auto 6px;background:${on ? C.gold : C.line};color:${C.ink};font-size:13px;font-weight:800">${on ? '✓' : n}</div><span style="font-size:11.5px;font-weight:${on ? 700 : 500};color:${on ? C.ink : C.muted}">${t}</span></td>`).join('');
  const body = `
${section(`${pill(`Bestellung ${esc(order.number)}`)}<div style="height:14px"></div>${h1(`Danke${first ? `, ${esc(first)}` : ''}! Deine Bestellung ist bei uns.`)}${p(shipText)}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:18px 0 6px;background:#FBFAF6;border:1px solid ${C.line};border-radius:16px"><tr><td style="padding:16px 10px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>${steps}</tr></table>${eta ? `<p style="margin:14px 0 0;text-align:center;font-family:${FONT};font-size:13px;color:${C.text}">Voraussichtliche Lieferung: <b style="color:${C.ink}">${eta}</b></p>` : ''}</td></tr></table>
${hasPre ? `<p style="margin:12px 0 0;font-family:${FONT};font-size:13px;line-height:1.55;color:${C.muted}">Hinweis zu Vorbestellungen: Der Betrag wurde bereits abgebucht – damit ist dein Exemplar fest aus unserem Kontingent reserviert. Verschiebt der Hersteller den Termin, informieren wir dich sofort; bis zum Versand kannst du kostenlos stornieren.</p>` : ''}`, '30px 32px 18px')}
${section(`${label('Deine Artikel')}${itemsTable(order, origin)}`, '8px 32px 22px')}
${divider()}
${section(infoGrid(order), '24px 32px 6px')}
${section(`${button(`${origin}/bestellung?nr=${encodeURIComponent(String(order.number || '').replace('#', ''))}&email=${encodeURIComponent(order.email || '')}`, 'Bestellstatus ansehen', { dark: true })}${order.receiptUrl || order.invoiceUrl ? `&nbsp;&nbsp;${button(order.receiptUrl || order.invoiceUrl, order.receiptUrl ? 'Zahlungsbeleg' : 'Rechnung (PDF)')}` : ''}`, '0 32px 22px')}
${section(`<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${C.goldSoft};border-radius:16px"><tr><td style="padding:18px 20px">
<p style="margin:0 0 4px;font-family:${FONT};font-size:14px;font-weight:800;color:${C.ink}">Fragen zu deiner Bestellung?</p>
<p style="margin:0;font-family:${FONT};font-size:13.5px;line-height:1.55;color:${C.text}">Antworte einfach auf diese E-Mail – wir melden uns persönlich, meist noch am selben Tag.</p></td></tr></table>`, '6px 32px 26px')}
${section(small(`Im Anhang findest du unsere AGB, die Widerrufsbelehrung mit Muster-Widerrufsformular und die Vorbestell-Richtlinie als PDF. Du hast ein 14-tägiges Widerrufsrecht ab Erhalt der Ware. Alle Details findest du in unserer <a href="${origin}/pages/widerrufsbelehrung" style="color:${C.muted}">Widerrufsbelehrung</a>; widerrufen kannst du auch direkt online unter <a href="${origin}/pages/vertrag-widerrufen" style="color:${C.muted}">„Vertrag hier widerrufen“</a>. Es gelten unsere <a href="${origin}/pages/agb" style="color:${C.muted}">AGB</a>.`), '0 32px 30px')}`;
  return { subject: `Bestellbestätigung ${order.number} – TAWAGOLD`, html: layout({ origin, preheader: `Danke für deine Bestellung ${order.number} über ${euro(order.total)}.`, body }) };
}

// ---------- 2. Versandbestätigung (Kunde) ----------
function shippingConfirmation(order, origin, { carrier = 'DHL', tracking = '', trackingUrl = '' } = {}) {
  const first = (order.name || '').split(' ')[0];
  const url = trackingUrl || (tracking ? `https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=${encodeURIComponent(tracking)}` : '');
  const body = `
${section(`${pill('📦 Unterwegs zu dir', C.ink, C.goldSoft)}<div style="height:14px"></div>${h1(`${first ? `${esc(first)}, d` : 'D'}ein Paket ist unterwegs!`)}${p(`Deine Bestellung <b>${esc(order.number)}</b> hat unser Lager verlassen. Sorgfältig gepackt mit Kantenschutz – damit alles im Sammlerzustand ankommt.`)}
${tracking ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:18px 0 8px;border:1px solid ${C.line};border-radius:16px"><tr><td style="padding:18px 20px">${label(`Sendungsnummer · ${esc(carrier)}`)}<p style="margin:0 0 12px;font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:18px;font-weight:700;letter-spacing:1px;color:${C.ink}">${esc(tracking)}</p>${url ? button(url, 'Sendung verfolgen') : ''}</td></tr></table>` : ''}
${small(`Voraussichtliche Zustellung: <b style="color:${C.ink}">${deliveryWindow(order.shippedAt || new Date(), 1, 2)}</b>. Nicht da? Der Zusteller hinterlässt eine Benachrichtigung.`)}`, '30px 32px 14px')}
${section(`${label('Im Paket')}${itemsTable(order, origin)}`, '10px 32px 22px')}
${divider()}
${section(infoGrid(order), '24px 32px 10px')}
${section(p('<b>Viel Spaß beim Öffnen!</b> Zeig uns deine Pulls – wir freuen uns über jede Nachricht.', 'margin:0'), '0 32px 30px')}`;
  return { subject: `Deine Bestellung ${order.number} ist unterwegs 📦`, html: layout({ origin, preheader: tracking ? `Sendungsnummer: ${tracking}` : 'Dein Paket ist unterwegs.', body }) };
}

// ---------- 3. Neue Bestellung (Shop-Inhaber) ----------
function ownerNewOrder(order, origin, adminUrl) {
  const body = `
${section(`${pill(`Neue Bestellung · ${euro(order.total)}`, '#FFFFFF', C.green)}<div style="height:14px"></div>${h1(`${esc(order.number)} von ${esc(order.name || order.email)}`)}${p(`${esc(order.email)}${order.phone ? ` · ${esc(order.phone)}` : ''}<br>${esc(order.paymentLabel || '')} · ${date(order.created)}`)}
${adminUrl ? button(adminUrl, 'Bestellung öffnen & versenden', { dark: true }) : ''}`, '30px 32px 12px')}
${section(`${label('Artikel')}${itemsTable(order, origin)}`, '10px 32px 22px')}
${divider()}
${section(infoGrid(order), '24px 32px 10px')}
${section(small(`Stripe: ${esc(order.id)}`), '0 32px 28px')}`;
  return { subject: `🟢 Neue Bestellung ${order.number} – ${euro(order.total)}`, html: layout({ origin, preheader: `${order.lines.length} Artikel · ${order.email}`, body }) };
}

// ---------- 4. Kontakt: Auto-Antwort ----------
function contactAutoReply({ name, body }, origin) {
  const first = String(name || '').split(' ')[0];
  const html = `
${section(`${pill('Nachricht erhalten')}<div style="height:14px"></div>${h1(`Danke${first ? `, ${esc(first)}` : ''} – wir haben deine Nachricht!`)}${p('Wir antworten persönlich und meistens noch am selben Werktag. Du musst nichts weiter tun.')}
${body ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:14px 0;background:#FBFAF6;border-left:4px solid ${C.gold};border-radius:0 12px 12px 0"><tr><td style="padding:14px 18px">${label('Deine Nachricht')}<p style="margin:0;font-family:${FONT};font-size:14px;line-height:1.6;color:${C.text}">${esc(body).replace(/\n/g, '<br>')}</p></td></tr></table>` : ''}
${p('In der Zwischenzeit:', 'margin-top:8px')}
${button(`${origin}/collections/neuheiten`, 'Neuheiten entdecken')}`, '30px 32px 30px')}`;
  return { subject: 'Wir haben deine Nachricht erhalten – TAWAGOLD', html: layout({ origin, preheader: 'Wir melden uns persönlich bei dir.', body: html }) };
}
function ownerContact(fields, origin, kind = 'Kontaktanfrage') {
  const rows = Object.entries(fields).filter(([, v]) => v).map(([k, v]) => `<tr><td valign="top" style="padding:8px 14px 8px 0;font-family:${FONT};font-size:13px;color:${C.muted};white-space:nowrap">${esc(k)}</td><td style="padding:8px 0;font-family:${FONT};font-size:14px;line-height:1.55;color:${C.ink}">${esc(v).replace(/\n/g, '<br>')}</td></tr>`).join('');
  const html = section(`${pill(kind)}<div style="height:12px"></div>${h1(esc(fields.Name || fields['E-Mail'] || kind))}<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${rows}</table>${small('Antworten: einfach auf diese E-Mail antworten (Reply-To ist gesetzt).')}`, '30px 32px 28px');
  return { subject: `${kind}: ${fields.Name || fields['E-Mail'] || ''}`, html: layout({ origin, preheader: kind, body: html }) };
}

// ---------- 5. Widerruf: Eingangsbestätigung ----------
function withdrawalReceipt(fields, origin, receivedAt) {
  const rows = Object.entries(fields).filter(([, v]) => v).map(([k, v]) => `<tr><td valign="top" style="padding:7px 14px 7px 0;font-family:${FONT};font-size:13px;color:${C.muted};white-space:nowrap">${esc(k)}</td><td style="padding:7px 0;font-family:${FONT};font-size:14px;color:${C.ink}">${esc(v).replace(/\n/g, '<br>')}</td></tr>`).join('');
  const when = new Date(receivedAt).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'long', timeStyle: 'short' });
  const html = `
${section(`${pill('Eingangsbestätigung Widerruf')}<div style="height:14px"></div>${h1('Wir haben deinen Widerruf erhalten.')}${p(`Hiermit bestätigen wir den Eingang deiner Widerrufserklärung am <b>${when} Uhr</b>.`)}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:10px 0 16px;border:1px solid ${C.line};border-radius:16px"><tr><td style="padding:16px 20px">${label('Deine Angaben')}<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${rows}</table></td></tr></table>
${label('So geht es weiter')}
${p('1. Sende die Ware bitte innerhalb von 14 Tagen an uns zurück – die Rücksendeadresse schicken wir dir in einer separaten E-Mail.<br>2. Sobald die Ware bei uns ist, erstatten wir den Kaufpreis inkl. ursprünglicher Versandkosten über dein ursprüngliches Zahlungsmittel – spätestens innerhalb von 14 Tagen ab Eingang deines Widerrufs.')}
${small(`Details: <a href="${origin}/pages/widerrufsbelehrung" style="color:${C.muted}">Widerrufsbelehrung</a>. Bewahre diese E-Mail als Nachweis auf.`)}`, '30px 32px 30px')}`;
  return { subject: 'Eingangsbestätigung deines Widerrufs – TAWAGOLD', html: layout({ origin, preheader: `Widerruf eingegangen am ${when}`, body: html }) };
}

// ---------- 6. Newsletter: Double-Opt-in + Willkommen ----------
function newsletterConfirm(confirmUrl, origin) {
  const html = section(`${pill('Nur noch ein Klick')}<div style="height:14px"></div>${h1('Bitte bestätige deine Anmeldung')}${p('Du hast dich für die TAWAGOLD Drop-Alerts angemeldet: neue Sets, Restocks und Vorbestellungen – bevor sie ausverkauft sind.')}
${button(confirmUrl, 'Ja, Anmeldung bestätigen')}
${small('Du hast dich nicht angemeldet? Dann ignoriere diese E-Mail einfach – ohne Bestätigung schicken wir dir nichts.')}`, '30px 32px 30px');
  return { subject: 'Bitte bestätige deine Anmeldung – TAWAGOLD Drop-Alerts', html: layout({ origin, preheader: 'Ein Klick und du verpasst keinen Drop mehr.', body: html }) };
}
function newsletterWelcome(origin, unsubscribeUrl) {
  const tile = (href, t, s) => `<td class="stack" width="33%" valign="top" style="padding:6px"><a href="${origin}${href}" style="display:block;text-decoration:none;background:#FBFAF6;border:1px solid ${C.line};border-radius:14px;padding:14px"><p style="margin:0 0 3px;font-family:${FONT};font-size:14px;font-weight:800;color:${C.ink}">${t}</p><p style="margin:0;font-family:${FONT};font-size:12px;color:${C.muted}">${s}</p></a></td>`;
  const html = `
${section(`${pill('Willkommen im Club ✨')}<div style="height:14px"></div>${h1('Du bist dabei!')}${p('Ab jetzt erfährst du als Erste:r von neuen Drops, Restocks und Vorbestellungen. Kein Spam – nur das, was Sammler wirklich interessiert.')}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 12px"><tr>${tile('/collections/neuheiten', 'Neuheiten', 'Frisch eingetroffen')}${tile('/collections/pre-orders', 'Vorbestellungen', 'Jetzt sichern')}${tile('/collections/bestseller', 'Bestseller', 'Community-Favoriten')}</tr></table>
${button(`${origin}/`, 'Zum Shop')}`, '30px 32px 26px')}`;
  return { subject: 'Willkommen bei TAWAGOLD 🃏', html: layout({ origin, preheader: 'Du verpasst keinen Drop mehr.', body: html, footerNote: unsubscribeUrl ? `Du erhältst diese E-Mail, weil du dich für Drop-Alerts angemeldet hast. <a href="${unsubscribeUrl}" style="color:${C.muted}">Abmelden</a>` : '' }) };
}

// ---------- 8. Abgebrochener Warenkorb ----------
function cartReminder(cart, origin) {
  const first = String(cart.name || '').split(' ')[0];
  const rows = cart.lines.map((l) => `<tr><td width="76" valign="top" style="padding:12px 14px 12px 0">${l.image ? `<img src="${esc(origin + l.image)}" width="64" height="64" alt="" style="display:block;width:64px;height:64px;object-fit:contain;border-radius:12px;border:1px solid ${C.line};background:#fff">` : ''}</td><td valign="top" style="padding:12px 0;font-family:${FONT}"><p style="margin:0 0 3px;font-size:14.5px;font-weight:700;color:${C.ink}">${esc(l.title)}</p><p style="margin:0;font-size:13px;color:${C.muted}">Menge: ${l.quantity}</p></td><td valign="top" align="right" style="padding:12px 0;font-family:${FONT};font-size:14.5px;font-weight:700;color:${C.ink};white-space:nowrap">${euro(l.price * l.quantity)}</td></tr>`).join('');
  const body = `
${section(`${pill('Dein Warenkorb wartet')}<div style="height:14px"></div>${h1(`${first ? `${esc(first)}, d` : 'D'}eine Auswahl ist noch reserviert.`)}${p('Du hast im Checkout aufgehört – kein Problem. Dein Warenkorb ist noch da, und versiegelte Ware wird bei uns schnell knapp. Ein Klick und du bist wieder da, wo du warst.')}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${rows}</table>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:10px"><tr><td style="padding:8px 0;font-family:${FONT};font-size:15px;color:${C.ink}"><b>Gesamt</b> <span style="color:${C.muted};font-size:13px">· Versand in DE kostenlos</span></td><td align="right" style="font-family:${FONT};font-size:17px;font-weight:800;color:${C.ink}">${euro(cart.total)}</td></tr></table>
${button(`${origin}/checkout?cart=${encodeURIComponent(cart.token)}`, 'Bestellung abschließen')}
${small('Fragen vor dem Kauf? Antworte einfach auf diese E-Mail. Du bekommst diese Erinnerung nur einmal.')}`, '30px 32px 26px')}`;
  return { subject: `${first ? `${first}, d` : 'D'}ein Warenkorb bei TAWAGOLD wartet 🃏`, html: layout({ origin, preheader: `${cart.lines.length} Artikel · ${euro(cart.total)} · Versand in DE kostenlos`, body, footerNote: cart.unsub ? `Keine Erinnerungen mehr? <a href="${origin}/newsletter/unsubscribe?e=${encodeURIComponent(cart.email)}&t=${cart.unsub}" style="color:${C.muted}">Abmelden</a>` : '' }) };
}

// ---------- 9. Wieder verfügbar ----------
function backInStock(product, origin) {
  const img = product.featured_image && product.featured_image.__img && product.featured_image.__img.base ? `${origin}/images/${product.featured_image.__img.base}-${product.featured_image.__img.widths.find((w) => w >= 480) || product.featured_image.__img.widths[0]}.webp` : '';
  const body = section(`${pill('Wieder da ✨')}<div style="height:14px"></div>${h1(`${esc(product.title)} ist wieder verfügbar`)}${p('Du wolltest Bescheid wissen – der Artikel ist gerade wieder eingetroffen. Versiegelte Ware ist meist schnell weg, also sichere dir dein Exemplar.')}
${img ? `<a href="${origin}${product.url}"><img src="${img}" width="320" alt="" style="display:block;width:320px;max-width:100%;height:auto;border-radius:16px;margin:6px auto 18px;border:1px solid ${C.line}"></a>` : ''}
<p style="margin:0 0 14px;text-align:center;font-family:${FONT};font-size:22px;font-weight:800;color:${C.ink}">${euro(product.price)} <span style="font-size:13px;font-weight:400;color:${C.muted}">inkl. MwSt., Versand in DE kostenlos</span></p>
<div style="text-align:center">${button(`${origin}${product.url}`, 'Jetzt bestellen')}</div>
${small('Diese Benachrichtigung bekommst du einmalig, weil du dich auf der Produktseite dafür eingetragen hast.')}`, '30px 32px 26px');
  return { subject: `Wieder verfügbar: ${product.title}`, html: layout({ origin, preheader: `${product.title} ist wieder da – ${euro(product.price)}`, body }) };
}

module.exports = { cartReminder, backInStock, orderConfirmation, shippingConfirmation, ownerNewOrder, contactAutoReply, ownerContact, withdrawalReceipt, newsletterConfirm, newsletterWelcome, euro };
