# @arraypress/number-parse

Read numbers and prices the way people type them and pages show them.

- **Locale-aware decimal marks:** "1,500" is fifteen hundred in English and one and a half in
  German; "2,4" and "1.234,56" can only be read one way, so they are, whatever the locale.
- **Every grouping pages use:** "1,234.56", "1.234,56", "1 234,56", "1'234.56", Indian
  "12,34,567"; signs "-5", "−5" (U+2212), "+5" and accounting parentheses "(1,200)".
- **Prices:** "US$1,299.99", "1.299,99 €", "€ 12,50", "JPY 5,000", "R$ 50", "100 zł", from the
  engine's own currency data (`Intl`), plus the markers shops use where `Intl` disagrees.

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

## Development

`npm test` runs ESLint, a strict TypeScript check of the JSDoc, the tests (`node --test`) and a
copied-code check (jscpd). The `.d.ts` files are generated from the JSDoc: `npm run types` writes
them, and the type check fails while one is stale.

## License

MIT © 2026 David Sherlock / ArrayPress Limited
