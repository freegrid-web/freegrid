---
api: [Column groups]
---

# Column groups

`nestedHeaders` adds header rows above the column headers, with headers over several columns: "2026" over "Q1 Q2
Q3 Q4". Each row is a list of labels, or `{ label, colspan }` for a header over several columns. The last row is the
column headers.

```js
new FreeSheet(container, {
  data,
  nestedHeaders: [
    ['Region', { label: '2026', colspan: 5 }, { label: '2027', colspan: 2 }],
    ['', 'Q1', 'Q2', 'Q3', 'Q4', 'Total', 'Q1', 'Q2'],
  ],
});
```

A group's label is drawn over its visible columns. A click on a group header selects its columns. Columns can be
moved inside their group (`manualColumnMove`), not out of it or into another group.
`getPlugin('nestedHeaders').getGroup(level, column)` returns a group's label and visible columns.

## Collapsible groups

`collapsibleColumns` gives groups a −/+ button. A collapsed group hides its columns but one: the first, the last
(`show: 'last'`, for a total column) or the one at an offset (`show: 2`).

```js
collapsibleColumns: true,                               // every group wider than one column
collapsibleColumns: [{ row: 0, col: 1, show: 'last' }], // the group on header row 0 that starts at column 1
```

```js
const groups = hot.getPlugin('collapsibleColumns');

groups.collapse(0, 1);       // header row, any visual column of the group
groups.expand(0, 1);
groups.isCollapsed(0, 1);
groups.collapseAll();
groups.expandAll();
```

Collapsed columns are hidden columns: `countCols()`, selection and copying skip them, and they work together with
`hiddenColumns`. The events `beforeColumnCollapse` / `beforeColumnExpand` (return `false` to cancel) and
`afterColumnCollapse` / `afterColumnExpand` get the header row and the group's first physical column.
