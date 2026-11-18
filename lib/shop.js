// One place for who the shop is: name, contact details, currency, VAT and delivery charges.
// Name and contact details come from the theme settings (theme/config/settings_data.json),
// the rest from data/shop.json. Environment variables override where noted.
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const strip = (s) => s.replace(/^﻿/, '').replace(/\/\*[\s\S]*?\*\//g, '');
const S = JSON.parse(strip(fs.readFileSync(path.join(ROOT, 'theme', 'config', 'settings_data.json'), 'utf8'))).current;
const J = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'shop.json'), 'utf8'));
const int = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; };

const name = S.brand_name || J.name;
const email = process.env.MAIL_TO || S.contact_email || '';
const domain = process.env.SHOP_DOMAIN || '';

function money(pence, { symbol = true, trimZeros = false } = {}) {
  if (pence === null || pence === undefined || pence === '') return '';
  let s = (Number(pence) / 100).toFixed(2);
  if (trimZeros && s.endsWith('.00')) s = s.slice(0, -3);
  const [i, d] = s.split('.');
  const out = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (d !== undefined ? `.${d}` : '');
  return symbol ? `£${out}` : out;
}

module.exports = {
  name,
  legalName: S.legal_name || name,
  email,
  phone: S.contact_phone || '',
  address: S.business_address || '',
  returnsAddress: S.returns_address || S.business_address || '',
  domain,
  currency: J.currencyCode || 'GBP',
  symbol: '£',
  locale: J.locale || 'en-GB',
  country: J.country || 'GB',
  timezone: J.timezone || 'Europe/London',
  vatRate: J.vatRate === undefined ? 20 : J.vatRate,
  // delivery charge in pence; free at or above freeFrom (0 = no free-delivery threshold)
  shipFee: int(process.env.SHIP_FEE_PENCE, int(S.delivery_fee_pence, 0)),
  shipFreeFrom: int(process.env.SHIP_FREE_FROM_PENCE, int(S.free_shipping_threshold, 0) * 100),
  minOrder: int(process.env.MIN_ORDER_CENTS, 0),
  mailFrom: process.env.MAIL_FROM || (email ? `${name} <${email}>` : ''),
  money,
};
