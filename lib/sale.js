// Shop-wide sale (Black Friday and the like). Set in theme settings: sale_percent, sale_name, sale_starts, sale_ends.
// While it runs, every price is reduced by sale_percent and the price just before the sale is shown as the "was" price.
// Nothing in data/products.json changes: outside the dates (or with sale_percent 0) the shop is back to normal by itself.
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const strip = (s) => s.replace(/^﻿/, '').replace(/\/\*[\s\S]*?\*\//g, '');
const S = JSON.parse(strip(fs.readFileSync(path.join(ROOT, 'theme', 'config', 'settings_data.json'), 'utf8'))).current;
const J = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'shop.json'), 'utf8'));

const tz = J.timezone || 'Europe/London';
const percent = Math.max(0, Math.min(90, parseInt(S.sale_percent, 10) || 0));
const name = S.sale_name || 'Sale';
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
const starts = isDate(S.sale_starts) ? S.sale_starts : '';
const ends = isDate(S.sale_ends) ? S.sale_ends : '';

const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
const today = () => dayFmt.format(new Date()); // YYYY-MM-DD in shop time

// the instant the day after `ends` begins, in shop time (the sale runs to the end of its last day)
function endsAt() {
  if (!ends) return null;
  const [y, m, d] = ends.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d + 1);
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(new Date(guess)).reduce((a, x) => { a[x.type] = x.value; return a; }, {});
  const shown = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return guess - (shown - guess);
}
const END = endsAt();

// checked on every price read, so the answer is kept for a few seconds
let memo = { at: 0, on: false };
function active() {
  const now = Date.now();
  if (now - memo.at > 5000) {
    const t = today();
    memo = { at: now, on: percent > 0 && (!starts || starts <= t) && (!ends || t <= ends) && (END === null || now < END) };
  }
  return memo.on;
}

const apply = (pence) => (pence === null || pence === undefined || !active() ? pence : Math.round((pence * (100 - percent)) / 100));

function info() {
  const on = active();
  const endDay = ends ? new Date(`${ends}T12:00:00Z`) : null;
  return {
    active: on, percent, name,
    ends, ends_ts: on && END ? END : null,
    ends_label: endDay ? new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(endDay) : '',
  };
}

module.exports = { percent, name, starts, ends, active, apply, info };
