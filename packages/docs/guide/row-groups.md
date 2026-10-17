---
api: [Row groups]
---

# Row groups

Row groups are a spreadsheet's outline, like Excel's **Data ▸ Group**. Group any adjacent rows, put groups inside
groups, and collapse a group to hide its rows. The data stays flat. For data that is a tree, with parent rows that
hold their children, see [nested rows](./nested-rows).

```js
const grid = new FreeSheet(container, { data, rowHeaders: true, colHeaders: true, contextMenu: true, rowGroups: true });

grid.getPlugin('rowGroups').groupRows(1, 4); // rows 2 to 5
```

## Using groups

- **Group:** select rows and choose **Group rows** in the context menu, or press **Alt+Shift+→**. **Ungroup rows**,
  or **Alt+Shift+←**, removes the groups inside the selected rows. Without such groups, it removes the innermost
  group that holds them.
- **The gutter:** the row headers get a column per level, with a bracket along each group's rows. Each group's
  **−/+** button is on the row after it, or on the row before it when the group ends the data.
- **Levels:** the corner shows a button for each level. **1** shows only the rows outside all groups, **2** one level
  more, and the last button shows every row. Up to 7 levels, as in Excel.
- **Changing rows:** groups follow rows that are added and removed.

## API

```js
const groups = grid.getPlugin('rowGroups');

groups.groupRows(from, to);    // visual rows
groups.ungroupRows(from, to);
groups.collapseGroup(row);     // the group of a row, or the group whose −/+ is on that row
groups.expandGroup(row);
groups.showLevel(2);
groups.expandAll();
groups.getGroups();            // [{ from, to, level, collapsed }], rows of the data
```

See the [example](../examples/row-groups).

## Saving

`getDocument()` and Excel files keep the groups: their levels and the collapsed groups. Imported Excel files show their
outline. A saved document has them as `rowGroups: [{ from, to, collapsed }]`. The grid takes the same list as
`rowGroups: { groups: [...] }`, with rows as data indexes.
