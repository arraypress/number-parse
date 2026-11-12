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

/** The zero of every decimal digit set in the Basic Multilingual Plane that pages write numbers in. */
const DIGIT_ZEROS = Object.freeze([
  0x0660, 0x06F0, 0x07C0, 0x0966, 0x09E6, 0x0A66, 0x0AE6, 0x0B66, 0x0BE6, 0x0C66, 0x0CE6, 0x0D66, 0x0E50, 0x0ED0, 0x0F20,
  0x1040, 0x17E0, 0x1810, 0xFF10,
]);

/** A digit of another script, or an Arabic decimal ("٫") or thousands ("٬") mark. */
const OTHER_DIGITS = /[\u0660-\u0669\u06F0-\u06F9\u07C0-\u07C9\u0966-\u096F\u09E6-\u09EF\u0A66-\u0A6F\u0AE6-\u0AEF\u0B66-\u0B6F\u0BE6-\u0BEF\u0C66-\u0C6F\u0CE6-\u0CEF\u0D66-\u0D6F\u0E50-\u0E59\u0ED0-\u0ED9\u0F20-\u0F29\u1040-\u1049\u17E0-\u17E9\u1810-\u1819\uFF10-\uFF19\u066B\u066C]/g;

/**
 * Text with the digits of other scripts written as "0" to "9": Arabic-Indic
 * ("١٢٣"), Persian ("۱۲۳"), Devanagari ("१२३"), Bengali, Thai, full-width
 * ("１２３") and the rest, with the Arabic decimal mark "٫" as "." and
 * thousands mark "٬" as ",". Every character becomes one character, so a
 * place in the result is the same place in the text. Every reader here
 * ({@link parseNumber}, {@link readNumber}, {@link parsePrice},
 * {@link findPrices}) does this first.
 *
 * @param {string} text - Any text.
 * @returns {string} It with Western digits, the same length.
 * @example
 * westernDigits('١٬٢٣٤٫٥'); // '1,234.5'
 * westernDigits('１２３円'); // '123円'
 */
export function westernDigits(text) {
  return text.replace(OTHER_DIGITS, (character) => {
    if (character === '\u066B') return '.';
    if (character === '\u066C') return ',';
    const point = character.charCodeAt(0);
    const zero = DIGIT_ZEROS.find((start) => point >= start && point <= start + 9) ?? point;
    return String(point - zero);
  });
}

/**
 * A typed number, as a regex source (no anchors, no groups that capture):
 * digits with thousands grouped in threes by ",", ".", a space, a no-break
 * space, a narrow no-break space or a thin space, and an optional decimal part.
 */
export const NUMBER_SOURCE = String.raw`\d{1,3}(?:[.,\u00A0\u202F\u2009 ]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?|[.,]\d+`;

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
 * - One mark, more than once ("1.500.000", "12,34,567"): it groups thousands,
 *   whatever the decimal mark given: a number has one decimal mark at most.
 * - One mark, once: a decimal unless it may group thousands and isn't the
 *   given decimal mark ("1,500" with "." is 1500; with ",", 1.5).
 *
 * @param {string} raw - e.g. "1,500.25".
 * @param {DecimalMark} decimal - The decimal mark for an ambiguous number.
 * @returns {number | null} The value, or null when it isn't a number.
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
    const isGroup = parts.length > 2 || (mark === group && looksGrouped(parts));
    normalized = isGroup ? parts.join('') : `${parts[0]}.${parts[1]}`;
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
  const trimmed = westernDigits(text).trim();
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
  const raw = westernDigits(text).replace(/[^\d.,]/g, '');
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
 * Parentheses mean negative, with or without a minus inside ("(5)" and
 * "(-5)" are both −5).
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
    if (sign[1] !== '+') negative = true;
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
  const { negative, rest } = peelSign(westernDigits(text));
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

/** @type {Map<string, Set<string>> | null} */
let ownerTable = null;

