---
api: [Sheets]
---

# Sheets

A FreeSheet grid can hold several sheets, as an Excel file does. The grid you create with `new FreeSheet` is the
first sheet, `Sheet1`; every sheet you add belongs to the same document. Until you add one, a grid has no tabs and
costs nothing extra.

```js
const hot = new FreeSheet(container, { data: sales, sheetName: 'Sales', colHeaders: true });

const costs = hot.addSheet('costs', { name: 'Costs', data: costsData }); // the new sheet's grid
hot.activateSheet('costs');
```

The tab bar appears below the sheets as soon as there is more than one. Users switch sheets by clicking a tab, add
one with **+**, rename one with a double click, and delete or move one from the tab's right-click menu or by
dragging it. `sheetTabs: true` shows the tabs for a single sheet too (so users can add sheets); `false` hides them.

To create several sheets at once, list them in the `sheets` setting:

```js
new FreeSheet(container, {
  sheetName: 'Sales',
  data: sales,
  sheets: [
    { id: 'costs', name: 'Costs', data: costsData },
    { id: 'summary', name: 'Summary', data: summaryData },
  ],
});
```

## Each sheet is a grid

`addSheet`, `getSheet` and `getActiveSheet` return a sheet's grid, with every method a grid has. Cell methods always
work on **their own** sheet: `hot.getDataAtCell(0, 0)` reads `Sales` even while the user looks at `Costs`. Use
`hot.getSheet('costs')` or `hot.getActiveSheet()` for another sheet. Every sheet has its own data, settings, undo,
selection and scroll position.

A new sheet takes `formulas`, `formulaBar`, the headers, the size and a few other settings from the first sheet,
unless you pass its own.

| Method | Does |
| --- | --- |
| `addSheet(id, settings)` | Adds a sheet after the last one and returns its grid. `settings.name` is its name. |
| `getSheet(id)` | The grid of a sheet, or `null`. |
| `getSheets()` | `[{ id, name }, …]` in the order of the tabs. |
| `getActiveSheet()` | The grid of the sheet the user sees. |
| `activateSheet(id)` | Shows a sheet. |
| `renameSheet(id, name)` | Renames a sheet (its id stays). |
| `removeSheet(id)` | Removes a sheet and destroys its grid. |
| `moveSheet(id, index)` | Moves a sheet in the tab order. |
| `getSheetId()`, `getSheetName()` | The sheet of this grid. |

Any sheet can call the document methods; they act on the same document. The first sheet (the grid created with
`new FreeSheet`) holds the document: it cannot be removed, its hooks get the sheet events
(`afterSheetAdd`, `afterSheetActivate`, `afterSheetRename`, `afterSheetMove`, `afterSheetRemove`, and the `before…`
events, which can cancel), and destroying it destroys every sheet.

A sheet name has 1 to 31 characters, without `[ ] : * ? / \`, and is unique in the document (as in Excel).

## Formulas across sheets

With [formulas](./formulas), all sheets share one formula engine, so a formula can refer to another sheet by its
name: `=Costs!B2`, `=SUM(Sales!B2:B13)`, or `='Sales 2026'!A1` for a name with spaces.

- Renaming a sheet updates the formulas that refer to it.
- Removing a sheet turns the references to it into `#REF!`.
- Inserting or removing rows or columns moves the references on every sheet.

See the [Sheets](../examples/sheets) and [Budget across sheets](../examples/budget) examples.
