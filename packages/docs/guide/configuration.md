# Configuration

A grid is configured with one settings object, passed to the constructor:

```js
const grid = new FreeGrid(container, {
  data,
  colHeaders: true,
  rowHeaders: true,
  stretchH: 'all',
});
```

## Changing settings later

`updateSettings` merges new settings into the current ones and re-renders:

```js
grid.updateSettings({ readOnly: true, colHeaders: ['Name', 'City'] });
```

## Settings cascade

Settings apply at three levels. The more specific level wins:

1. **Grid:** the top-level settings object.
2. **Column:** an entry in `columns`.
3. **Cell:** an entry in `cell`, or the result of the `cells` function.

```js
new FreeGrid(container, {
  data,
  readOnly: true,                       // every cell…
  columns: [
    { readOnly: false },                // …except the first column…
    {},
  ],
  cell: [
    { row: 0, col: 1, readOnly: false }, // …and this one cell
  ],
  cells(row, col) {
    // called for every cell; return settings for it
    return row === 2 ? { className: 'htCenter' } : {};
  },
});
```

## Frequently used settings

| Setting | What it does |
| --- | --- |
| `data` | Array of arrays or array of objects |
| `colHeaders`, `rowHeaders` | `true` for letters/numbers, an array of labels, or a function |
| `columns` | Per-column settings; with object rows, `data: 'key'` binds a column to a property |
| `width`, `height` | Grid size in pixels (or a function returning it) |
| `stretchH` | `'none'`, `'last'` or `'all'`: how columns fill the width |
| `readOnly` | Disable editing |
| `minSpareRows`, `minSpareCols` | Keep empty rows/columns at the end for new input |
| `fixedRowsTop`, `fixedRowsBottom`, `fixedColumnsLeft` | Freeze rows and columns |
| `contextMenu` | `true` or a list of menu items |
| `columnSorting` | Enable sorting by clicking headers |
| `language` | UI language, e.g. `'de-DE'` (see [Localization](./localization)) |

The [API overview](../api/) lists more settings and instance methods.