/**
 * Every symbol the engine's English currency data gives, letters included
 * ("kr", "Rs", "lei"), with every currency that writes it. Built once.
 *
 * @returns {ReadonlyMap<string, ReadonlySet<string>>} Symbol → ISO codes.
 */
function symbolOwners() {
  if (ownerTable) return ownerTable;
  /** @type {Map<string, Set<string>>} */
  const owners = new Map();
  for (const code of ISO_CURRENCIES) {
    for (const symbol of symbolsOf(code)) {
      if (/\s/.test(symbol)) continue;
      const codes = owners.get(symbol) ?? new Set();
      codes.add(code);
      owners.set(symbol, codes);
    }
  }
  ownerTable = owners;
  return owners;
}

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
  /** @type {Map<string, string>} */
  const table = new Map();
  for (const [symbol, codes] of symbolOwners()) if (codes.size === 1 && /\p{Sc}/u.test(symbol)) table.set(symbol, [...codes][0]);
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
 * to shops; "zł", "Kč", "Ft", "RM" (Malaysia), "Rp" (Indonesia), "lei"
 * (Romania), "TL" (Turkey), "S/" and "S/." (Peru), "Fr." and "sFr."
 * (Switzerland), "đ" and "VNĐ" (Vietnam), "руб" (Russia), "грн" (Ukraine),
 * "RMB" (China) and the characters for yen, yuan and won ("円", "元", "원")
 * are letters, too risky in running text but plain next to a price; "JP¥",
 * "AR$" and "Mex$" name whose yen or dollar it is.
 *
 * @type {ReadonlyArray<readonly [string, string]>}
 */
export const SHOP_MARKERS = Object.freeze([
  ['US$', 'USD'], ['CA$', 'CAD'], ['C$', 'CAD'], ['AU$', 'AUD'], ['A$', 'AUD'], ['NZ$', 'NZD'],
  ['HK$', 'HKD'], ['S$', 'SGD'], ['R$', 'BRL'], ['MX$', 'MXN'], ['CHF', 'CHF'], ['zł', 'PLN'],
  ['Kč', 'CZK'], ['Ft', 'HUF'], ['RM', 'MYR'], ['Rp', 'IDR'], ['lei', 'RON'], ['TL', 'TRY'],
  ['S/', 'PEN'], ['Fr.', 'CHF'], ['円', 'JPY'], ['元', 'CNY'], ['원', 'KRW'],
  ['S/.', 'PEN'], ['sFr.', 'CHF'], ['JP¥', 'JPY'], ['AR$', 'ARS'], ['Mex$', 'MXN'], ['RMB', 'CNY'],
  ['đ', 'VND'], ['VNĐ', 'VND'], ['руб.', 'RUB'], ['руб', 'RUB'], ['грн', 'UAH'],
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
 *   "(€12.50)"), and a number that reads either way as {@link findPrices} reads it
 *   ("50.000 ₫" is fifty thousand). Default false: a typed, unsigned number.
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
  const source = westernDigits(text);
  const peeled = display ? peelSign(source) : { negative: false, rest: source };
  const match = (display ? grammar.display : grammar.typed).exec(peeled.rest.trim().replace(/\s+/g, ' '));
  if (!match) return null;
  const marker = match[1] ?? match[4];
  const digits = match[2] ?? match[3];
  const known = grammar.markers.find(([m]) => m === marker);
  const code = known ? (known[1] ?? symbolCurrency(marker, reader)) : marker;
  if (!code || (!known && !knows(code))) return null;
  const mark = decimal ?? decimalSeparator(locale);
  const amount = display ? priceAmount(digits, code, mark) : parseNumber(digits, { decimal: mark });
  if (amount === null) return null;
  return { amount: peeled.negative && amount !== 0 ? -amount : amount, code };
}

// MARK: - Prices in text

/**
 * Markers several currencies write that `Intl`'s English data doesn't list
 * as symbols, which pages put next to prices: "kr" (the Swedish, Norwegian,
 * Danish and Icelandic crowns; "kr." in Danish), "Rs" (the rupees of India,
 * Pakistan, Sri Lanka, Nepal and Mauritius) and "￥" (the full-width yen
 * sign, Japan's and China's). Only the page can say which; {@link findPrices}
 * reads them, {@link parsePrice} doesn't.
 */
