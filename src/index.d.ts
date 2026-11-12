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
export declare function westernDigits(text: string): string;
/**
 * A typed number, as a regex source (no anchors, no groups that capture):
 * digits with thousands grouped in threes by ",", ".", a space, a no-break
 * space, a narrow no-break space or a thin space, and an optional decimal part.
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
 * to shops; "zł", "Kč", "Ft", "RM" (Malaysia), "Rp" (Indonesia), "lei"
 * (Romania), "TL" (Turkey), "S/" and "S/." (Peru), "Fr." and "sFr."
 * (Switzerland), "đ" and "VNĐ" (Vietnam), "руб" (Russia), "грн" (Ukraine),
 * "RMB" (China) and the characters for yen, yuan and won ("円", "元", "원")
 * are letters, too risky in running text but plain next to a price; "JP¥",
 * "AR$" and "Mex$" name whose yen or dollar it is.
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
     * "(€12.50)"), and a number that reads either way as {@link findPrices} reads it
     * ("50.000 ₫" is fifty thousand). Default false: a typed, unsigned number.
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
export declare function parsePrice(text: string, { locale, decimal, knows, reader, display }?: PriceOptions): Price | null;
/**
 * Markers several currencies write that `Intl`'s English data doesn't list
 * as symbols, which pages put next to prices: "kr" (the Swedish, Norwegian,
 * Danish and Icelandic crowns; "kr." in Danish), "Rs" (the rupees of India,
 * Pakistan, Sri Lanka, Nepal and Mauritius) and "￥" (the full-width yen
 * sign, Japan's and China's). Only the page can say which; {@link findPrices}
 * reads them, {@link parsePrice} doesn't.
 */
export declare const SHARED_MARKERS: readonly string[];
/**
 * Signs of a currency's hundredth, with the currency sign whose currencies
 * they divide: "74.8¢/oz" is 74.8 hundredths of the page's dollar.
 */
export declare const SUBUNIT_MARKERS: Readonly<Record<string, string>>;
/**
 * ISO 4217 codes that are also English words or names in capitals ("SHOP ALL
 * 50", "TOP 10", "TRY 3 FREE", "CAD 3D", "2 CUP", "AMD 5600"): {@link findPrices}
 * doesn't take them as currencies unless told to, except the Canadian dollar,
 * the Turkish lira and the Armenian dram after a number ("12.99 CAD"), where
 * they're never words.
 */
export declare const WORD_CODES: readonly string[];
/**
 * ISO 4217 codes that name something else before certain numbers, with the
 * numbers: a version of PHP ("PHP 8.3"), a climate conference ("COP 28"), a
 * petrol's octane ("RON 95"), a Sustainable Development Goal ("SDG 13").
 * {@link findPrices} takes none of them as a price; the same code before any
 * other number ("PHP 1,200", "COP 25.000", "RON 49,99") still is one.
 *
 * @type {Readonly<Record<string, RegExp>>}
 */
export declare const NAMED_NUMBERS: Readonly<Record<string, RegExp>>;
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
export declare function symbolCurrencies(marker: string): string[];
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
export declare function currencyDigits(code: string): number;
export type FoundPrice = {
    /**
     * Where it starts in the text.
     */
    start: number;
    /**
     * Where it ends (exclusive): `text.slice(start, end)` is it.
     */
    end: number;
    /**
     * It, as written: "$49.99", "1.299,99 €", "$10–20".
     */
    text: string;
    /**
     * Its currency marker, as written: "$", "€", "kr", "USD".
     */
    marker: string;
    /**
     * Every currency the marker can stand for ({@link symbolCurrencies}).
     */
    codes: string[];
    /**
     * The currency chosen (`pick`); null when nothing could say.
     */
    code: string | null;
    /**
     * The amount (the low end of a range).
     */
    amount: number;
    /**
     * A range's high end ("$49.99 – $59.99", "$10–20", "10–20 €").
     */
    max?: number;
};
export type FindOptions = {
    /**
     * The text's locale, for a number that reads either way and whose
     * currency can't say (see {@link findPrices}). Default "en".
     */
    locale?: string;
    /**
     * The decimal mark itself; wins over `locale`.
     */
    decimal?: DecimalMark;
    /**
     * Whether a three-letter
     * code counts as a currency, before the number or after it. Default: any ISO 4217 code but the
     * {@link WORD_CODES} (the Canadian dollar and the Turkish lira count after a number).
     */
    knows?: (code: string, place: 'before' | 'after') => boolean;
    /**
     * Which currency a marker
     * stands for. Default: the one there is; for a shared symbol its usual reading ("$" USD, "£"
     * GBP, "¥" JPY, "₩" KRW), and null for "kr", "Rs" and "₨".
     */
    pick?: (marker: string, codes: string[]) => string | null;
};
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
export declare function findPrices(text: string, { locale, decimal, knows, pick }?: FindOptions): FoundPrice[];
