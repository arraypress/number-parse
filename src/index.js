/**
 * Reading numbers and prices the way people and pages write them: "2,4" in
 * German, "1,500.25" in English, "1 234,56" in French, "1'234.56" in Swiss,
 * "12,34,567" in Indian; "US$1,299.99", "1.299,99 €", "JPY 5,000", "₹12,34,567".
 *
 * Two grammars:
 * - typed ({@link NUMBER_SOURCE}, {@link parseNumber}): what somebody types in
 *   a text box. Unsigned, thousands grouped in threes by "," "." or a space.
 * - display ({@link readNumber}): what a page shows in a table or a price
 *   tag. Also apostrophe groups, Indian lakh groups, a sign ("-", "+", "−"
 *   U+2212) and accounting parentheses ("(1,200)" is −1200).
 *
 * The locale decides what a lone comma means ("1,500" is fifteen hundred to a
 * Briton and one and a half to a German); a number that can only be read one
 * way ("2,4", "1.234,5", "1,500,000") is read that way whatever the locale.
 * {@link decimalMarkOf} says which numbers those are, so a caller with many
 * numbers (a table's column) can let the clear ones decide for the rest.
 *
 * Currencies come from the browser's own data (`Intl`): every symbol that
 * names one currency only ("₫", "₦", "NT$"), the fixed readings of shared ones
 * ("$", "£", "¥", "₩"), and the markers shops use where `Intl` disagrees
 * ("US$", "CA$", "C$", "zł").
 *
 * Pure and dependency-free: everything comes from `Intl` and the arguments.
 *
 * @module number-parse
 */

// MARK: - Numbers

/**
 * A decimal mark: "." (English, Chinese, Japanese…) or "," (most of Europe, Latin America…).
 *
 * @typedef {'.' | ','} DecimalMark
 */

/**
 * How to read an ambiguous number: a locale ("en-GB", "de") whose decimal
 * mark is used, or the mark itself.
 *
 * @typedef {string | {decimal: DecimalMark}} Reading
 */

/**
 * The decimal separator a locale writes.
 *
 * @param {string} locale - A BCP 47 tag, e.g. "de-DE". An invalid one reads as ".".
 * @returns {DecimalMark} "." or ",".
 * @example
 * decimalSeparator('fr'); // ','
 * decimalSeparator('en-GB'); // '.'
 */
export function decimalSeparator(locale) {
  try {
    const part = new Intl.NumberFormat(locale).formatToParts(1.5).find((p) => p.type === 'decimal');
    return part?.value === ',' ? ',' : '.';
  } catch {
    return '.';
  }
}

/**
 * A typed number, as a regex source (no anchors, no groups that capture):
 * digits with thousands grouped in threes by ",", ".", a space, a no-break
 * space or a narrow no-break space, and an optional decimal part.
 */
export const NUMBER_SOURCE = String.raw`\d{1,3}(?:[.,\u00A0\u202F ]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?|[.,]\d+`;

const TYPED = new RegExp(`^(?:${NUMBER_SOURCE})$`);

/** Spaces that group thousands: space, no-break space, narrow no-break space, thin space. */
const SPACE_GROUPS = /[ \u00A0\u202F\u2009]/g;

/**
 * A number shown on a page, unsigned, as a regex source (no anchors, no
 * groups that capture). Pages are consistent, so this is stricter than
 * {@link NUMBER_SOURCE} about mixing (one grouping mark throughout, and a
 * decimal mark that differs from it) and looser about the marks: thousands
 * grouped by ",", ".", an apostrophe ("1'234", "1’234") or any space, and
 * Indian grouping ("12,34,567": threes, then twos).
 */
export const DISPLAY_NUMBER_SOURCE = [
  String.raw`\d{1,2}(?:,\d{2})+,\d{3}(?:\.\d+)?`,
  String.raw`\d{1,3}(?:,\d{3})+(?:\.\d+)?`,
  String.raw`\d{1,3}(?:\.\d{3})+(?:,\d+)?`,
  String.raw`\d{1,3}(?:'\d{3})+(?:[.,]\d+)?`,
  String.raw`\d{1,3}(?:’\d{3})+(?:[.,]\d+)?`,
  String.raw`\d{1,3}(?:[ \u00A0\u202F\u2009]\d{3})+(?:[.,]\d+)?`,
  String.raw`\d+(?:[.,]\d+)?|[.,]\d+`,
].join('|');