export const SHARED_MARKERS = Object.freeze(['kr', 'kr.', 'Kr', 'Kr.', 'Rs', 'Rs.', '￥']);

/**
 * Signs of a currency's hundredth, with the currency sign whose currencies
 * they divide: "74.8¢/oz" is 74.8 hundredths of the page's dollar.
 */
export const SUBUNIT_MARKERS = Object.freeze(/** @type {Record<string, string>} */ ({ '¢': '$' }));

/** How the shared markers' other spellings are written in `Intl`. */
const MARKER_SPELLINGS = Object.freeze(/** @type {Record<string, string>} */ ({ 'kr.': 'kr', Kr: 'kr', 'Kr.': 'kr', 'Rs.': 'Rs', '￥': '¥' }));

/** Readings `Intl`'s English data leaves out: India writes "Rs." as often as "₹". */
const MORE_OWNERS = Object.freeze(/** @type {Record<string, readonly string[]>} */ ({ Rs: ['INR'] }));

/**
 * ISO 4217 codes that are also English words or names in capitals ("SHOP ALL
 * 50", "TOP 10", "TRY 3 FREE", "CAD 3D", "2 CUP", "AMD 5600"): {@link findPrices}
 * doesn't take them as currencies unless told to, except the Canadian dollar,
 * the Turkish lira and the Armenian dram after a number ("12.99 CAD"), where
 * they're never words.
 */
export const WORD_CODES = Object.freeze(['ALL', 'AMD', 'BAM', 'BOB', 'BTN', 'CAD', 'CUP', 'GEL', 'MAD', 'MOP', 'PEN', 'SOS', 'TOP', 'TRY']);

/** The {@link WORD_CODES} that are currencies after a number. */
const CODES_AFTER_NUMBERS = Object.freeze(['AMD', 'CAD', 'TRY']);

/**
 * ISO 4217 codes that name something else before certain numbers, with the
 * numbers: a version of PHP ("PHP 8.3"), a climate conference ("COP 28"), a
 * petrol's octane ("RON 95"), a Sustainable Development Goal ("SDG 13").
 * {@link findPrices} takes none of them as a price; the same code before any
 * other number ("PHP 1,200", "COP 25.000", "RON 49,99") still is one.
 *
 * @type {Readonly<Record<string, RegExp>>}
 */
export const NAMED_NUMBERS = Object.freeze({
  PHP: /^\d(?:\.\d)?$/,
  COP: /^\d{1,2}$/,
  RON: /^(?:9\d|10[0-2])$/,
  SDG: /^(?:[1-9]|1[0-7])$/,
});

/**
 * Whether a three-letter code is a currency where it's written.
 *
 * @param {string} code - e.g. "USD", "TOP".
 * @param {'before' | 'after'} place - Before the number ("USD 12") or after it ("12 USD").
 * @returns {boolean} True for an ISO 4217 code that isn't a word there.
 */
const isCurrencyCode = (code, place) => ISO_CURRENCIES.has(code)
  && (!WORD_CODES.includes(code) || (place === 'after' && CODES_AFTER_NUMBERS.includes(code)));

/**
 * Every currency a marker can stand for: one for a shop marker ("US$") or a
 * symbol only one currency writes ("€"); several for a shared one ("$",
 * "¥", "kr", "Rs", "₨"), the usual reading first ("$": USD, then the rest
 * alphabetically). From the engine's own currency data.
 *
 * @param {string} marker - A symbol or shop marker as written: "$", "kr.", "CA$".
 * @returns {string[]} ISO codes; empty for a marker no currency writes.
 * @example
 * symbolCurrencies('kr'); // ['DKK', 'ISK', 'NOK', 'SEK']
 * symbolCurrencies('¥'); // ['JPY', 'CNY']
 * symbolCurrencies('CA$'); // ['CAD']
 */
