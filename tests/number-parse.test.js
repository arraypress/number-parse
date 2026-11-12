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
  SUBUNIT_MARKERS, currencyDigits, currencySymbols, decimalMarkOf, decimalSeparator, DISPLAY_NUMBER_SOURCE, ECB_CURRENCIES, findPrices,
  ISO_CURRENCIES, NAMED_NUMBERS, NUMBER_SOURCE, parseNumber, parsePrice, readNumber, RUPEE_SIGN, SHARED_MARKERS, SHOP_MARKERS,
  symbolCharacters, symbolCurrencies, symbolCurrency, westernDigits, WORD_CODES,
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

  it('reads a mark written twice as thousands, even where it is the locale’s decimal mark', () => {
    assert.equal(parseNumber('1,500,000', 'de'), 1500000);
    assert.equal(parseNumber('1.500.000', 'en'), 1500000);
    assert.equal(parseNumber('1.500.000,25', 'en'), 1500000.25);
    assert.equal(readNumber('1.500.000', 'en'), 1500000);
    assert.equal(readNumber('15.000.000', 'ja'), 15000000);
    assert.equal(readNumber('1,500,000', 'de'), 1500000);
    assert.equal(readNumber('12,34,567', 'de'), 1234567);
    assert.equal(readNumber('1.2.3', 'en'), null);
  });

  it('reads the digits of other scripts', () => {
    /** @type {[string, number][]} */
    const cases = [['١٢٣٤', 1234], ['١٬٢٣٤٫٥', 1234.5], ['۱۲۳۴', 1234], ['१२३', 123], ['১২৩', 123], ['๑๒๓', 123], ['１２３', 123], ['１,２３４.５', 1234.5]];
    for (const [text, value] of cases) {
      assert.equal(readNumber(text, 'en'), value, text);
      assert.equal(parseNumber(text, 'en'), value, text);
      assert.equal(westernDigits(text).length, text.length, text);
    }
    assert.equal(westernDigits('١٬٢٣٤٫٥ ر.س'), '1,234.5 ر.س');
    assert.equal(decimalMarkOf('١٫٥'), '.');
    assert.deepEqual(parsePrice('SAR ١٢٣٤'), { amount: 1234, code: 'SAR' });
  });

  it('takes spaces as thousands groups only', () => {
    assert.equal(parseNumber('1 500', 'fr'), 1500);
    assert.equal(parseNumber('1 500,5', 'fr'), 1500.5);
    assert.equal(parseNumber('1 500', 'fr'), 1500);
    assert.equal(parseNumber('15 00', 'fr'), null);
  });

  it('refuses what has no single reading, or isn’t a bare number', () => {
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
    // Parentheses are the minus: a sign inside them doesn't undo it.
    assert.equal(readNumber('(-5)', 'en'), -5);
    assert.equal(readNumber('(−1,200.50)', 'en'), -1200.5);
    assert.deepEqual(parsePrice('(−€5)', { display: true }), { amount: -5, code: 'EUR' });
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

  it('reads a shown price that reads either way as findPrices does', () => {
    assert.deepEqual(parsePrice('50.000₫', { display: true }), { amount: 50000, code: 'VND' });
    assert.deepEqual(parsePrice('Rp 1.500.000', { display: true }), { amount: 1500000, code: 'IDR' });
    assert.deepEqual(parsePrice('€1.299', { display: true }), { amount: 1299, code: 'EUR' });
    assert.deepEqual(parsePrice('$3.459', { display: true }), { amount: 3.459, code: 'USD' });
    // Typed, the locale alone decides, as before.
    assert.deepEqual(parsePrice('€1.299'), { amount: 1.299, code: 'EUR' });
  });

  it('reads the markers shops write that Intl has no symbol for', () => {
    /** @type {[string, string][]} */
    const cases = [['S/. 12.50', 'PEN'], ['sFr. 12.50', 'CHF'], ['JP¥1,200', 'JPY'], ['AR$ 100', 'ARS'], ['Mex$100', 'MXN'], ['RMB 100', 'CNY'], ['100 RMB', 'CNY'], ['100 руб.', 'RUB'], ['100 грн', 'UAH'], ['100đ', 'VND'], ['100 VNĐ', 'VND']];
    for (const [text, code] of cases) assert.equal(parsePrice(text)?.code, code, text);
  });

  it('keeps the shop markers ahead of Intl’s readings', () => {
    assert.deepEqual(SHOP_MARKERS.find(([marker]) => marker === 'C$'), ['C$', 'CAD']);
    assert.deepEqual(parsePrice('C$10'), { amount: 10, code: 'CAD' });
    assert.ok(Object.isFrozen(SHOP_MARKERS[0]));
  });
});

