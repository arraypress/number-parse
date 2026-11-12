# Changelog

All notable changes to `@arraypress/number-parse` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] — Unreleased

### Added

- `westernDigits(text)`: the digits of other scripts (Arabic-Indic, Persian, Devanagari, Bengali, Thai, full-width…) as "0"–"9", and the Arabic marks "٫" "٬" as "." ",". `parseNumber`, `readNumber`, `decimalMarkOf`, `parsePrice` and `findPrices` now read them ("١٬٢٣٤ SAR", "１,２００円"); a found price's `text` stays as written.
- `NAMED_NUMBERS`: codes that name something else before certain numbers ("PHP 8.3", "COP 28", "RON 95", "SDG 13"), which `findPrices` no longer takes for prices. "AMD" joins `WORD_CODES` ("AMD 5600"; "5,600 AMD" is still a price).
- `SHOP_MARKERS`: "S/." (PEN), "sFr." (CHF), "JP¥", "AR$", "Mex$", "RMB" (CNY), "đ" and "VNĐ" (VND), "руб" and "руб." (RUB), "грн" (UAH).

### Fixed

- A mark written more than once groups thousands whatever the locale: "1.500.000" read with "en" (and "1,500,000" with "de") was `null`, so `findPrices` found nothing in "Rp 1.500.000", "COP 1.500.000" or "₫1.200.000" on a page in English.
- `findPrices`: a price that reads either way is a decimal when its mark is the decimal mark of both the page and the currency's own countries: "$3.459" a gallon is 3.459 (was 3459), "1,759 €" on a German page 1.759, "EUR/USD 1.085" 1.085. "€1.299" in English and "1,500 USD" in German still group thousands.
- `findPrices`: a plain space after a prefixed price no longer joins the next three digits to it when more words or a "%" follow and the locale doesn't group with spaces ("Only $5 200 left" is $5, "$10 100% cotton" $10). A price on its own ("₴1 299"), no-break spaces, a decimal part ("€ 1 234,56") and a number before its marker ("2 500 €") read as before.
- `findPrices`: "$1-800-555-1234" is no longer the range $1–800; "$5CAD" is found with its "$".
- `readNumber`, `parsePrice`: parentheses with a minus inside are negative ("(-5)" was 5).
- `parsePrice` with `display` reads a number that reads either way as `findPrices` does ("50.000₫" is 50000, was 50).
- `NUMBER_SOURCE` takes the thin space `parseNumber` already stripped.

## [1.1.0] — Unreleased

### Added

- `findPrices(text, options)`: every price in running text, with where it is, its marker as written, every currency the marker can mean (`codes`) and the one `pick` chose; ranges ("$49.99 – $59.99", "$10–20", "10–20 €") as one price with `max`; "no cents" dashes ("CHF 12.–", "12,- €"); a code beside a shared symbol settles it ("$12.99 CAD", "AUD $49.95"); Japanese and Chinese text, which doesn't space words, can run up to a price ("税込1,200円送料無料"); a capital word that isn't a currency doesn't hide the price after it ("UVP 129,99 €"); a code glued to a number is a name, not a price ("USD1"); cents ("74.8¢/oz", `SUBUNIT_MARKERS`) are hundredths of the dollar; a number that reads either way groups thousands unless its currency has three decimals. For Better Prices.
- `symbolCurrencies(marker)`: every currency a symbol or marker can mean, from `Intl` (letters included), the usual reading first.
- `currencyDigits(code)`: a currency's decimals, from `Intl`.
- `SHARED_LETTER_MARKERS` ("kr", "kr.", "Rs", "Rs."), read by `findPrices` only; `WORD_CODES`, the ISO codes that are English words in capitals ("TOP", "ALL", "TRY"), which `findPrices` skips by default.
- `SHOP_MARKERS`: "RM" (MYR), "Rp" (IDR), "lei" (RON), "TL" (TRY), "S/" (PEN), "Fr." (CHF), "円" (JPY), "元" (CNY), "원" (KRW).

## [1.0.0] — 2026-11-10

### Added

- `parseNumber`, `decimalSeparator`, `NUMBER_SOURCE`: typed numbers read by locale, from Tabby for Chrome (`convert/units/number.js`), unchanged in behaviour; `parseNumber` also takes `{decimal}`.
- `currencySymbols`, `symbolCurrency`, `symbolCharacters`, `ECB_CURRENCIES`, `ISO_CURRENCIES`, `RUPEE_SIGN`: currency signs from `Intl`, from Tabby (`convert/money/currencies.js`).
- `parsePrice`, `SHOP_MARKERS`: prices as pages write them, from Tabby (`convert/selection/selection.js`). Takes options; returns zero amounts (Tabby keeps its own "more than zero" rule).
- `readNumber`, `DISPLAY_NUMBER_SOURCE`, `decimalMarkOf`, and `parsePrice`'s `display` option: numbers as pages show them (apostrophe and Indian groups, signs, accounting parentheses), and the evidence a column of numbers needs to choose its decimal mark. For Better Tables.
