# Data and events

## Reading and writing data

```js
grid.getData();                 // all values, as an array of arrays
grid.getSourceData();           // the original objects or arrays
grid.getDataAtCell(0, 1);       // one value
grid.setDataAtCell(0, 1, 'new'); // one change (validated, undoable)
grid.loadData(newData);         // replace all data
```

Rows and columns can be added and removed with `alter`:

```js
grid.alter('insert_row', 2, 1); // insert 1 row at index 2
grid.alter('remove_col', 0);    // remove the first column
```

`setDataAtCell` and `alter` go through validation and the undo history, like edits made by a user.

## Events (hooks)

Pass a hook as a setting, or add it later with `addHook`:

```js
const grid = new FreeGrid(container, {
  data,
  afterChange(changes, source) {
    if (source === 'loadData') return;
    changes.forEach(([row, prop, oldValue, newValue]) => {
      console.log(`row ${row}, ${prop}: ${oldValue} → ${newValue}`);
    });
  },
});

grid.addHook('afterSelection', (row, col) => console.log('selected', row, col));
```

Frequently used hooks:

| Hook | When |
| --- | --- |
| `beforeChange(changes, source)` | Before edits are applied; change or cancel them here |
| `afterChange(changes, source)` | After edits are applied |
| `afterSelection(row, col, row2, col2)` | After the selection changes |
| `afterCreateRow`, `afterRemoveRow` | After rows are added or removed |
| `beforeKeyDown(event)` | Before the grid handles a key press |
| `afterRender(isForced)` | After each render |

`source` tells you where a change came from, for example `'edit'`, `'CopyPaste.paste'`, `'Autofill.fill'`,
`'UndoRedo.undo'` or `'loadData'`.