describe('symbolCurrencies', () => {
  it('names the one currency of a shop marker or an unshared symbol', () => {
    assert.deepEqual(symbolCurrencies('CA$'), ['CAD']);
    assert.deepEqual(symbolCurrencies('€'), ['EUR']);
    assert.deepEqual(symbolCurrencies('zł'), ['PLN']);
    assert.deepEqual(symbolCurrencies('RM'), ['MYR']);
  });

  it('lists every currency of a shared one from Intl, the usual reading first', () => {
    const dollars = symbolCurrencies('$');
    assert.equal(dollars[0], 'USD');
    for (const code of ['CAD', 'AUD', 'NZD', 'MXN', 'SGD', 'HKD', 'TWD', 'ARS', 'CLP']) assert.ok(dollars.includes(code), code);
    for (const code of dollars) assert.ok(code === 'USD' || intlSymbols(code).includes('$'), code);
    assert.deepEqual(symbolCurrencies('¥'), ['JPY', 'CNY']);
    assert.deepEqual(symbolCurrencies('kr'), ['DKK', 'ISK', 'NOK', 'SEK']);
    assert.deepEqual(symbolCurrencies('kr.'), symbolCurrencies('kr'));
    assert.ok(symbolCurrencies('Rs.').includes('INR') && symbolCurrencies('Rs').includes('PKR'));
    assert.deepEqual(symbolCurrencies('₨').sort(), ['INR', 'LKR', 'MUR', 'NPR', 'PKR', 'SCR']);
    assert.deepEqual(symbolCurrencies('?'), []);
  });
});

describe('currencyDigits', () => {
  it('is the decimals the engine shows', () => {
    assert.equal(currencyDigits('USD'), 2);
    assert.equal(currencyDigits('JPY'), 0);
    assert.equal(currencyDigits('KRW'), 0);
    assert.equal(currencyDigits('KWD'), 3);
    assert.equal(currencyDigits('nope'), 2);
  });
});

