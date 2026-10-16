# 0.8.0: Excel (.xlsx) and CSV files

Status: agreed (2026-10-17). Release target: `0.8.0`.

## Goal

Open an Excel file in FreeSheet and save FreeSheet as an Excel file, with what FreeSheet has: sheets, values,
formulas, number and date formats, cell styles, column widths and row heights, merged cells, hidden and frozen rows
and columns, conditional formatting, comments (notes) and filters. CSV too. No dependency: FreeSheet reads and
writes the files itself.

## API

```js
const blob = await hot.exportFile('xlsx');             // a Blob ('csv': the active sheet as CSV)
await hot.downloadFile('xlsx', 'report.xlsx');          // saves it in the browser
await hot.importFile(file);                             // a File, Blob or ArrayBuffer; replaces the document
await hot.importFile(text, { format: 'csv' });          // CSV text into the active sheet
```

Options: `headers` (export: write the column headers as a first row; `'auto'`, the default, writes them when the
columns have titles; import: the first row becomes the column headers), `sheet` (CSV: which sheet),
`delimiter` (CSV: `,` by default; import guesses `,`, `;` or tab). Events `beforeImportFile` (return `false` to
cancel), `afterImportFile`, `afterExportFile`.

## How

- **The document is the model.** Export converts `getDocument()` (every sheet's data with formulas, sizes, merged
  cells, cell settings, hidden rows and columns, filters, conditional formatting) to .xlsx; import converts .xlsx to
  the same shape and calls `loadDocument()`. `getDocument()` / `loadDocument()` learn frozen rows and columns
  (`fixedRowsTop`, `fixedColumnsLeft`) and cell styles.
- **Cell styles** (new): a cell's `style` meta (`fontWeight`, `fontStyle`, `textDecoration`, `color`, `background`,
  `border`) is drawn on the cell, under conditional formatting. It is what Excel's fonts and fills become on
  import, and `getDocument()` keeps it.
- **Files**: a ZIP reader and writer (stored and deflated entries; the browser's `CompressionStream` /
  `DecompressionStream`, with FreeSheet's own inflate where `deflate-raw` is missing), XML read with `DOMParser`
  and written as text.
- **Values**: numbers, text (written inline, read inline or shared), booleans, errors; formulas with their cached
  result (`getDataAtCell`), read back as `=…` (shared formulas expanded, references moved); dates written as
  serial numbers with their format, read back as text in the converted format.
- **Formats**: number formats (`0,0.00`, `0.0%`, `$0,0.00`, …) and date formats (`YYYY-MM-DD`, `MM/DD/YYYY`,
  `HH:mm`, …) are converted both ways for the common patterns; others keep Excel's format text where they can.
- **Conditional formatting**: every kind maps to Excel (`cellIs`, `containsText`, `notContainsText`, `beginsWith`,
  `endsWith`, `containsBlanks`, `notContainsBlanks`, `timePeriod`, `duplicateValues`, `uniqueValues`, `top10`,
  `aboveAverage`, `expression`, `colorScale`, `dataBar`, `iconSet`) with `dxf` styles.
- **Comments**: Excel notes (`commentsN.xml` and the VML shapes Excel needs to show them).
- **Nested rows** export their levels as Excel outline levels; column headers are written as a row when asked.
- Not read (skipped, the file still opens): charts, images, pivot tables, macros, data validation, threaded
  comments' replies (their text is kept as a note).

## Tests

Unit: ZIP (stored and deflated, FreeSheet's inflate against Node's zlib), formats both ways, date serials, CSV, the
document → .xlsx → document round trip. e2e: export and import in the browser (sheets, formulas with IronCalc,
styles, conditional formatting, merged, hidden and frozen cells, comments), a file written by another program, CSV,
events.
