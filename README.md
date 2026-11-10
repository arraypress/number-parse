# @arraypress/number-parse

Read numbers and prices the way people type them and pages show them.

- **Locale-aware decimal marks:** "1,500" is fifteen hundred in English and one and a half in
  German; "2,4" and "1.234,56" can only be read one way, so they are, whatever the locale.
- **Every grouping pages use:** "1,234.56", "1.234,56", "1 234,56", "1'234.56", Indian
  "12,34,567"; signs "-5", "−5" (U+2212), "+5" and accounting parentheses "(1,200)".
- **Prices:** "US$1,299.99", "1.299,99 €", "€ 12,50", "JPY 5,000", "R$ 50", "100 zł", from the
  engine's own currency data (`Intl`), plus the markers shops use where `Intl` disagrees.
- **Prices in running text:** every price on a shop page's line ("Was $59.99, now $49.99",
  "$10–20", "CHF 12.–", "1 234,56 kr"), with the currencies a shared marker can mean, so the page
  can settle whose "$" or "kr" it is.

Zero dependencies. Works in browsers (including extension content scripts), Node.js, Workers, Deno
and Bun.

## Install

```bash
npm install @arraypress/number-parse
```

## Numbers

```js
import { decimalMarkOf, decimalSeparator, parseNumber, readNumber } from '@arraypress/number-parse';

// What somebody types: unsigned, thousands in threes.
parseNumber('1,500', 'en');            // 1500
parseNumber('1,500', 'de');            // 1.5
parseNumber('2,4', 'en');              // 2.4 (can't be thousands)
parseNumber('1,500', { decimal: ',' }); // 1.5

// What a page shows: more groupings, a sign, parentheses.
readNumber('12,34,567', 'en-IN');      // 1234567
readNumber("1'234.56", 'de-CH');       // 1234.56
readNumber('(1,200.50)', 'en');        // -1200.5
readNumber('−5', 'en');                // -5

// Many numbers (a table column): let the unambiguous ones choose the mark for the rest.
decimalMarkOf('1.234,56');             // ','
decimalMarkOf('1,500,000');            // '.'
decimalMarkOf('1,500');                // null: reads either way
decimalSeparator('fr');                // ','
```

| Export | What it does |
|---|---|
| `parseNumber(text, reading)` | A typed number (`NUMBER_SOURCE`), or `null`. `reading` is a locale or `{decimal}`. |
| `readNumber(text, reading)` | A shown number (`DISPLAY_NUMBER_SOURCE`) with an optional sign or parentheses, or `null`. |
| `decimalMarkOf(text)` | The decimal mark a number can only have (`'.'`, `','`), or `null`. |
| `decimalSeparator(locale)` | The locale's decimal mark. |
| `NUMBER_SOURCE`, `DISPLAY_NUMBER_SOURCE` | The two grammars as regex sources, without capturing groups, to embed in larger patterns. |

## Prices and currencies

```js
import { currencySymbols, parsePrice, symbolCurrency } from '@arraypress/number-parse';

parsePrice('1.299,99 €');                     // { amount: 1299.99, code: 'EUR' }
parsePrice('US$40');                          // { amount: 40, code: 'USD' }
parsePrice('40 USD');                         // { amount: 40, code: 'USD' }
parsePrice('£1,200', { locale: 'de' });       // { amount: 1.2, code: 'GBP' }
parsePrice('(US$12.50)', { display: true });  // { amount: -12.5, code: 'USD' }
parsePrice('100 MAD', { knows: (code) => ['USD', 'EUR'].includes(code) }); // null

currencySymbols().get('₫');                   // 'VND'
symbolCurrency('₨', { region: 'PK' });        // 'PKR'
```

| Export | What it does |
|---|---|
| `parsePrice(text, {locale, decimal, knows, reader, display})` | A marker (symbol, shop marker, ISO code) before or after a number → `{amount, code}`, or `null`. `knows` decides which three-letter codes count (default: any ISO 4217 code); `display` reads the number as `readNumber` does. |
| `currencySymbols()` | Every symbol that names one currency in `Intl`'s English data, plus `$` USD, `£` GBP, `¥` JPY, `₩` KRW. Letter "symbols" (`kr`, `Rs`, `K`) are left out. Built once. |
| `symbolCurrency(symbol, reader?)` | One symbol's currency; `₨` needs the reader's `home` or `region`. |
| `symbolCharacters()` | The single-character symbols, for a regex class. |
| `SHOP_MARKERS` | `US$`, `CA$`, `C$`, `A$`, `R$`, `CHF`, `zł`, `Kč`, `Ft`… with their codes. |
| `ECB_CURRENCIES`, `ISO_CURRENCIES`, `RUPEE_SIGN` | The ECB's 30 codes; every code the engine formats; `₨`. |
| `symbolCurrencies(marker)` | Every currency a marker can mean, the usual one first: `'$'` → USD, ARS, AUD, CAD…; `'kr'` → DKK, ISK, NOK, SEK; `'CA$'` → CAD. |
| `currencyDigits(code)` | The decimals a currency's prices show (2; JPY 0; KWD 3). |

## Prices in running text

```js
import { findPrices } from '@arraypress/number-parse';

findPrices('Was $59.99, now $49.99');
// [{ start: 4, end: 10, text: '$59.99', marker: '$', codes: ['USD', 'ARS', …], code: 'USD', amount: 59.99 },
//  { start: 16, end: 22, text: '$49.99', …, amount: 49.99 }]
findPrices('$49.99 – $59.99')[0];            // { …, amount: 49.99, max: 59.99 } (also "$10–20", "10–20 €")
findPrices('CHF 12.–')[0].amount;             // 12 (also "12,- €")
findPrices('$12.99 CAD')[0].code;             // 'CAD': a code after a shared symbol settles it
findPrices('€1.299')[0].amount;               // 1299: a price with 3 digits after its only mark groups thousands
findPrices('2026, 20% off, TOP 10, 555-1234'); // []: no marker, or a code that's a word ("TOP", "ALL")

// Whose "$", "¥" or "kr" is it? The page says (its declared currency, its country…):
findPrices('1 234,56 kr', { pick: (marker, codes) => (codes.includes('SEK') ? 'SEK' : null) });
```

A marker (symbol, shop marker, `SHARED_LETTER_MARKERS` "kr"/"Rs", or ISO code) before or after a
shown number (`DISPLAY_NUMBER_SOURCE`), at most one space between, neither inside a longer word or
number. Options: `locale`/`decimal` (for a number that reads either way when the currency can't
say), `knows(code, place)` (default: ISO codes but `WORD_CODES`; CAD and TRY count after a number),
and `pick(marker, codes)` (default: the one there is, or a shared symbol's usual reading; null for
"kr", "Rs" and "₨").

## Development

`npm test` runs ESLint, a strict TypeScript check of the JSDoc, the tests (`node --test`) and a
copied-code check (jscpd). The `.d.ts` files are generated from the JSDoc: `npm run types` writes
them, and the type check fails while one is stale.

## License

MIT © 2026 David Sherlock / ArrayPress Limited