describe('findPrices', () => {
  /**
   * The prices found, short: [text, code, amount, max?].
   *
   * @param {string} text - The text.
   * @param {import('../src/index.js').FindOptions} [options] - Options.
   * @returns {unknown[][]} One row per price.
   */
  const rows = (text, options) => findPrices(text, options).map((p) => (p.max === undefined ? [p.text, p.code, p.amount] : [p.text, p.code, p.amount, p.max]));
  /** Settles "kr" as Danish crowns and "Rs." as rupees, as a Danish or Indian page would. */
  const page = { pick: (/** @type {string} */ marker, /** @type {string[]} */ codes) => (codes.length === 1 ? codes[0] : marker.startsWith('kr') ? 'DKK' : marker.startsWith('Rs') ? 'INR' : codes[0]) };

  /** @type {[string, unknown[][], import('../src/index.js').FindOptions?][]} */
  const cases = [
    ['$1,299.99', [['$1,299.99', 'USD', 1299.99]]],
    ['1.299,99 €', [['1.299,99 €', 'EUR', 1299.99]]],
    ['€1.299,99', [['€1.299,99', 'EUR', 1299.99]]],
    ['£12', [['£12', 'GBP', 12]]],
    ['US$5', [['US$5', 'USD', 5]]],
    ['CA$5', [['CA$5', 'CAD', 5]]],
    ['12,50 zł', [['12,50 zł', 'PLN', 12.5]]],
    ['¥1,200', [['¥1,200', 'JPY', 1200]]],
    ['R$ 10,00', [['R$ 10,00', 'BRL', 10]]],
    ['CHF 12.–', [['CHF 12.–', 'CHF', 12]]],
    ['ab 1.299,– €', [['1.299,– €', 'EUR', 1299]]],
    ['1 234,56 kr', [['1 234,56 kr', 'DKK', 1234.56]], page],
    ['kr. 1.299,00', [['kr. 1.299,00', 'DKK', 1299]], page],
    ['₹1,23,456', [['₹1,23,456', 'INR', 123456]]],
    ['Rs. 499', [['Rs. 499', 'INR', 499]], page],
    ['12.99 USD', [['12.99 USD', 'USD', 12.99]]],
    ['From $49.99', [['$49.99', 'USD', 49.99]]],
    ['Was $59.99, now $49.99', [['$59.99', 'USD', 59.99], ['$49.99', 'USD', 49.99]]],
    ['$49.99 – $59.99', [['$49.99 – $59.99', 'USD', 49.99, 59.99]]],
    ['$10–20', [['$10–20', 'USD', 10, 20]]],
    ['10–20 €', [['10–20 €', 'EUR', 10, 20]]],
    ['£10 to £20', [['£10 to £20', 'GBP', 10, 20]]],
    ['$9.99/mo', [['$9.99', 'USD', 9.99]]],
    ['$12.99 CAD', [['$12.99 CAD', 'CAD', 12.99]]],
    ['12.99 CAD', [['12.99 CAD', 'CAD', 12.99]]],
    ['€1.299', [['€1.299', 'EUR', 1299]]],
    ['$1,500', [['$1,500', 'USD', 1500]]],
    ['1,500 USD', [['1,500 USD', 'USD', 1500]], { locale: 'de' }],
    // A mark written twice groups thousands whatever the page's language.
    ['Rp 1.500.000', [['Rp 1.500.000', 'IDR', 1500000]]],
    ['COP 1.500.000', [['COP 1.500.000', 'COP', 1500000]]],
    ['₫1.200.000', [['₫1.200.000', 'VND', 1200000]]],
    ['1.200.000đ', [['1.200.000đ', 'VND', 1200000]]],
    ['$ 1.250.000', [['$ 1.250.000', 'USD', 1250000]]],
    ['1,500,000 €', [['1,500,000 €', 'EUR', 1500000]], { locale: 'de' }],
    // Three decimals, where the page and the currency's own countries both write that mark for decimals.
    ['Regular $3.459/gal', [['$3.459', 'USD', 3.459]]],
    ['Super E10 1,759 €', [['1,759 €', 'EUR', 1.759]], { locale: 'de' }],
    ['EUR/USD 1.085', [['USD 1.085', 'USD', 1.085]]],
    ['¥1.234', [['¥1.234', 'JPY', 1234]]],
    ['250.000 €', [['250.000 €', 'EUR', 250000]]],
    ['€1,234', [['€1,234', 'EUR', 1234]]],
    ['$1.234', [['$1.234', 'USD', 1234]], { locale: 'es' }],
    // A plain space ends a price where thousands aren't grouped with spaces.
    ['Only $5 200 left in stock', [['$5', 'USD', 5]]],
    ['$10 100% cotton', [['$10', 'USD', 10]]],
    ['€20 365 days', [['€20', 'EUR', 20]]],
    ['$5 200 left, then $6', [['$5', 'USD', 5], ['$6', 'USD', 6]]],
    ['€ 1 234 567', [['€ 1 234 567', 'EUR', 1234567]], { locale: 'fr' }],
    ['R 1 250 000', [], { locale: 'en-ZA' }],
    ['ZAR 1 250 000', [['ZAR 1 250 000', 'ZAR', 1250000]], { locale: 'en-ZA' }],
    ['$1\u00A0234', [['$1\u00A0234', 'USD', 1234]]],
    ['€ 1 234,56', [['€ 1 234,56', 'EUR', 1234.56]]],
    ['2 500 €', [['2 500 €', 'EUR', 2500]]],
    // Digits of other scripts, the text kept as written.
    ['السعر ١٬٢٣٤ SAR', [['١٬٢٣٤ SAR', 'SAR', 1234]]],
    ['１,２００円', [['１,２００円', 'JPY', 1200]]],
    ['₹१,२३,४५६', [['₹१,२३,४५६', 'INR', 123456]]],
    // A sign before the number belongs to a code after it.
    ['$5CAD', [['$5CAD', 'CAD', 5]]],
    ['€5USD', []],
    // A phone number is no range.
    ['Call $1-800-555-1234', [['$1', 'USD', 1]]],
    // Shop markers.
    ['S/. 12.50', [['S/. 12.50', 'PEN', 12.5]]],
    ['1 234 руб.', [['1 234 руб.', 'RUB', 1234]], { locale: 'ru' }],
    ['100 рублей', []],
    ['JP¥1,200', [['JP¥1,200', 'JPY', 1200]]],
    // Codes that still are prices beside the numbers that name something else.
    ['PHP 1,200', [['PHP 1,200', 'PHP', 1200]]],
    ['PHP 49.50', [['PHP 49.50', 'PHP', 49.5]]],
    ['COP 25.000', [['COP 25.000', 'COP', 25000]]],
    ['RON 49,99', [['RON 49,99', 'RON', 49.99]]],
    ['95 RON', [['95 RON', 'RON', 95]]],
    ['5,600 AMD', [['5,600 AMD', 'AMD', 5600]]],
    ['KWD 1.500', [['KWD 1.500', 'KWD', 1.5]]],
    ['AUD $49.95', [['AUD $49.95', 'AUD', 49.95]]],
    ['CLP $12.500', [['CLP $12.500', 'CLP', 12500]]],
    ['UVP 129,99 €', [['129,99 €', 'EUR', 129.99]]],
    ['税込1,200円送料無料', [['1,200円', 'JPY', 1200]]],
    ['価格￥1,200', [['￥1,200', 'JPY', 1200]]],
    ['88元', [['88元', 'CNY', 88]]],
    ['15,000원', [['15,000원', 'KRW', 15000]]],
    ['74.8 ¢/oz', [['74.8 ¢', 'USD', 0.748]]],
    ['99¢', [['99¢', 'USD', 0.99]]],
  ];
  for (const [text, expected, options] of cases) {
    it(`finds ${text}`, () => assert.deepEqual(rows(text, options), expected));
  }

  it('finds nothing in numbers without a marker, words or codes that are words', () => {
    for (const text of ['USD1 stablecoin', 'EUR5 bond', 'GBP2 class', '2026', 'Call 555-1234', '20% off', 'Model X200', 'TOP 10', 'SHOP ALL 50', 'CAD 3D', 'TRY 3 FREE', '$5k', '12 USDT', '4.5 stars', '128 GB', 'A$', 'abc$5']) {
      assert.deepEqual(rows(text), [], text);
    }
    for (const code of WORD_CODES) assert.deepEqual(rows(`${code} 12`), [], code);
    for (const text of ['PHP 8.3 released', 'Requires PHP 8 or later', 'COP 28 in Dubai', 'RON 95 petrol', 'SDG 13 climate action', 'AMD 5600 vs Intel']) {
      assert.deepEqual(rows(text), [], text);
    }
    assert.deepEqual(Object.keys(NAMED_NUMBERS), ['PHP', 'COP', 'RON', 'SDG']);
    assert.deepEqual(Object.keys(SUBUNIT_MARKERS), ['¢']);
  });

  it('leaves a shared letter marker unsettled by default, and gives its every reading', () => {
    const [price] = findPrices('299 kr');
    assert.equal(price.code, null);
    assert.deepEqual(price.codes, ['DKK', 'ISK', 'NOK', 'SEK']);
    assert.ok(SHARED_MARKERS.includes('kr.'));
  });

  it('gives the marker, its place and the text as written', () => {
    const text = 'Now only 1.299,99 € incl. VAT';
    const [price] = findPrices(text, { locale: 'de' });
    assert.equal(price.marker, '€');
    assert.equal(text.slice(price.start, price.end), '1.299,99 €');
  });
});