export function symbolCurrencies(marker) {
  const shop = SHOP_MARKERS.find(([m]) => m === marker);
  if (shop) return [shop[1]];
  if (marker === RUPEE_SIGN) return [...new Set(Object.values(RUPEE_BY_REGION))];
  const symbol = MARKER_SPELLINGS[marker] ?? marker;
  const owners = new Set([...(symbolOwners().get(symbol) ?? []), ...(MORE_OWNERS[symbol] ?? [])]);
  const usual = SHARED_SYMBOLS[symbol];
  const rest = [...owners].filter((code) => code !== usual).sort();
  return usual ? [usual, ...rest] : rest;
}

/** @type {Map<string, number>} */
const digitsCache = new Map();

/**
 * How many decimals a currency's prices show, from the engine's currency
 * data: 2 for most, 0 for the yen or the won, 3 for the Kuwaiti dinar.
 *
 * @param {string} code - An ISO 4217 code.
 * @returns {number} The decimals; 2 for a code the engine doesn't know.
 * @example
 * currencyDigits('JPY'); // 0
 * currencyDigits('KWD'); // 3
 */
export function currencyDigits(code) {
  const known = digitsCache.get(code);
  if (known !== undefined) return known;
  let digits = 2;
  try {
    digits = new Intl.NumberFormat('en', { style: 'currency', currency: code }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    // Not a currency the engine knows.
  }
  digitsCache.set(code, digits);
  return digits;
}

/**
 * A price found in text.
 *
 * @typedef {object} FoundPrice
 * @property {number} start Where it starts in the text.
 * @property {number} end Where it ends (exclusive): `text.slice(start, end)` is it.
 * @property {string} text It, as written: "$49.99", "1.299,99 €", "$10–20".
 * @property {string} marker Its currency marker, as written: "$", "€", "kr", "USD".
 * @property {string[]} codes Every currency the marker can stand for ({@link symbolCurrencies}).
 * @property {string | null} code The currency chosen (`pick`); null when nothing could say.
 * @property {number} amount The amount (the low end of a range).
 * @property {number} [max] A range's high end ("$49.99 – $59.99", "$10–20", "10–20 €").
 */

/**
 * How to read prices in text.
 *
 * @typedef {object} FindOptions
 * @property {string} [locale] The text's locale, for a number that reads either way and whose
 *   currency can't say (see {@link findPrices}). Default "en".
 * @property {DecimalMark} [decimal] The decimal mark itself; wins over `locale`.
 * @property {(code: string, place: 'before' | 'after') => boolean} [knows] Whether a three-letter
 *   code counts as a currency, before the number or after it. Default: any ISO 4217 code but the
 *   {@link WORD_CODES} (the Canadian dollar and the Turkish lira count after a number).
 * @property {(marker: string, codes: string[]) => string | null} [pick] Which currency a marker
 *   stands for. Default: the one there is; for a shared symbol its usual reading ("$" USD, "£"
 *   GBP, "¥" JPY, "₩" KRW), and null for "kr", "Rs" and "₨".
 */

/**
 * What a price can't run into, as a regex class's contents: digits, and the
 * letters of scripts that space their words (Latin, Greek, Cyrillic), so
 * "$5k" and "12 USDT" aren't prices while Japanese and Chinese, which don't
 * space words, can run text up to one ("税込1,200円送料無料").
 */
const WORDISH = '\\p{N}\\p{Script=Latin}\\p{Script=Greek}\\p{Script=Cyrillic}';

/** @type {{pattern: RegExp, number: string} | null} */
let textGrammar = null;

/**
 * The pattern for prices in running text: a marker before or after a shown
 * number ({@link DISPLAY_NUMBER_SOURCE}, or one ending "–" for no cents:
 * "12.–", "12,-"), with at most one space between, and neither part inside a
 * longer word or number. Built once.
 *
 * @returns {{pattern: RegExp, number: string}} The pattern (global) and the number's source.
 */
function inText() {
  if (textGrammar) return textGrammar;
  const markers = [...prices().markers.map(([m]) => m), ...SHARED_MARKERS, ...Object.keys(SUBUNIT_MARKERS)].sort((a, b) => b.length - a.length);
  const marker = `${markers.map(escapeRegExp).join('|')}|[A-Z]{3}`;
  const number = `(?:${DISPLAY_NUMBER_SOURCE})(?:[.,](?:--?|–|—))?`;
  const space = '[ \\u00A0\\u202F\\u2009]?';
  const edge = `(?![${WORDISH}]|[.,]\\p{N})`;
  textGrammar = {
    pattern: new RegExp(`(?<![${WORDISH}])(?:(${marker})${space}(${number})${edge}|(${number})${space}(${marker})(?![${WORDISH}]))`, 'gu'),
    number,
  };
  return textGrammar;
}

/**
 * Currencies whose own countries write "." for the decimal mark (the dollars,
 * sterling, the franc, the yuan, the rupees…): every other currency's write ",".
 */
const DOT_DECIMAL_CURRENCIES = new Set([
  'USD', 'GBP', 'CAD', 'AUD', 'NZD', 'CHF', 'JPY', 'CNY', 'HKD', 'TWD', 'SGD', 'KRW', 'INR', 'PKR', 'LKR', 'BDT', 'NPR',
  'THB', 'MYR', 'PHP', 'MXN', 'ILS', 'AED', 'SAR', 'QAR', 'EGP', 'NGN', 'KES', 'GHS',
]);

/** @type {Map<string, boolean>} */
const spaceGroupCache = new Map();

/**
 * Whether a locale groups thousands with a space ("1 234 567": French,
 * Swedish, Polish, Russian, South African English…).
 *
 * @param {string} locale - A BCP 47 tag; an invalid one doesn't.
 * @returns {boolean} True when it does.
 */
function groupsWithSpaces(locale) {
  const known = spaceGroupCache.get(locale);
  if (known !== undefined) return known;
  let spaces = false;
  try {
    spaces = /^\s$/u.test(new Intl.NumberFormat(locale).formatToParts(1234567).find((part) => part.type === 'group')?.value ?? '');
  } catch {
    // Not a locale the engine knows.
  }
  spaceGroupCache.set(locale, spaces);
  return spaces;
}

/**
 * A shown number's value as a price. A number that reads either way
 * ("1,500", "1.299") groups thousands when the currency has fewer than three
 * decimals (a price of "1,500" US dollars is fifteen hundred, whatever the
 * page's language), unless its mark is the decimal mark of both the page and
 * the currency's own countries: "$3.459" a gallon on an American page and
 * "1,759 €" a litre on a German one are three decimals. With three decimals
 * (the dinars), or no currency, the locale decides. A "–" for the cents is ".00".
 *
 * @param {string} digits - The number as written: "1.299,99", "12.–".
 * @param {string | null} code - The currency, if known.
 * @param {DecimalMark} decimal - The text's decimal mark.
 * @returns {number | null} The amount.
 */
function priceAmount(digits, code, decimal) {
  const plain = digits.replace(/[.,](?:--?|–|—)$/, '');
  const places = code ? currencyDigits(code) : 3;
  if (decimalMarkOf(plain) !== null || !/[.,]\d{3}$/.test(plain) || places >= 3) return readNumber(plain, { decimal });
  /** @type {DecimalMark} */
  const mark = plain.includes(',') ? ',' : '.';
  const home = code && DOT_DECIMAL_CURRENCIES.has(code) ? '.' : ',';
  const isDecimal = places === 2 && mark === decimal && mark === home;
  return readNumber(plain, { decimal: isDecimal ? mark : mark === ',' ? '.' : ',' });
}

/**
 * The usual reading of a marker.
 *
 * @param {string} marker - As written.
 * @param {string[]} codes - Its currencies.
 * @returns {string | null} The one there is, a shared symbol's usual one, or null.
 */
const usualPick = (marker, codes) => (codes.length === 1 ? codes[0] : SHARED_SYMBOLS[SUBUNIT_MARKERS[marker] ?? MARKER_SPELLINGS[marker] ?? marker] ?? null);

/** A number grouped by plain spaces and nothing else ("5 200", "1 000 000"), its first group captured. */
const LOOSE_GROUPS = /^(\d{1,3})(?: \d{3})+$/;

/** Text that carries on after a number: a word or another number, or a percent sign. */
const RUNS_ON = /^(?:\s*[\p{L}\p{N}]|\s?%)/u;

/** A currency code just after a price: "$12.99 CAD". */
const TRAILING_CODE = /^[ \u00A0\u202F\u2009]?([A-Z]{3})(?![\p{L}\p{N}])/u;

/** A currency code just before a shared symbol: "AUD $49.95", "CLP $12.500". */
const LEADING_CODE = /(?<![\p{L}\p{N}])([A-Z]{3})[ \u00A0\u202F\u2009]?$/u;

/** Words and dashes between the two ends of a range. */
const RANGE_GAP = /^\s*(?:[-–—]|to|bis|à|a|até|tot|till|〜|~)\s*$/i;

/**
 * Join prices that make a range: "$49.99 – $59.99", "$10–20", "10–20 €".
 *
 * @param {string} text - The text.
 * @param {FoundPrice[]} found - Its prices, in order.
 * @param {(digits: string, code: string | null) => number | null} amountOf - Reads a bare number in a price's currency.
 * @returns {FoundPrice[]} The prices, ranges joined.
 */
function joinRanges(text, found, amountOf) {
  const { number } = inText();
  // "$1-800-555-1234" is a phone number: a range has two ends.
  const bareAfter = new RegExp(`^\\s?[-–—]\\s?(${number})(?![\\p{L}\\p{N}]|[.,]\\p{N}|[-–—]\\p{N})`, 'u');
  const bareBefore = new RegExp(`(?<![\\p{L}\\p{N}.,])(${number})\\s?[-–—]\\s?$`, 'u');
  /** @type {FoundPrice[]} */
  const joined = [];
  for (const price of found) {
    const last = joined.at(-1);
    if (last && last.max === undefined && last.code === price.code && price.amount > last.amount && RANGE_GAP.test(text.slice(last.end, price.start))) {
      Object.assign(last, { end: price.end, text: text.slice(last.start, price.end), max: price.amount });
      continue;
    }
    const markerFirst = text.startsWith(price.marker, price.start);
    if (markerFirst) {
      const after = bareAfter.exec(text.slice(price.end));
      const max = after && amountOf(after[1], price.code);
      if (after && max !== null && max > price.amount) {
        price.end += after[0].length;
        price.text = text.slice(price.start, price.end);
        price.max = max;
      }
    } else {
      const before = bareBefore.exec(text.slice(last?.end ?? 0, price.start));
      const min = before && amountOf(before[1], price.code);
      if (before && min !== null && min < price.amount) {
        price.start -= before[0].length;
        price.text = text.slice(price.start, price.end);
        price.max = price.amount;
        price.amount = min;
      }
    }
    joined.push(price);
  }
  return joined;
}

/**
 * Every price in a run of text, as a shop page writes it: "From $49.99",
 * "1.299,99 € inkl. MwSt.", "Was £60, now £45", "$10–20", "CHF 12.–",
 * "1 234,56 kr", "₹1,23,456", "12.99 USD", "74.8¢/oz" (0.748 of the dollar). A currency marker (symbol, shop
 * marker, shared letter marker or ISO code) before or after a shown number;
 * a number with no marker is never a price, so years, phone numbers, model
 * numbers and percentages are left alone.
 *
 * Shared markers ("$", "¥", "kr") are the caller's to settle (`pick`): a
 * page can say whose dollars it means.
 *
 * @param {string} text - The text.
 * @param {FindOptions} [options] - The locale, which codes count, and who decides shared markers.
 * @returns {FoundPrice[]} The prices, in order (ranges as one).
 * @example
 * findPrices('Was $59.99, now $49.99');
 * // [{ start: 4, end: 10, text: '$59.99', marker: '$', codes: ['USD', …], code: 'USD', amount: 59.99 }, { …, amount: 49.99 }]
 * findPrices('ab 1.299,– €', { pick: () => 'EUR' })[0].amount; // 1299
 * findPrices('12 kr', { pick: (marker, codes) => (codes.includes('SEK') ? 'SEK' : null) })[0].code; // 'SEK'
 */
export function findPrices(text, { locale = 'en', decimal, knows = isCurrencyCode, pick = usualPick } = {}) {
  const mark = decimal ?? decimalSeparator(locale);
  const spaced = groupsWithSpaces(locale);
  const source = westernDigits(text);
  /** @param {string} digits @param {string | null} code @returns {number | null} */
  const amountOf = (digits, code) => priceAmount(digits, code, mark);
  /** @type {FoundPrice[]} */
  const found = [];
  const { pattern } = inText();
  pattern.lastIndex = 0;
  for (let match = pattern.exec(source); match; match = pattern.exec(source)) {
    const marker = match[1] ?? match[4];
    let digits = match[2] ?? match[3];
    const isCode = /^[A-Z]{3}$/.test(marker) && !SHOP_MARKERS.some(([m]) => m === marker);
    // A code runs into the number after it only in names ("USD1", a coin; "EUR5" a model): a price spaces it.
    const glued = isCode && match[1] && !/\s/.test(source.charAt(match.index + marker.length));
    const named = isCode && match[1] && NAMED_NUMBERS[marker]?.test(digits);
    if (isCode && (glued || named || !knows(marker, match[1] ? 'before' : 'after'))) {
      // "UVP 129,99 €": the word isn't a currency, but what follows it may be a price.
      if (match[1]) pattern.lastIndex = match.index + marker.length;
      continue;
    }
    const subunit = SUBUNIT_MARKERS[marker];
    const codes = isCode ? [marker] : symbolCurrencies(subunit ?? marker);
    if (!codes.length) continue;
    let start = match.index;
    let end = start + match[0].length;
    // "Only $5 200 left", "$10 100% cotton": where thousands aren't grouped with spaces, a plain space after a price
    // ends it when more words follow. A price on its own ("₴1 299") is a price in a language the page didn't name.
    const first = match[1] && !spaced && RUNS_ON.test(source.slice(end)) ? LOOSE_GROUPS.exec(digits) : null;
    if (first) {
      end -= digits.length - first[1].length;
      digits = first[1];
      pattern.lastIndex = end;
    }
    // "$5CAD": the sign before the number is the price's too, when it can be that currency's.
    const sign = match[1] ? '' : source.charAt(start - 1);
    if (/\p{Sc}/u.test(sign)) {
      if (!isCode || !symbolCurrencies(sign).includes(marker)) continue;
      start -= 1;
    }
    // "$12.99 CAD", "AUD $49.95": a code beside a shared symbol says whose it is.
    const trailing = codes.length > 1 && match[1] ? TRAILING_CODE.exec(source.slice(end)) : null;
    const leading = codes.length > 1 && match[1] && !(trailing && codes.includes(trailing[1])) ? LEADING_CODE.exec(source.slice(0, start)) : null;
    let code = pick(marker, codes);
    if (trailing && codes.includes(trailing[1])) {
      code = trailing[1];
      end += trailing[0].length;
    } else if (leading && codes.includes(leading[1])) {
      code = leading[1];
      start -= leading[0].length;
    }
    const whole = amountOf(digits, code);
    if (whole === null) continue;
    const amount = subunit ? Math.round(whole * 1e4) / 1e6 : whole;
    found.push({ start, end, text: source.slice(start, end), marker, codes, code, amount });
  }
  // Each price as the text writes it, whatever digits it uses.
  return joinRanges(source, found, amountOf).map((price) => ({ ...price, text: text.slice(price.start, price.end) }));
}
