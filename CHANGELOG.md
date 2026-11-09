# Changelog

All notable changes to `@arraypress/number-parse` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — Unreleased

### Added

- `parseNumber`, `decimalSeparator`, `NUMBER_SOURCE`: typed numbers read by locale, from Tabby for Chrome (`convert/units/number.js`), unchanged in behaviour; `parseNumber` also takes `{decimal}`.
- `currencySymbols`, `symbolCurrency`, `symbolCharacters`, `ECB_CURRENCIES`, `ISO_CURRENCIES`, `RUPEE_SIGN`: currency signs from `Intl`, from Tabby (`convert/money/currencies.js`).
- `parsePrice`, `SHOP_MARKERS`: prices as pages write them, from Tabby (`convert/selection/selection.js`). Takes options; returns zero amounts (Tabby keeps its own "more than zero" rule).
- `readNumber`, `DISPLAY_NUMBER_SOURCE`, `decimalMarkOf`, and `parsePrice`'s `display` option: numbers as pages show them (apostrophe and Indian groups, signs, accounting parentheses), and the evidence a column of numbers needs to choose its decimal mark. For Better Tables.
