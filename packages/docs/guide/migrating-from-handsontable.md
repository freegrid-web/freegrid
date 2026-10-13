# Migrating from Handsontable 6

FreeGrid started from the code of Handsontable 6.2.2, so a project built on Handsontable 6.x can usually
switch with a few changes. The compatibility layer described here is a migration aid: it stays available
throughout FreeGrid `0.x` and is removed in `1.0`.

## 1. Replace the package

```sh
npm uninstall handsontable
npm install @freegrid/core
```

## 2. Update imports

The quickest switch keeps the `Handsontable` name through the compatibility entry:

```js
import Handsontable from '@freegrid/core/compat';
import '@freegrid/core/dist/freegrid.full.css';
```

When you have time, move to the FreeGrid name. The API is the same:

```js
import FreeGrid from '@freegrid/core';
```

With `<script>` tags, load `dist/freegrid.full.js` and then `dist/compat.js`, which defines
`window.Handsontable` as an alias of `window.FreeGrid`.

## 3. Language files

```js
// before
import 'handsontable/languages/de-DE';
// after
import '@freegrid/core/languages/de-DE';
```

With `<script>` tags, use `dist/languages/de-DE.js`.

## 4. Check these differences

- **No license key.** The `licenseKey` setting is ignored, because there is nothing to unlock.
- **CommonJS and IE are not supported.** FreeGrid ships ES modules and UMD bundles for Chrome/Edge
  107+, Firefox 104+ and Safari 16+.
- **jQuery:** the plugin is `$(el).freegrid(...)`. `$(el).handsontable(...)` still works during `0.x`.
- **Dates:** FreeGrid no longer needs moment.js. `dateFormat` and `timeFormat` keep moment's tokens and parsing
  rules (see [Date and time formats](./cell-types#date-and-time-formats)); use real formats (`MM/DD/YYYY`, not
  `mm/dd/yy`). Week tokens (`w`, `W`, `gggg`) and locales other than English are not supported.
- **Numbers:** FreeGrid no longer needs numbro. `numericFormat` patterns keep numbro's syntax and give the same text;
  the separators and the currency come from the browser, so no numbro language files are needed (see
  [Number formats](./cell-types#number-formats)).
- **Date picker:** FreeGrid has its own calendar instead of Pikaday (classes `fg-datepicker*` instead of `pika-*`).
  `datePickerConfig` keeps Pikaday's names for the common options (see [Date picker](./cell-types#date-picker));
  other Pikaday options are ignored. You no longer load Pikaday or its CSS.
- **CSS class names** are now FreeGrid's own (`.freegrid`, `.fg-core`, `.fg-center`, …). During `0.x` the
  old names (`.handsontable`, `.htCore`, `.htCenter`, …) keep working, so your CSS does not break. Plan to
  switch before `1.0`; see the full list in [Styling](./styling#legacy-class-names). The context menu now
  writes `fg-` alignment classes into `getCellMeta(...).className`.
- **Pro features** (filters, dropdown menu, hidden rows and columns, nested headers, export, formulas)
  were never part of the MIT release. They are on the [roadmap](../project/roadmap), written from scratch.
