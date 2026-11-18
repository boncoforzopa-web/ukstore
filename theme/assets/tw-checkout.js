/* TAWAGOLD checkout: Stripe Payment Element inside the shop's own page. */
(function () {
  'use strict';
  var root = document.querySelector('[data-checkout]');
  if (!root || !window.Stripe) return;
  var form = document.getElementById('tw-checkout-form');
  var pk = root.getAttribute('data-pk');
  var amount = parseInt(root.getAttribute('data-amount'), 10) || 0;
  var subtotal = amount;
  var euFee = parseInt(root.getAttribute('data-eu-fee'), 10) || 0;
  var euFree = parseInt(root.getAttribute('data-eu-free'), 10) || 0;
  var countrySel = form.querySelector('[name="country"]');
  var returnUrl = root.getAttribute('data-return');
  var errBox = form.querySelector('[data-co-error]');
  var payErr = form.querySelector('[data-pay-error]');
  var btn = form.querySelector('[data-co-submit]');
  var label = form.querySelector('[data-co-label]');
  var busyEl = form.querySelector('[data-co-busy]');
  var mount = document.getElementById('tw-payment-element');
  var skel = form.querySelector('[data-pay-skeleton]');
  var mobile = form.querySelector('[data-mobile-summary]');
  var aside = document.querySelector('[data-summary]');
  if (mobile && aside) mobile.appendChild(aside.cloneNode(true));

  function gtag() { if (typeof window.gtag === 'function') window.gtag.apply(null, arguments); }
  gtag('event', 'begin_checkout', { send_to: ['MC-6HE5GH3QKM'], currency: 'EUR', value: amount / 100 });

  function showError(msg) { errBox.textContent = msg; errBox.hidden = !msg; if (msg) errBox.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  function busy(on) { btn.disabled = on; label.hidden = on; busyEl.hidden = !on; }

  if (!pk) { skel.hidden = true; payErr.textContent = 'Die Online-Zahlung ist gerade nicht verfügbar. Bitte versuche es in Kürze erneut.'; payErr.hidden = false; btn.disabled = true; return; }

  var dark = document.documentElement.getAttribute('data-mode') === 'dark';
  var css = getComputedStyle(document.documentElement);
  var v = function (name, fb) { var x = css.getPropertyValue(name).trim(); return x || fb; };
  var fontBase = location.origin;
  var stripe = Stripe(pk);
  var pmTypes = (root.getAttribute('data-pm') || 'card').split(',').filter(Boolean);
  var elements = stripe.elements({
    // must match the server PaymentIntent: /api/checkout/intent leaves capture_method unset,
    // which Stripe now defaults to 'automatic_async'
    mode: 'payment', amount: amount, currency: 'eur', captureMethod: 'automatic_async', paymentMethodTypes: pmTypes,
    paymentMethodCreation: 'manual',
    locale: 'de',
    fonts: [{ family: 'TW Sans', src: 'url(' + fontBase + '/cdn/shop/t/18/assets/manrope-latin-wght-normal.woff2)', weight: '200 800' }],
    appearance: {
      theme: dark ? 'night' : 'stripe',
      variables: {
        colorPrimary: '#FFD60A', colorText: v('--text', '#141A28'), colorTextSecondary: v('--muted', '#4A5368'),
        colorBackground: dark ? '#141A28' : '#FFFFFF', colorDanger: '#C81E25', fontFamily: 'TW Sans, system-ui, sans-serif',
        fontSizeBase: '15px', borderRadius: '14px', spacingUnit: '5px', focusOutline: '0', focusBoxShadow: '0 0 0 4px rgba(255,214,10,.18)'
      },
      rules: {
        '.Input': { border: '1px solid ' + (dark ? 'rgba(255,214,10,.25)' : 'rgba(20,26,40,.18)'), padding: '14px 16px', boxShadow: 'none' },
        '.Input:focus': { border: '1px solid #FFD60A', boxShadow: '0 0 0 4px rgba(255,214,10,.16)' },
        '.Label': { fontWeight: '650', fontSize: '13px', color: v('--muted', '#4A5368') },
        '.Tab': { border: '1px solid ' + (dark ? 'rgba(255,214,10,.25)' : 'rgba(20,26,40,.14)'), borderRadius: '14px' },
        '.Tab--selected': { border: '1px solid #FFD60A', boxShadow: '0 0 0 3px rgba(255,214,10,.2)', color: v('--text', '#141A28') },
        '.AccordionItem': { border: '1px solid ' + (dark ? 'rgba(255,214,10,.22)' : 'rgba(20,26,40,.12)'), borderRadius: '14px', boxShadow: 'none' },
        '.AccordionItem--selected': { border: '1px solid #FFD60A', boxShadow: '0 0 0 3px rgba(255,214,10,.16)', color: v('--text', '#141A28') }
      }
    }
  });
  var pe = elements.create('payment', {
    layout: { type: 'accordion', defaultCollapsed: false, radios: true, spacedAccordionItems: true },
    paymentMethodOrder: ['card', 'apple_pay', 'google_pay', 'klarna', 'paypal', 'amazon_pay'],
    wallets: { applePay: 'auto', googlePay: 'auto', link: 'never' },
    fields: { billingDetails: { name: 'never', email: 'never', phone: 'never', address: 'never' } },
    terms: { card: 'never', klarna: 'never' }
  });
  pe.mount(mount);

  // Shipping: Germany free, other EU countries euFee below euFree (server recalculates the same way).
  function fmt(c) { return (c / 100).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' €'; }
  function shipFor(cc) { return cc === 'DE' || subtotal >= euFree ? 0 : euFee; }
  function applyCountry() {
    var cc = countrySel ? countrySel.value : 'DE';
    var ship = shipFor(cc);
    amount = subtotal + ship;
    try { elements.update({ amount: amount }); } catch (e) {}
    Array.prototype.forEach.call(document.querySelectorAll('[data-co-ship]'), function (el) { el.textContent = ship ? fmt(ship) : 'Kostenlos'; el.classList.toggle('tw-co__free', !ship); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-co-total]'), function (el) { el.textContent = fmt(amount); });
    var eta = document.querySelector('[data-co-eta]');
    if (eta) eta.textContent = cc === 'DE' ? eta.getAttribute('data-de') : eta.getAttribute('data-eu');
    var zip = form.querySelector('[name="postalCode"]');
    if (zip) zip.setAttribute('inputmode', cc === 'DE' ? 'numeric' : 'text');
  }
  if (countrySel) { countrySel.addEventListener('change', applyCountry); applyCountry(); }
  pe.on('ready', function () { skel.hidden = true; mount.hidden = false; });
  pe.on('loaderror', function (e) { skel.hidden = true; payErr.textContent = 'Die Zahlungsfelder konnten nicht geladen werden. Bitte lade die Seite neu.'; payErr.hidden = false; console.error(e && e.error); });
  pe.on('change', function (e) { if (e.complete) gtag('event', 'add_payment_info', { send_to: ['MC-6HE5GH3QKM'], currency: 'EUR', value: amount / 100 }); });

  // abandoned-cart reminder: report e-mail + cart once (again only when it changed)
  var reported = '';
  function reportCart() {
    var c = customer();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.email)) return;
    var payload = JSON.stringify({ email: c.email, name: (c.firstName + ' ' + c.lastName).trim(), vid: c.vid });
    if (payload === reported) return;
    reported = payload;
    fetch('/api/cart-reminder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(function () {});
  }
  form.addEventListener('focusout', reportCart);

  var intent = null; // { clientSecret, amount, key }
  function customer() {
    var d = new FormData(form); var g = function (k) { return String(d.get(k) || '').trim(); };
    var vid = ''; try { vid = sessionStorage.getItem('tw-vid') || ''; } catch (e) {}
    return { email: g('email'), firstName: g('firstName'), lastName: g('lastName'), street: g('street'), street2: g('street2'), postalCode: g('postalCode'), city: g('city'), country: g('country') || 'DE', phone: g('phone'), newsletter: d.get('newsletter') === '1', vid: vid };
  }
  function validate(c) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.email)) return 'Bitte gib eine gültige E-Mail-Adresse ein.';
    if (!c.firstName || !c.lastName) return 'Bitte gib deinen Vor- und Nachnamen ein.';
    if (c.street.length < 3) return 'Bitte gib Straße und Hausnummer ein.';
    if (c.country === 'DE' ? !/^\d{5}$/.test(c.postalCode) : !/^[A-Za-z0-9][A-Za-z0-9 -]{1,8}[A-Za-z0-9]$/.test(c.postalCode)) return c.country === 'DE' ? 'Bitte gib eine fünfstellige Postleitzahl ein.' : 'Bitte gib eine gültige Postleitzahl ein.';
    if (c.city.length < 2) return 'Bitte gib deinen Ort ein.';
    return '';
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    showError('');
    var c = customer();
    var bad = validate(c);
    if (bad) { showError(bad); var first = form.querySelector(':invalid, input[name="email"]'); if (first) first.focus(); return; }
    busy(true);
    elements.submit().then(function (r) {
      if (r.error) throw new Error(r.error.message || 'Bitte prüfe deine Zahlungsangaben.');
      var key = JSON.stringify(c) + amount;
      if (intent && intent.key === key) return intent.clientSecret;
      return fetch('/api/checkout/intent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c) })
        .then(function (res) { return res.json().then(function (j) { if (!res.ok || !j.clientSecret) throw new Error(j.error || 'Die Zahlung konnte nicht gestartet werden.'); return j; }); })
        .then(function (j) { intent = { clientSecret: j.clientSecret, key: key }; return j.clientSecret; });
    }).then(function (clientSecret) {
      // fields.billingDetails is 'never' on the Payment Element, so Stripe requires
      // EVERY billing field here (incl. state + line2) — empty strings, never undefined.
      // Shipping is NOT passed here: /api/checkout/intent already sets it server-side
      // with the secret key, and Stripe rejects changing it with the publishable key.
      var address = { line1: c.street, line2: c.street2 || '', postal_code: c.postalCode, city: c.city, state: '', country: c.country || 'DE' };
      return stripe.confirmPayment({
        elements: elements, clientSecret: clientSecret, redirect: 'if_required',
        confirmParams: {
          return_url: returnUrl,
          payment_method_data: { billing_details: { name: c.firstName + ' ' + c.lastName, email: c.email, phone: c.phone || '', address: address } }
        }
      });
    }).then(function (r) {
      if (!r) return;
      if (r.error) throw new Error(r.error.message || 'Die Zahlung wurde nicht bestätigt. Bitte versuche es erneut.');
      var pi = r.paymentIntent;
      if (pi && (pi.status === 'succeeded' || pi.status === 'processing' || pi.status === 'requires_capture')) {
        window.location.assign(returnUrl + (returnUrl.indexOf('?') > -1 ? '&' : '?') + 'payment_intent=' + encodeURIComponent(pi.id) + '&payment_intent_client_secret=' + encodeURIComponent(pi.client_secret) + '&redirect_status=' + pi.status);
        return;
      }
      throw new Error('Die Zahlung wurde nicht abgeschlossen. Bitte versuche es erneut.');
    }).catch(function (e) {
      showError(e && e.message ? e.message : 'Das hat leider nicht geklappt. Bitte versuche es erneut.');
      busy(false);
    });
  });
})();
