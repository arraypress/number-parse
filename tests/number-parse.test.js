/**
 * Numbers and prices as people type them and pages show them, checked against
 * the engine's own `Intl` data. The typed grammar's cases come from Tabby for
 * Chrome, where this code started.
 *
 * @module tests/number-parse
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  currencySymbols, decimalMarkOf, decimalSeparator, DISPLAY_NUMBER_SOURCE, ECB_CURRENCIES, ISO_CURRENCIES, NUMBER_SOURCE,
  parseNumber, parsePrice, readNumber, RUPEE_SIGN, SHOP_MARKERS, symbolCharacters, symbolCurrency,
} from '../src/index.js';

/**
 * What the engine itself calls a currency's symbols in English.
 *
 * @param {string} code - ISO 4217.
 * @returns {(string | undefined)[]} Narrow and ordinary symbols.
 */
function intlSymbols(code) {
  return /** @type {const} */ (['narrowSymbol', 'symbol']).map((currencyDisplay) => new Intl.NumberFormat('en', { style: 'currency', currency: code, currencyDisplay })
    .formatToParts(1).find((part) => part.type === 'currency')?.value);
}

describe('decimalSeparator', () => {
  it('reads the locale’s own mark, and "." for one the engine doesn’t know', () => {
    assert.equal(decimalSeparator('en-GB'), '.');
    assert.equal(decimalSeparator('de'), ',');
    assert.equal(decimalSeparator('fr-FR'), ',');
    assert.equal(decimalSeparator('ja'), '.');
    assert.equal(decimalSeparator('not a locale!'), '.');
  });
});

describe('parseNumber (typed)', () => {
  it('lets the locale decide a lone mark that may group thousands', () => {
    assert.equal(parseNumber('1,500', 'en'), 1500);
    assert.equal(parseNumber('1,500', 'de'), 1.5);
    assert.equal(parseNumber('1.500', 'de'), 1500);
    assert.equal(parseNumber('1.500', 'en'), 1.5);
    assert.equal(parseNumber('1,500', { decimal: ',' }), 1.5);
  });

  it('reads a number that can only mean one thing that way, whatever the locale', () => {
    assert.equal(parseNumber('2,4', 'en'), 2.4);
    assert.equal(parseNumber('2,45', 'en'), 2.45);
    assert.equal(parseNumber('0,500', 'en'), 0.5);
    assert.equal(parseNumber('1,500.25', 'de'), 1500.25);
    assert.equal(parseNumber('1.500,25', 'en'), 1500.25);
    assert.equal(parseNumber('1,500,000', 'en'), 1500000);
    assert.equal(parseNumber('.5', 'en'), 0.5);
  });

  it('takes spaces as thousands groups only', () => {
    assert.equal(parseNumber('1 500', 'fr'), 1500);
    assert.equal(parseNumber('1 500,5', 'fr'), 1500.5);
    assert.equal(parseNumber('1 500', 'fr'), 1500);
    assert.equal(parseNumber('15 00', 'fr'), null);
  });

  it('refuses what has no single reading, or isn’t a bare number', () => {
    assert.equal(parseNumber('1,500,000', 'de'), null);
    for (const text of ['', '-5', '5%', '1\'234', '12,34,567', 'abc', '1..5', '$5']) assert.equal(parseNumber(text, 'en'), null, text);
  });

  it('NUMBER_SOURCE embeds in larger patterns, with and without the u flag', () => {
    assert.match('about 1,500 km', new RegExp(`(${NUMBER_SOURCE})\\s*km`));
    assert.equal(new RegExp(`^(${NUMBER_SOURCE})$`, 'u').exec('1 500')?.[1], '1 500');
  });
});

describe('decimalMarkOf', () => {
  it('names the mark a number can only have', () => {
    assert.equal(decimalMarkOf('2,4'), ',');
    assert.equal(decimalMarkOf('1.234,56'), ',');
    assert.equal(decimalMarkOf('1,234.56'), '.');
    assert.equal(decimalMarkOf('1,500,000'), '.');
    assert.equal(decimalMarkOf('1.500.000'), ',');
    assert.equal(decimalMarkOf('12,34,567'), '.');
    assert.equal(decimalMarkOf('1 234,5'), ',');
    assert.equal(decimalMarkOf('€ 0,50'), ',');
  });

  it('says nothing for a number that reads either way, or has no mark', () => {
    assert.equal(decimalMarkOf('1,500'), null);
    assert.equal(decimalMarkOf('1.500'), null);
    assert.equal(decimalMarkOf('1500'), null);
    assert.equal(decimalMarkOf('1 500'), null);
  });
});

