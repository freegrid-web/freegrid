# Plugins

Most features are plugins that you switch on with a setting. Each can be reached at runtime with
`grid.getPlugin(name)`.

| Setting | Plugin |
| --- | --- |
| `contextMenu` | Right-click menu with row/column, alignment, read-only, merge and comment actions |
| `columnSorting` | Sort by clicking a column header; `getPlugin('columnSorting').sort({ column, sortOrder })` |
| `mergeCells` | Merge cell ranges: `true` or a list of `{ row, col, rowspan, colspan }` |
| `comments` | Cell comments shown on hover: `cell: [{ row, col, comment: { value } }]` |
| `customBorders` | Borders around cells or ranges |
| `search` | `getPlugin('search').query(text)` highlights and returns matches |
| `manualColumnResize`, `manualRowResize` | Resize by dragging header borders |
| `manualColumnMove`, `manualRowMove` | Reorder by dragging headers |
| `manualColumnFreeze` | Freeze columns from the context menu |
| `autoColumnSize`, `autoRowSize` | Size columns and rows to their content |
| `fillHandle` | Drag to fill (on by default) |
| `copyPaste` | Clipboard support (on by default) |
| `undo` | Undo and redo (on by default): `grid.undo()`, `grid.redo()` |
| `persistentState` | Remember column order, size and sorting in `localStorage` |
| `observeChanges` | Re-render when the data source is changed directly |
| `dragToScroll` | Scroll while selecting beyond the visible area |

Live examples: [basics](../examples/basics), [merged cells and comments](../examples/merged-cells-and-comments),
[search](../examples/search-and-languages).
