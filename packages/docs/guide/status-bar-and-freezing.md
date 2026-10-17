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
