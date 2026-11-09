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
export type DecimalMark = '.' | ',';
export type Reading = string | {
    decimal: DecimalMark;
};
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
export declare function decimalSeparator(locale: string): DecimalMark;
/**
 * A typed number, as a regex source (no anchors, no groups that capture):
 * digits with thousands grouped in threes by ",", ".", a space, a no-break
 * space or a narrow no-break space, and an optional decimal part.
 */
export declare const NUMBER_SOURCE: string;
/**
 * A number shown on a page, unsigned, as a regex source (no anchors, no
 * groups that capture). Pages are consistent, so this is stricter than
 * {@link NUMBER_SOURCE} about mixing (one grouping mark throughout, and a
 * decimal mark that differs from it) and looser about the marks: thousands
 * grouped by ",", ".", an apostrophe ("1'234", "1’234") or any space, and
 * Indian grouping ("12,34,567": threes, then twos).
 */
export declare const DISPLAY_NUMBER_SOURCE: string;
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
export declare function parseNumber(text: string, reading: Reading): number | null;
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
export declare function decimalMarkOf(text: string): DecimalMark | null;
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
export declare function readNumber(text: string, reading: Reading): number | null;
/**
 * The currencies the European Central Bank publishes rates for: a short
 * list of the commonest, for a fallback, or for the codes any text may name.
 */
export declare const ECB_CURRENCIES: readonly string[];
/**
 * Every current ISO 4217 code the engine can format (the ECB's alone without
 * `Intl.supportedValuesOf`).
 *
 * @type {ReadonlySet<string>}
 */
export declare const ISO_CURRENCIES: ReadonlySet<string>;
export type CurrencyReader = {
    /**
     * The reader's own currency, e.g. "LKR".
     */
    home?: string;
    /**
     * ISO 3166 region, e.g. "PK".
     */
    region?: string;
};
/**
 * The rupee sign: Pakistan's, Sri Lanka's, Nepal's, Mauritius's and the
 * Seychelles' (and India's before ₹). Only the reader's currency or region
 * can say which.
 */
export declare const RUPEE_SIGN = "\u20A8";
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
export declare function currencySymbols(): ReadonlyMap<string, string>;
/**
 * The single-character symbols, for a regex character class: "$£€¥₹₫₦…₨".
 *
 * @returns {string} The characters, the rupee sign last.
 */
export declare function symbolCharacters(): string;
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
export declare function symbolCurrency(symbol: string, reader?: CurrencyReader): string | null;
/**
 * Price prefixes and suffixes as shops write them, where the engine's
 * symbols disagree or have none: "C$" is Nicaragua's to `Intl` and Canada's
 * to shops; "zł", "Kč" and "Ft" are letters, too risky in running text but
 * plain next to a price.
 *
 * @type {ReadonlyArray<readonly [string, string]>}
 */
export declare const SHOP_MARKERS: ReadonlyArray<readonly [string, string]>;
export type Marker = readonly [string, string | null];
export type PriceOptions = {
    /**
     * The locale for a number that reads either way. Default "en".
     */
    locale?: string;
    /**
     * The decimal mark itself; wins over `locale`.
     */
    decimal?: DecimalMark;
    /**
     * Whether a three-letter code counts as a
     * currency. Default: any ISO 4217 code ({@link ISO_CURRENCIES}).
     */
    knows?: (code: string) => boolean;
    /**
     * Whose rupee "₨" is.
     */
    reader?: CurrencyReader;
    /**
     * Read the number as a page shows it ({@link readNumber}):
     * apostrophe and Indian groups, a sign or accounting parentheses ("-$5", "$-5",
     * "(€12.50)"). Default false: a typed, unsigned number.
     */
    display?: boolean;
};
export type Price = {
    /**
     * The amount; negative only with `display`.
     */
    amount: number;
    /**
     * The ISO 4217 code.
     */
    code: string;
};
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
export declare function parsePrice(text: string, { locale, decimal, knows, reader, display }?: PriceOptions): Price | null;
