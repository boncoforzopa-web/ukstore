// Gift-with-purchase. Not used by this shop: there is no gift product, so every answer is "off".
// The module stays because carts, orders and e-mails ask it whether a line is a gift.
'use strict';
const ID = 'gift';
const isGift = (l) => !!l && (l.gift === true || String(l.id) === ID);
const state = () => ({ enabled: false, unlocked: false, threshold: 0, remaining: 0, progress: 0 });
const line = () => null;
const withGift = (lines) => (lines || []).filter((l) => !isGift(l));
module.exports = { THRESHOLD: 0, ID, TITLE: '', IMAGE: '', IMAGE_LARGE: '', isGift, state, line, withGift };
