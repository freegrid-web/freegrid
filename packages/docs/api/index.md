# API overview

This page lists the parts of the API you will use most. A complete reference, generated from FreeGrid's
TypeScript types, will replace it after the TypeScript rewrite (see the [roadmap](../project/roadmap)).

## Constructor

```js
const grid = new FreeGrid(element, settings);
```

- `element`: the container `HTMLElement`.
- `settings`: an object with any of the settings below and any [hooks](../guide/data-and-events#events-hooks).

## Instance methods

### Data

| Method | Description |
| --- | --- |
| `getData(row?, col?, row2?, col2?)` | Values as an array of arrays (optionally a range) |
| `getSourceData()` | The original data source |
| `getDataAtCell(row, col)` | One value |
| `getDataAtRow(row)`, `getDataAtCol(col)` | A row or a column of values |
| `setDataAtCell(row, col, value, source?)` | Change one cell (or pass an array of `[row, col, value]` changes) |
| `loadData(data)` | Replace the data |
| `alter(action, index, amount?)` | `'insert_row'`, `'insert_col'`, `'remove_row'`, `'remove_col'` |
| `countRows()`, `countCols()` | Number of rows and columns |
| `isEmptyRow(row)`, `isEmptyCol(col)` | Whether a row or column is empty |

### Selection and editing

| Method | Description |
| --- | --- |
| `selectCell(row, col, row2?, col2?)` | Select a cell or range |
| `selectAll()` | Select everything |
| `getSelected()` | Selected ranges as `[row, col, row2, col2]` arrays |
| `deselectCell()` | Clear the selection |
| `getActiveEditor()` | The editor of the selected cell |
| `undo()`, `redo()` | Undo and redo |

### Cell meta

| Method | Description |
| --- | --- |
| `getCellMeta(row, col)` | The effective settings of a cell |
| `setCellMeta(row, col, key, value)` | Change one setting of one cell |
| `validateCells(callback?)` | Validate all cells; `callback(valid)` |

### Lifecycle and plugins

| Method | Description |
| --- | --- |
| `updateSettings(settings)` | Merge new settings and re-render |
| `render()` | Re-render |
| `getPlugin(name)` | A plugin instance, e.g. `getPlugin('columnSorting')` |
| `addHook(name, callback)`, `removeHook(name, callback)` | Listen to hooks at runtime |
| `destroy()` | Remove the grid and its listeners |

## Static members

| Member | Description |
| --- | --- |
| `FreeGrid.version`, `FreeGrid.buildDate` | Build information |
| `FreeGrid.languages` | `registerLanguageDictionary`, `getLanguageDictionary`, `dictionaryKeys` |
| `FreeGrid.cellTypes`, `FreeGrid.editors`, `FreeGrid.renderers`, `FreeGrid.validators` | Built-ins and `register…` functions for your own |
| `FreeGrid.hooks` | Global hooks: `FreeGrid.hooks.add(name, callback)` |
| `FreeGrid.helper`, `FreeGrid.dom` | Utility functions, e.g. `FreeGrid.helper.createSpreadsheetData(rows, cols)` |

## Settings

The most common settings are listed in [Configuration](../guide/configuration). Cell types, plugins and their
settings are described in [Cell types](../guide/cell-types) and [Plugins](../guide/plugins).
