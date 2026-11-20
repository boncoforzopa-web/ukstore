/* Checkout: Stripe Payment Element inside the shop's own page. */

/* Step tracker. Marks Contact, Delivery and Payment as done while the form is filled in, with the same checks the
   submit handler uses, and fills the candy cane between them. Display only: it never blocks or submits anything. */
(function () {
  'use strict';
  var form = document.getElementById('tw-checkout-form'); if (!form) return;
  var root = form.closest('[data-checkout]'), track = form.querySelector('[data-co-track]');
  var steps = Array.prototype.slice.call(form.querySelectorAll('[data-step]'));
  var POST = /^[A-Za-z]{1,2}\d[A-Za-z\d]? ?\d[A-Za-z]{2}$/, MAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function val(n) { var el = form.elements[n]; return el ? String(el.value || '').trim() : ''; }
  function done(name) {
    if (name === 'contact') return MAIL.test(val('email'));
    if (name === 'delivery') return !!(val('firstName') && val('lastName') && val('street').length >= 3 && val('city').length >= 2 && POST.test(val('postalCode')));
    return root.classList.contains('is-pay-complete');
  }
  function update() {
    var inRow = 0, broken = false, all = true;
    steps.forEach(function (st) {
      var name = st.getAttribute('data-step'), ok = done(name);
      st.classList.toggle('is-done', ok);
      var t = track && track.querySelector('[data-track="' + name + '"]'); if (t) t.classList.toggle('is-done', ok);
      if (ok && !broken) inRow++; else broken = true;
      if (!ok) all = false;
    });
    if (track) track.style.setProperty('--p', String(Math.min(inRow, 2) / 2));
    root.classList.toggle('is-ready', all);
  }
  form.addEventListener('input', update); form.addEventListener('change', update);
  document.addEventListener('tw:pay-change', update);
  update(); setTimeout(update, 700); /* browsers fill saved details a moment after load */
})();
(function () {
  'use strict';
  var root = document.querySelector('[data-checkout]');
  if (!root || !window.Stripe) return;
  var form = document.getElementById('tw-checkout-form');
  var pk = root.getAttribute('data-pk');
  var amount = parseInt(root.getAttribute('data-amount'), 10) || 0;
  var subtotal = amount;
  var shipFee = parseInt(root.getAttribute('data-ship-fee'), 10) || 0;
  var shipFree = parseInt(root.getAttribute('data-ship-free'), 10) || 0;
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



  function showError(msg) { errBox.textContent = msg; errBox.hidden = !msg; if (msg) errBox.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  function busy(on) { btn.disabled = on; label.hidden = on; busyEl.hidden = !on; }

  if (!pk) { skel.hidden = true; payErr.textContent = 'Online payment is not available right now. Please try again shortly.'; payErr.hidden = false; btn.disabled = true; return; }

  var stripe = Stripe(pk);
  var pmTypes = (root.getAttribute('data-pm') || 'card').split(',').filter(Boolean);
  var elements = stripe.elements({
    // must match the server PaymentIntent: /api/checkout/intent leaves capture_method unset,
    // which Stripe defaults to 'automatic_async'
    mode: 'payment', amount: amount, currency: 'gbp', captureMethod: 'automatic_async', paymentMethodTypes: pmTypes,
    paymentMethodCreation: 'manual',
    locale: 'en-GB',
    fonts: [{ family: 'Instrument Sans', src: 'url(' + location.origin + '/cdn/shop/t/18/assets/instrument-sans.woff2)', weight: '400 700' }],
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: '#D22436', colorText: '#1D1A16', colorTextSecondary: '#5F5B53', colorBackground: '#FFFFFF', colorDanger: '#A3182D',
        fontFamily: 'Instrument Sans, system-ui, sans-serif', fontSizeBase: '16px', borderRadius: '10px', spacingUnit: '4px'
      },
      rules: {
        '.Input': { border: '1px solid #D9CFBE', padding: '14px 14px', boxShadow: 'none', transition: 'border-color .2s, box-shadow .2s' },
        '.Input:focus': { border: '1px solid #D22436', boxShadow: '0 0 0 4px rgba(210, 36, 54, .14)' },
        '.Label': { fontWeight: '600', fontSize: '14px', color: '#1D1A16' },
        '.AccordionItem': { border: '1px solid #D9CFBE', boxShadow: 'none' },
        '.AccordionItem--selected': { border: '1px solid #D22436', boxShadow: '0 0 0 3px rgba(210, 36, 54, .12)' }
      }
    }
  });
  var pe = elements.create('payment', {
    layout: { type: 'accordion', defaultCollapsed: false, radios: true, spacedAccordionItems: true },
    paymentMethodOrder: ['apple_pay', 'google_pay', 'card', 'paypal', 'amazon_pay'],
    wallets: { applePay: 'auto', googlePay: 'auto', link: 'never' },
    fields: { billingDetails: { name: 'never', email: 'never', phone: 'never', address: 'never' } },
    terms: { card: 'never', applePay: 'never', googlePay: 'never' }
  });
  pe.mount(mount);
  pe.on('change', function (e) { root.classList.toggle('is-pay-complete', !!(e && e.complete)); document.dispatchEvent(new Event('tw:pay-change')); });

  // Delivery: flat charge, free from the threshold when one is set (the server calculates it the same way).
  function fmt(c) { return '£' + (c / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function shipFor() { return shipFee && !(shipFree && subtotal >= shipFree) ? shipFee : 0; }
  (function applyDelivery() {
    var ship = shipFor();
    amount = subtotal + ship;
    try { elements.update({ amount: amount }); } catch (e) {}
    Array.prototype.forEach.call(document.querySelectorAll('[data-co-ship]'), function (el) { el.textContent = ship ? fmt(ship) : 'Free'; });
    Array.prototype.forEach.call(document.querySelectorAll('[data-co-total]'), function (el) { el.textContent = fmt(amount); });
  })();
  pe.on('ready', function () { skel.hidden = true; mount.hidden = false; });
  pe.on('loaderror', function (e) { skel.hidden = true; payErr.textContent = 'The payment fields did not load. Reload the page to try again.'; payErr.hidden = false; console.error(e && e.error); });

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
    return { email: g('email'), firstName: g('firstName'), lastName: g('lastName'), street: g('street'), street2: g('street2'), postalCode: g('postalCode'), city: g('city'), country: g('country') || 'GB', phone: g('phone'), newsletter: d.get('newsletter') === '1', vid: vid };
  }
  function validate(c) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.email)) return 'Enter a valid email address.';
    if (!c.firstName || !c.lastName) return 'Enter your first and last name.';
    if (c.street.length < 3) return 'Enter the first line of your address.';
    if (c.city.length < 2) return 'Enter your town or city.';
    if (!/^[A-Za-z]{1,2}\d[A-Za-z\d]? ?\d[A-Za-z]{2}$/.test(c.postalCode)) return 'Enter a full UK postcode, for example SW1A 1AA.';
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
      if (r.error) throw new Error(r.error.message || 'Check your payment details.');
      var key = JSON.stringify(c) + amount;
      if (intent && intent.key === key) return intent.clientSecret;
      return fetch('/api/checkout/intent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c) })
        .then(function (res) { return res.json().then(function (j) { if (!res.ok || !j.clientSecret) throw new Error(j.error || 'The payment could not be started. Please try again.'); return j; }); })
        .then(function (j) { intent = { clientSecret: j.clientSecret, key: key }; return j.clientSecret; });
    }).then(function (clientSecret) {
      // fields.billingDetails is 'never' on the Payment Element, so Stripe requires
      // EVERY billing field here (incl. state + line2) — empty strings, never undefined.
      // Shipping is NOT passed here: /api/checkout/intent already sets it server-side
      // with the secret key, and Stripe rejects changing it with the publishable key.
      var address = { line1: c.street, line2: c.street2 || '', postal_code: c.postalCode, city: c.city, state: '', country: c.country || 'GB' };
      return stripe.confirmPayment({
        elements: elements, clientSecret: clientSecret, redirect: 'if_required',
        confirmParams: {
          return_url: returnUrl,
          payment_method_data: { billing_details: { name: c.firstName + ' ' + c.lastName, email: c.email, phone: c.phone || '', address: address } }
        }
      });
    }).then(function (r) {
      if (!r) return;
      if (r.error) throw new Error(r.error.message || 'The payment was not confirmed. Please try again.');
      var pi = r.paymentIntent;
      if (pi && (pi.status === 'succeeded' || pi.status === 'processing' || pi.status === 'requires_capture')) {
        window.location.assign(returnUrl + (returnUrl.indexOf('?') > -1 ? '&' : '?') + 'payment_intent=' + encodeURIComponent(pi.id) + '&payment_intent_client_secret=' + encodeURIComponent(pi.client_secret) + '&redirect_status=' + pi.status);
        return;
      }
      throw new Error('The payment was not completed. Please try again.');
    }).catch(function (e) {
      showError(e && e.message ? e.message : 'That did not work. Please try again.');
      busy(false);
    });
  });
})();
