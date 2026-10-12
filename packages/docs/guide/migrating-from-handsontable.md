# Migrating from Handsontable 6

FreeGrid started from the code of Handsontable 6.2.2, so a project built on Handsontable 6.x can usually
switch with a few changes. The compatibility layer described here is a migration aid: it stays available
throughout FreeGrid `0.x` and is removed in `1.0`.

## 1. Replace the package

```sh
npm uninstall handsontable
npm install freegrid
```

## 2. Update imports

The quickest switch keeps the `Handsontable` name through the compatibility entry:

```js
import Handsontable from 'freegrid/compat';
import 'freegrid/dist/freegrid.full.css';
```

When you have time, move to the FreeGrid name. The API is the same:

```js
import FreeGrid from 'freegrid';
```

With `<script>` tags, load `dist/freegrid.full.js` and then `dist/compat.js`, which defines
`window.Handsontable` as an alias of `window.FreeGrid`.

## 3. Language files

```js
// before
import 'handsontable/languages/de-DE';
// after
import 'freegrid/languages/de-DE';
```

With `<script>` tags, use `dist/languages/de-DE.js`.

## 4. Check these differences

- **No license key.** The `licenseKey` setting is ignored, because there is nothing to unlock.
- **CommonJS and IE are not supported.** FreeGrid ships ES modules and UMD bundles, and targets ES2020
  browsers.
- **jQuery:** the plugin is `$(el).freegrid(...)`. `$(el).handsontable(...)` still works during `0.x`.
- **Dates:** FreeGrid uses a current moment release. Use real moment formats (`MM/DD/YYYY`, not
  `mm/dd/yy`). Malformed formats may be parsed differently than in Handsontable 6.
- **CSS class names** are now FreeGrid's own (`.freegrid`, `.fg-core`, `.fg-center`, …). During `0.x` the
  old names (`.handsontable`, `.htCore`, `.htCenter`, …) keep working, so your CSS does not break. Plan to
  switch before `1.0`; see the full list in [Styling](./styling#legacy-class-names). The context menu now
  writes `fg-` alignment classes into `getCellMeta(...).className`.
- **Pro features** (filters, dropdown menu, hidden rows and columns, nested headers, export, formulas)
  were never part of the MIT release. They are on the [roadmap](../project/roadmap), written from scratch.
