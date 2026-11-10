# Changelog

All notable changes to `@arraypress/number-parse` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