describe('readNumber (display)', () => {
  it('reads every grouping pages use', () => {
    assert.equal(readNumber('1,234.56', 'en'), 1234.56);
    assert.equal(readNumber('1.234,56', 'en'), 1234.56);
    assert.equal(readNumber('1 234,56', 'fr'), 1234.56);
    assert.equal(readNumber('1 234,56', 'fr'), 1234.56);
    assert.equal(readNumber('1\'234.56', 'de-CH'), 1234.56);
    assert.equal(readNumber('1’234’567', 'de-CH'), 1234567);
    assert.equal(readNumber('12,34,567', 'en-IN'), 1234567);
    assert.equal(readNumber('1,23,45,678.90', 'en-IN'), 12345678.9);
  });

  it('reads signs and accounting parentheses', () => {
    assert.equal(readNumber('-5', 'en'), -5);
    assert.equal(readNumber('−5', 'en'), -5);
    assert.equal(readNumber('+5', 'en'), 5);
    assert.equal(readNumber('(5)', 'en'), -5);
    assert.equal(readNumber('(1,200.50)', 'en'), -1200.5);
    assert.equal(readNumber('- 3,5', 'de'), -3.5);
    assert.ok(Object.is(readNumber('-0', 'en'), 0));
  });

  it('refuses mixed or broken groups and anything around the number', () => {
    for (const text of ['1,234 567', '1,23,4567', '12 kg', '5%', '--5', '()', '1:30', '1.2.3']) assert.equal(readNumber(text, 'en'), null, text);
  });

  it('DISPLAY_NUMBER_SOURCE has no capturing groups, so it embeds safely', () => {
    assert.equal(new RegExp(DISPLAY_NUMBER_SOURCE).exec('12,34,567')?.length, 1);
  });
});

describe('currencySymbols (built from Intl)', () => {
  it('has the unambiguous sign of every currency that has one', () => {
    const table = currencySymbols();
    for (const [symbol, code] of [
      ['₫', 'VND'], ['₦', 'NGN'], ['₴', 'UAH'], ['₱', 'PHP'], ['₪', 'ILS'], ['₸', 'KZT'], ['₮', 'MNT'], ['₾', 'GEL'],
      ['₺', 'TRY'], ['৳', 'BDT'], ['₽', 'RUB'], ['₭', 'LAK'], ['₲', 'PYG'], ['₡', 'CRC'], ['₼', 'AZN'], ['֏', 'AMD'],
      ['៛', 'KHR'], ['฿', 'THB'], ['€', 'EUR'], ['₹', 'INR'], ['NT$', 'TWD'], ['GH₵', 'GHS'], ['E£', 'EGP'], ['R$', 'BRL'],
    ]) assert.equal(table.get(symbol), code, symbol);
  });

  it('takes each one from the engine’s own data, not a hand-made list', () => {
    const shared = new Set(['$', '£', '¥', '₩']);
    for (const [symbol, code] of currencySymbols()) {
      if (!shared.has(symbol)) assert.ok(intlSymbols(code).includes(symbol), `${symbol} ${code}`);
    }
  });

  it('reads the shared signs the usual way: $ the US dollar, £ sterling, ¥ the yen, ₩ the South Korean won', () => {
    assert.ok(intlSymbols('ARS').includes('$'));
    assert.deepEqual(Object.fromEntries(['$', '£', '¥', '₩'].map((s) => [s, currencySymbols().get(s)])), { $: 'USD', '£': 'GBP', '¥': 'JPY', '₩': 'KRW' });
  });

  it('leaves out letters ("K", "Rs", "kr", "lei", "zł"): in text they are words or initials', () => {
    for (const letters of ['K', 'L', 'Rs', 'kr', 'R', 'lei', 'zł', 'Kč', 'Ft', 'RM', 'Rp', 'Bs', 'Q', 'P']) {
      assert.equal(currencySymbols().has(letters), false, letters);
    }
    assert.doesNotMatch(symbolCharacters(), /\p{L}/u);
    assert.ok(symbolCharacters().includes('₫'));
    assert.ok(symbolCharacters().endsWith(RUPEE_SIGN));
  });

  it('lets only the reader’s currency or region say whose rupee sign ₨ is', () => {
    assert.equal(symbolCurrency('₨', { region: 'PK' }), 'PKR');
    assert.equal(symbolCurrency('₨', { region: 'lk' }), 'LKR');
    assert.equal(symbolCurrency('₨', { region: 'GB', home: 'LKR' }), 'LKR');
    assert.equal(symbolCurrency('₨', { region: 'GB', home: 'GBP' }), null);
    assert.equal(symbolCurrency('₨'), null);
    assert.equal(symbolCurrency('₫'), 'VND');
    assert.equal(symbolCurrency('?'), null);
  });

  it('lists the ECB’s 30 and every ISO code the engine formats', () => {
    assert.equal(ECB_CURRENCIES.length, 30);
    for (const code of ECB_CURRENCIES) assert.ok(ISO_CURRENCIES.has(code), code);
    assert.ok(ISO_CURRENCIES.has('VND'));
    assert.equal(ISO_CURRENCIES.has('XYZ'), false);
  });
});

