---
api: [Change history]
---

# Change history (Show Changes)

`changeHistory` records what users change. Each change keeps:

- its time and the user's name;
- the cells it touched, with each one's old and new value;
- for rows and columns added or removed: where and how many.

The **Changes** side panel lists the changes, newest first and grouped by day.

```js
const grid = new FreeSheet(container, {
  data,
  changeHistory: { user: 'Ada' }, // the name shown with each change
  sidePanel: true,
  contextMenu: ['undo', 'redo', '---------', 'show_changes'],
});

grid.openPanel('changes');
```

- **What is recorded:** typing, a paste, a fill, Replace all and an undo are each one change, however many cells they
  touch. Loading data is not recorded.
- **The panel** shows up to five old → new values for each change. A click selects the changed cells; in a document,
  it switches to their sheet. **The selected cells** shows only the changes of the selection.
- **`limit`** keeps the last changes, 1000 by default.

From code:

```js
const history = grid.getPlugin('changeHistory');

history.getChanges();   // [{ id, time, user, kind, cells: [{ row, col, before, after }], index, amount, source }]
history.clearChanges();

grid.addHook('afterChangeRecorded', (change) => {
  // for example, send it to your server
});
```

`kind` is `'edit'`, `'insert_row'`, `'remove_row'`, `'insert_col'` or `'remove_col'`. `row` and `col` are rows and
columns of the data (`getSourceData`).

The history lives in the page: it is not saved by `getDocument()`. To keep it, save what `afterChangeRecorded` gives
you.
