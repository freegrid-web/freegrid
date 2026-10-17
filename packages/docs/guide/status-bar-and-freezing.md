---
api: [Status bar]
---

# Status bar and frozen panes

## Status bar

`statusBar: true` shows a bar at the bottom of the grid (below the sheet tabs), as in Excel. When more than one cell
is selected, it shows their average, count and sum:

- **Count** counts the cells that have a value.
- **Average** and **Sum** use the numbers among them (formula results count).
- Without numbers, only the count shows.

```js
new FreeSheet(container, { data, statusBar: true });
```

Choose the figures with `items`: `'average'`, `'count'`, `'numericalCount'` (cells with a number), `'min'`, `'max'`
and `'sum'`.

```js
statusBar: { items: ['sum', 'min', 'max'] }
```

### Items and formats of your own

An item can also be an object:

- **Rename or format a built-in item** with `item`, for example
  `{ item: 'sum', label: 'Total', format: { style: 'currency', currency: 'EUR' } }`.
- **Compute a value of your own** with `value`. It gets the selection and returns a number or a text; `null` hides the
  item. Its argument has these fields:
  - `values`: the selected cells' values, formula results, empty ones too;
  - `numbers`: the numbers among them;
  - `cells`: the selected cells as `[row, col]`;
  - `grid`: the active sheet.
- **Choose where it shows:**
  - `align: 'left'` puts the item at the left, where it always shows (a "Ready" or "Saved" text);
  - `always: true` shows a right item without a selection too.

`format` writes the numbers, for every item (`statusBar.format`) or one (`item.format`):

- **Options of `Intl.NumberFormat`**, such as `{ maximumFractionDigits: 2 }` or
  `{ style: 'currency', currency: 'EUR' }`.
- **A function** `(value, context) => text`, which can write the value its own way, compute something else or add
  text. `context` has the fields above, and `item`: the built-in item's name or the item's label.

```js
statusBar: {
  items: [
    { align: 'left', value: () => (saved ? 'Saved' : 'Unsaved changes') },
    { item: 'sum', label: 'Total' },
    'average',
    { label: 'Median', value: ({ numbers }) => median(numbers) },
    { label: 'Cells', value: ({ cells }) => cells.length, format: count => `${count} selected` },
  ],
  format: { maximumFractionDigits: 2 },
}
```

The bar updates when the selection or the data changes. When an item depends on something else, call
`grid.getPlugin('statusBar').refresh()`.

In a document with [sheets](./sheets), one bar shows the active sheet's selection. See the
[budget example](../examples/budget).

## Frozen panes

Frozen rows stay at the top while the grid scrolls, frozen columns at the left. Set them with `fixedRowsTop` and
`fixedColumnsLeft`, or let users choose with the context menu's **Freeze** entry. Add its key `'freeze'` to your
menu:

```js
contextMenu: ['undo', 'redo', '---------', 'freeze']
```

**Freeze** has these commands:

- **Freeze panes** freezes the rows above the selected cell and the columns left of it.
- **Freeze top row** and **Freeze first column** freeze just those.
- **Unfreeze panes** turns freezing off.

Excel files and `getDocument()` keep frozen panes.
