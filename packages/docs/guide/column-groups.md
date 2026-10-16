---
api: [Column groups]
---

# Column groups

A column with `columns` of its own is a group. A header row above the column headers shows the group's `title` over
its columns. Groups can be nested (a year over halves over quarters): each level adds a header row.

```js
new FreeSheet(container, {
  data,
  columns: [
    { data: 'region', title: 'Region' },
    {
      title: '2026',
      collapsible: true,                      // a − / + button
      columns: [
        { data: 'q1', title: 'Q1' },
        { data: 'q2', title: 'Q2' },
        { data: 'q3', title: 'Q3' },
        { data: 'q4', title: 'Q4' },
        { data: 'total', title: 'Total', type: 'numeric', showWhenCollapsed: true },
      ],
    },
    {
      title: '2027',
      collapsible: true,
      collapsed: true,                        // starts collapsed
      columns: [{ data: 'q1_27', title: 'Q1' }, { data: 'q2_27', title: 'Q2' }],
    },
  ],
});
```

Everything about a column stays in one place: its data, title, type, width, its group, and whether it is hidden.
The grid works with the columns without children, in order (`getSettings().columns` lists them, and they are the
physical columns).

| On a group | |
| --- | --- |
| `title` | The group's header. |
| `columns` | Its columns (and groups). |
| `collapsible: true` | A − / + button that collapses the group. |
| `collapsed: true` | The group starts collapsed. |

| On a column | |
| --- | --- |
| `showWhenCollapsed: true` | The column that stays when its group is collapsed (the first one when none is marked). |
| `hidden: true` | The column starts hidden; Show columns in the context menu or `getPlugin('hiddenColumns').showColumns` show it. |

A click on a group header selects its columns. Columns can be moved inside their group (`manualColumnMove`), not
out of it or into another group.

## Collapsing with the API

```js
const groups = hot.getPlugin('collapsibleColumns');

groups.collapse(0, 1);       // header row (0 = the top), any visual column of the group
groups.expand(0, 1);
groups.isCollapsed(0, 1);
groups.collapseAll();
groups.expandAll();

hot.getPlugin('nestedHeaders').getGroup(0, 1); // { label: '2026', columns: [1, 2, 3, 4, 5] }
```

Collapsed columns are hidden columns: `countCols()`, selection and copying skip them. The events
`beforeColumnCollapse` / `beforeColumnExpand` (return `false` to cancel) and `afterColumnCollapse` /
`afterColumnExpand` get the header row and the group's first physical column.

## Older configurations

`nestedHeaders` (rows of labels with `colspan`) and `collapsibleColumns` with a list of `{ row, col, show }` still
work, so configurations written for Handsontable keep working. Groups in `columns` say the same more simply; the
older settings will be removed in `1.0`.