const DISPLAY = new RegExp(`^(?:${DISPLAY_NUMBER_SOURCE})$`);

/** Apostrophes and spaces only ever group thousands. */
const NON_MARK_GROUPS = /['’ \u00A0\u202F\u2009]/g;

/**
 * Whether the parts of a number split at one mark look like thousands groups:
 * more than two parts ("1,500,000"), or two with three digits after a short,
 * non-zero first part ("1,500", but not "0,500" or "1,5").
 *
 * @param {string[]} parts - The number split at its one mark.
 * @returns {boolean} True when the mark could be grouping thousands.
 */
function looksGrouped(parts) {
  return parts.length > 2 || (parts[1].length === 3 && parts[0].length <= 3 && parts[0] !== '0' && parts[0] !== '');
}

/**
 * The value of digits with "," and "." marks (nothing else), the decimal mark given.
 *
 * - Both marks: whichever comes last is the decimal mark ("1.500,25", "1,500.25").
 * - One mark: a decimal unless it can only group thousands, or it may group
 *   them and isn't the given decimal mark ("1,500" with "." is 1500; with ",", 1.5).
 *
 * @param {string} raw - e.g. "1,500.25".
 * @param {DecimalMark} decimal - The decimal mark for an ambiguous number.
 * @returns {number | null} The value, or null when no reading fits ("1,500,000" with ",").
 */
function fromMarks(raw, decimal) {
  const group = decimal === ',' ? '.' : ',';
  let normalized = raw;
  const hasComma = raw.includes(',');
  const hasDot = raw.includes('.');
  if (hasComma && hasDot) {
    const lastIsComma = raw.lastIndexOf(',') > raw.lastIndexOf('.');
    normalized = lastIsComma ? raw.replaceAll('.', '').replace(',', '.') : raw.replaceAll(',', '');
  } else if (hasComma || hasDot) {
    const mark = hasComma ? ',' : '.';
    const parts = raw.split(mark);
    const isGroup = mark === group && looksGrouped(parts);
    if (isGroup) normalized = parts.join('');
    else if (parts.length === 2) normalized = `${parts[0]}.${parts[1]}`;
    else return null;
  }
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/**
 * The decimal mark of a reading.
 *
 * @param {Reading} reading - A locale, or `{decimal}`.
 * @returns {DecimalMark} The mark.
 */
const markOf = (reading) => (typeof reading === 'string' ? decimalSeparator(reading) : reading.decimal);

/**
 * Parse a typed number ({@link NUMBER_SOURCE}): unsigned, nothing around it.
 *
 * @param {string} text - e.g. "2,4", "1.500", "1,500.25", "1 500".
 * @param {Reading} reading - The locale (or decimal mark) for a number that reads either way.
 * @returns {number | null} The value, or null when it isn't a number.
 * @example
 * parseNumber('1,500', 'en'); // 1500
 * parseNumber('1,500', 'de'); // 1.5
 * parseNumber('2,4', 'en'); // 2.4: it can't be thousands
 * parseNumber('1,500', { decimal: ',' }); // 1.5
 */
export function parseNumber(text, reading) {
  const trimmed = text.trim();
  if (!TYPED.test(trimmed)) return null;
  return fromMarks(trimmed.replace(SPACE_GROUPS, ''), markOf(reading));
}

/**
 * The decimal mark a number can only have been written with, if any: what a
 * caller with many numbers counts to choose a mark for the ambiguous ones.
 *
 * @param {string} text - A number, as on the page ("1.234,5", "1 500", "12,34,567").
 * @returns {DecimalMark | null} The mark; null when it reads either way ("1,500"),
 *   or has no mark at all ("1500").
 * @example
 * decimalMarkOf('2,4'); // ','
 * decimalMarkOf('1,500,000'); // '.'
 * decimalMarkOf('1.234,56'); // ','
 * decimalMarkOf('1,500'); // null
 */
export function decimalMarkOf(text) {
  const raw = text.replace(/[^\d.,]/g, '');
  const hasComma = raw.includes(',');
  const hasDot = raw.includes('.');
  if (hasComma && hasDot) return raw.lastIndexOf(',') > raw.lastIndexOf('.') ? ',' : '.';
  if (!hasComma && !hasDot) return null;
  const mark = hasComma ? ',' : '.';
  const parts = raw.split(mark);
  if (parts.length > 2) return mark === ',' ? '.' : ',';
  return looksGrouped(parts) ? null : mark;
}

/** A sign before a number: plus, hyphen-minus, minus (U+2212), figure dash, en dash. */
const SIGN = /^([+\-−‒–])\s?/;

/**
 * Take a sign and accounting parentheses off the front of a shown number.
 *
 * @param {string} text - e.g. "(1,200)", "−5", "+3".
 * @returns {{negative: boolean, rest: string}} Whether it's negative, and what's left, trimmed.
 */
function peelSign(text) {
  let rest = text.trim();
  let negative = false;
  const parenthesised = /^\((.*)\)$/s.exec(rest);
  if (parenthesised) {
    negative = true;
    rest = parenthesised[1].trim();
  }
  const sign = SIGN.exec(rest);
  if (sign) {
    if (sign[1] !== '+') negative = !negative;
    rest = rest.slice(sign[0].length);
  }
  return { negative, rest };
}

/**
 * An unsigned shown number's value.
 *
 * @param {string} text - Digits and marks only ({@link DISPLAY_NUMBER_SOURCE}).
 * @param {DecimalMark} decimal - For one that reads either way.
 * @returns {number | null} The value.
 */
function unsignedDisplay(text, decimal) {
  return DISPLAY.test(text) ? fromMarks(text.replace(NON_MARK_GROUPS, ''), decimal) : null;
}

/**
 * Read a number as a page shows it ({@link DISPLAY_NUMBER_SOURCE}), with an
 * optional sign or accounting parentheses: nothing else around it.
 *
 * @param {string} text - e.g. "1'234.56", "12,34,567", "−5", "(1,200.00)", "1 234,56".
 * @param {Reading} reading - The locale (or decimal mark) for a number that reads either way.
 * @returns {number | null} The value (never −0), or null when it isn't a number.
 * @example
 * readNumber('(1,200)', 'en'); // -1200
 * readNumber('12,34,567', 'en-IN'); // 1234567
 * readNumber('1 234,56', 'fr'); // 1234.56
 * readNumber('−5', 'en'); // -5
 */
export function readNumber(text, reading) {
  const { negative, rest } = peelSign(text);
  const value = unsignedDisplay(rest, markOf(reading));
  if (value === null) return null;
  return negative && value !== 0 ? -value : value;
}

// MARK: - Currencies

/**
 * The currencies the European Central Bank publishes rates for: a short
 * list of the commonest, for a fallback, or for the codes any text may name.
 */
export const ECB_CURRENCIES = Object.freeze([
  'EUR', 'AUD', 'BRL', 'CAD', 'CHF', 'CNY', 'CZK', 'DKK', 'GBP', 'HKD', 'HUF', 'IDR', 'ILS', 'INR', 'ISK',
  'JPY', 'KRW', 'MXN', 'MYR', 'NOK', 'NZD', 'PHP', 'PLN', 'RON', 'SEK', 'SGD', 'THB', 'TRY', 'USD', 'ZAR',
]);

/**
 * Every current ISO 4217 code the engine can format (the ECB's alone without
 * `Intl.supportedValuesOf`).
 *
 * @type {ReadonlySet<string>}
 */
export const ISO_CURRENCIES = (() => {
  try {
    return new Set(Intl.supportedValuesOf('currency'));
  } catch {
    return new Set(ECB_CURRENCIES);
  }
})();

/**
 * Whose text is being read, for a sign several currencies share (₨).
 *
 * @typedef {object} CurrencyReader
 * @property {string} [home] The reader's own currency, e.g. "LKR".
 * @property {string} [region] ISO 3166 region, e.g. "PK".
 */

/**
 * A currency's symbols in the engine's English currency data, e.g. "₫" or "NT$".
 *
 * @param {string} code - An ISO 4217 code.
 * @returns {Set<string>} Its narrow and ordinary symbols.
 */
function symbolsOf(code) {
  /** @type {Set<string>} */
  const symbols = new Set();
  for (const currencyDisplay of /** @type {const} */ (['narrowSymbol', 'symbol'])) {
    try {
      const part = new Intl.NumberFormat('en', { style: 'currency', currency: code, currencyDisplay })
        .formatToParts(1).find((p) => p.type === 'currency')?.value;
      if (part) symbols.add(part);
    } catch {
      // An engine without narrowSymbol still has "symbol".
    }
  }
  return symbols;
}

/**
 * Symbols several currencies share, with their usual reading: "$" the US
 * dollar ("A$", "NZ$" and friends name the others), "£" sterling, "¥" the
 * yen and "₩" the South Korean won.
 *
 * @type {Readonly<Record<string, string>>}
 */
const SHARED_SYMBOLS = Object.freeze({ $: 'USD', '£': 'GBP', '¥': 'JPY', '₩': 'KRW' });

/**
 * The rupee sign: Pakistan's, Sri Lanka's, Nepal's, Mauritius's and the
 * Seychelles' (and India's before ₹). Only the reader's currency or region
 * can say which.
 */
export const RUPEE_SIGN = '₨';

/** @type {Readonly<Record<string, string>>} */
const RUPEE_BY_REGION = Object.freeze({ PK: 'PKR', LK: 'LKR', NP: 'NPR', MU: 'MUR', SC: 'SCR', IN: 'INR' });

/** @type {Map<string, string> | null} */
let symbolTable = null;

/**
 * Every currency symbol the engine knows that names one currency only, plus
 * the shared ones' usual readings. Built from `Intl` the first time it's
 * needed (about 160 currencies, a few milliseconds), then kept.
 *
 * Only symbols with a currency sign in them (₫, ₦, R$, GH₵): a letter
 * "symbol" like "K", "L", "Rs" or "lei" is a word or an initial in text.
 *
 * @returns {ReadonlyMap<string, string>} Symbol → ISO code, e.g. "₫" → "VND", "NT$" → "TWD".
 */
export function currencySymbols() {
  if (symbolTable) return symbolTable;
  /** @type {Map<string, Set<string>>} */
  const owners = new Map();
  for (const code of ISO_CURRENCIES) {
    for (const symbol of symbolsOf(code)) {
      if (!/\p{Sc}/u.test(symbol) || /\s/.test(symbol)) continue;
      const codes = owners.get(symbol) ?? new Set();
      codes.add(code);
      owners.set(symbol, codes);
    }
  }
  /** @type {Map<string, string>} */
  const table = new Map();
  for (const [symbol, codes] of owners) if (codes.size === 1) table.set(symbol, [...codes][0]);
  for (const [symbol, code] of Object.entries(SHARED_SYMBOLS)) table.set(symbol, code);
  symbolTable = table;
  return table;
}

/**
 * The single-character symbols, for a regex character class: "$£€¥₹₫₦…₨".
 *
 * @returns {string} The characters, the rupee sign last.
 */
export function symbolCharacters() {
  return [...currencySymbols().keys()].filter((symbol) => [...symbol].length === 1).join('') + RUPEE_SIGN;
}

/**
 * The currency a symbol stands for.
 *
 * @param {string} symbol - e.g. "₫", "$", "₨".
 * @param {CurrencyReader} [reader] - Whose text it is, for "₨".
 * @returns {string | null} The ISO code; null for an unknown symbol, or "₨" when nothing says whose.
 * @example
 * symbolCurrency('₫'); // 'VND'
 * symbolCurrency('₨', { region: 'PK' }); // 'PKR'
 */
export function symbolCurrency(symbol, reader) {
  if (symbol === RUPEE_SIGN) {
    const home = reader?.home;
    if (home && Object.values(RUPEE_BY_REGION).includes(home)) return home;
    const region = reader?.region?.toUpperCase();
    return region ? RUPEE_BY_REGION[region] ?? null : null;
  }
  return currencySymbols().get(symbol) ?? null;
}

// MARK: - Prices

/**
 * Price prefixes and suffixes as shops write them, where the engine's
 * symbols disagree or have none: "C$" is Nicaragua's to `Intl` and Canada's
 * to shops; "zł", "Kč" and "Ft" are letters, too risky in running text but
 * plain next to a price.
 *
 * @type {ReadonlyArray<readonly [string, string]>}
 */
export const SHOP_MARKERS = Object.freeze([
  ['US$', 'USD'], ['CA$', 'CAD'], ['C$', 'CAD'], ['AU$', 'AUD'], ['A$', 'AUD'], ['NZ$', 'NZD'],
  ['HK$', 'HKD'], ['S$', 'SGD'], ['R$', 'BRL'], ['MX$', 'MXN'], ['CHF', 'CHF'], ['zł', 'PLN'],
  ['Kč', 'CZK'], ['Ft', 'HUF'],
].map((pair) => Object.freeze(/** @type {const} */ ([pair[0], pair[1]]))));

/** @typedef {readonly [string, string | null]} Marker A marker and its currency (null: the reader decides). */

/** @type {{markers: Marker[], typed: RegExp, display: RegExp} | null} */
let priceGrammar = null;

/**
 * Text as a regex source matching it literally.
 *
 * @param {string} text - Anything.
 * @returns {string} The source.
 */
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Every price marker, longest first (so "US$" wins over "$"): the shops'
 * first, then every symbol only one currency uses, then "₨". Built once.
 *
 * @returns {{markers: Marker[], typed: RegExp, display: RegExp}} The markers and the two price patterns.
 */
function prices() {
  if (priceGrammar) return priceGrammar;
  const markers = [...new Map(/** @type {Marker[]} */ ([
    ...SHOP_MARKERS,
    ...[...currencySymbols()].filter(([symbol]) => !SHOP_MARKERS.some(([m]) => m === symbol)),
    [RUPEE_SIGN, null],
  ]))].sort((a, b) => b[0].length - a[0].length);
  const marker = `${markers.map(([m]) => escapeRegExp(m)).join('|')}|[A-Z]{3}`;
  /** @param {string} number @returns {RegExp} */
  const pattern = (number) => new RegExp(`^(?:(${marker})\\s?(${number})|(${number})\\s?(${marker}))$`, 'u');
  // A shown price may carry a sign after its prefix: "$-5", "€ −12,50".
  priceGrammar = { markers, typed: pattern(NUMBER_SOURCE), display: pattern(`[-−]?\\s?(?:${DISPLAY_NUMBER_SOURCE})`) };
  return priceGrammar;
}

/**
 * How to read a price.
 *
 * @typedef {object} PriceOptions
 * @property {string} [locale] The locale for a number that reads either way. Default "en".
 * @property {DecimalMark} [decimal] The decimal mark itself; wins over `locale`.
 * @property {(code: string) => boolean} [knows] Whether a three-letter code counts as a
 *   currency. Default: any ISO 4217 code ({@link ISO_CURRENCIES}).
 * @property {CurrencyReader} [reader] Whose rupee "₨" is.
 * @property {boolean} [display] Read the number as a page shows it ({@link readNumber}):
 *   apostrophe and Indian groups, a sign or accounting parentheses ("-$5", "$-5",
 *   "(€12.50)"). Default false: a typed, unsigned number.
 */

/**
 * A price's amount and currency.
 *
 * @typedef {object} Price
 * @property {number} amount The amount; negative only with `display`.
 * @property {string} code The ISO 4217 code.
 */

/**
 * Read a price as pages write it: a currency marker (symbol, shop marker or
 * ISO code) before or after a number, with at most one space between.
 *
 * @param {string} text - e.g. "US$1,299.99", "1.299,99 €", "€ 12,50", "40 USD", "R$ 50".
 * @param {PriceOptions} [options] - The locale, which codes count, and the grammar.
 * @returns {Price | null} The price, or null when the text is anything more or less than one.
 * @example
 * parsePrice('1.299,99 €'); // { amount: 1299.99, code: 'EUR' }
 * parsePrice('JPY 5,000'); // { amount: 5000, code: 'JPY' }
 * parsePrice('(US$12.50)', { display: true }); // { amount: -12.5, code: 'USD' }
 */
export function parsePrice(text, { locale = 'en', decimal, knows = (code) => ISO_CURRENCIES.has(code), reader, display = false } = {}) {
  const grammar = prices();
  const peeled = display ? peelSign(text) : { negative: false, rest: text };
  const match = (display ? grammar.display : grammar.typed).exec(peeled.rest.trim().replace(/\s+/g, ' '));
  if (!match) return null;
  const marker = match[1] ?? match[4];
  const digits = match[2] ?? match[3];
  const known = grammar.markers.find(([m]) => m === marker);
  const code = known ? (known[1] ?? symbolCurrency(marker, reader)) : marker;
  if (!code || (!known && !knows(code))) return null;
  const reading = { decimal: decimal ?? decimalSeparator(locale) };
  const amount = display ? readNumber(digits, reading) : parseNumber(digits, reading);
  if (amount === null) return null;
  return { amount: peeled.negative && amount !== 0 ? -amount : amount, code };
}