describe('parsePrice', () => {
  /** @type {[string, import('../src/index.js').PriceOptions, import('../src/index.js').Price][]} */
  const cases = [
    ['$1,299.99', {}, { amount: 1299.99, code: 'USD' }],
    ['US$40', {}, { amount: 40, code: 'USD' }],
    ['CA$15', {}, { amount: 15, code: 'CAD' }],
    ['R$ 50', { locale: 'pt' }, { amount: 50, code: 'BRL' }],
    ['1.299,99 €', { locale: 'de' }, { amount: 1299.99, code: 'EUR' }],
    ['€ 12,50', { locale: 'nl' }, { amount: 12.5, code: 'EUR' }],
    ['12,50 €', {}, { amount: 12.5, code: 'EUR' }],
    ['40 USD', {}, { amount: 40, code: 'USD' }],
    ['JPY 5,000', {}, { amount: 5000, code: 'JPY' }],
    ['£1 200', { locale: 'fr' }, { amount: 1200, code: 'GBP' }],
    ['£1,200', { decimal: ',' }, { amount: 1.2, code: 'GBP' }],
    ['$0', {}, { amount: 0, code: 'USD' }],
    ['100 zł', {}, { amount: 100, code: 'PLN' }],
  ];
  for (const [text, options, expected] of cases) {
    it(`reads ${text}`, () => assert.deepEqual(parsePrice(text, options), expected));
  }

  it('ignores what isn’t one price', () => {
    for (const text of ['40', 'about $40', '$', 'ABC 40', '40 dollars please', '-$5', '₹12,34,567']) assert.equal(parsePrice(text), null, text);
  });

  it('takes a code only when `knows` does (any ISO code by default)', () => {
    assert.deepEqual(parsePrice('100 MAD'), { amount: 100, code: 'MAD' });
    assert.equal(parsePrice('100 MAD', { knows: (code) => code === 'USD' }), null);
    assert.equal(parsePrice('100 XYZ'), null);
  });

  it('asks the reader whose ₨ it is', () => {
    assert.equal(parsePrice('₨500'), null);
    assert.deepEqual(parsePrice('₨500', { reader: { region: 'PK' } }), { amount: 500, code: 'PKR' });
  });

  it('reads shown prices with display: signs, parentheses, Indian and apostrophe groups', () => {
    assert.deepEqual(parsePrice('-$5', { display: true }), { amount: -5, code: 'USD' });
    assert.deepEqual(parsePrice('$-5', { display: true }), { amount: -5, code: 'USD' });
    assert.deepEqual(parsePrice('(US$12.50)', { display: true }), { amount: -12.5, code: 'USD' });
    assert.deepEqual(parsePrice('€ −12,50', { display: true }), { amount: -12.5, code: 'EUR' });
    assert.deepEqual(parsePrice('₹12,34,567', { display: true }), { amount: 1234567, code: 'INR' });
    assert.deepEqual(parsePrice('CHF 1\'234.50', { display: true }), { amount: 1234.5, code: 'CHF' });
    assert.equal(parsePrice('$5 – $10', { display: true }), null);
  });

  it('keeps the shop markers ahead of Intl’s readings', () => {
    assert.deepEqual(SHOP_MARKERS.find(([marker]) => marker === 'C$'), ['C$', 'CAD']);
    assert.deepEqual(parsePrice('C$10'), { amount: 10, code: 'CAD' });
    assert.ok(Object.isFrozen(SHOP_MARKERS[0]));
  });
});
