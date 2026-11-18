// Free gift with purchase: from a cart value of €110 the customer gets the
// Ultra PRO Scorching Summit 9-Pocket PRO-Binder for free (€0). The binder is not
// a product of the shop – it can't be bought, isn't in the Google feed and has no stock.
'use strict';

const THRESHOLD = Number(process.env.GIFT_THRESHOLD_CENTS) || 11000; // €110.00
const ID = 'gift-binder-scorching-summit';
const TITLE = 'Ultra PRO Gallery Series – Scorching Summit 9-Pocket PRO-Binder für Pokémon';
const IMAGE = '/gift/scorching-summit-binder-240.jpg';
const IMAGE_LARGE = '/gift/scorching-summit-binder.webp';

const isGift = (l) => !!l && (l.gift === true || String(l.id) === ID);

// What the theme needs: unlocked or not, and how much is still missing.
function state(totalCents) {
  const total = Number(totalCents) || 0;
  const unlocked = total >= THRESHOLD;
  return {
    enabled: true, unlocked, threshold: THRESHOLD, remaining: unlocked ? 0 : THRESHOLD - total,
    progress: Math.min(100, Math.floor((total / THRESHOLD) * 100)),
    title: TITLE, image: IMAGE, image_large: IMAGE_LARGE, price: 0,
  };
}

// Order / cart-reminder line (same shape as checkout.cartLines()).
function line() {
  return { id: ID, gift: true, quantity: 1, title: TITLE, price: 0, handle: '', image: IMAGE, preorder: false, release: '', diffTax: false };
}

// Append the gift line when the (paid) lines reach the threshold. Idempotent.
function withGift(lines, totalCents) {
  const paid = (lines || []).filter((l) => !isGift(l));
  return state(totalCents).unlocked && paid.length ? [...paid, line()] : paid;
}

module.exports = { THRESHOLD, ID, TITLE, IMAGE, IMAGE_LARGE, isGift, state, line, withGift };
