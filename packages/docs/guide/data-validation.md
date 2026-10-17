---
api: [Data validation]
---

# Data validation

A cell's or a column's `validation` allows only some values, as a spreadsheet's Data validation does.

```js
new FreeSheet(container, {
  data,
  columns: [
    {},
    { validation: { type: 'list', source: ['Open', 'Doing', 'Done'] } },             // a dropdown
    { validation: { type: 'integer', operator: 'between', value: 0, value2: 24,
      inputMessage: 'Hours: a whole number from 0 to 24', message: 'From 0 to 24' } },
  ],
});
```

## Rules

| `type` | Allows |
| --- | --- |
| `'list'` | The items of `source`: an array, or a range of the sheet (`'A1:A5'`). The cell gets a dropdown. |
| `'number'` | Numbers that meet `operator` with `value` (and `value2`) |
| `'integer'` | Whole numbers, the same way |
| `'date'` | Dates (`value`: `'2026-01-01'`), the same way |
| `'textLength'` | Text whose length meets the operator |

The operators are:

- `'between'` and `'notBetween'`, which use `value2` too;
- `'equal'` and `'notEqual'`;
- `'greater'`, `'less'`, `'greaterOrEqual'` and `'lessOrEqual'`.

- **Empty cells** are valid. `allowBlank: false` makes them not valid.
- **Invalid values are refused.** `strict: false` keeps them and marks the cell, as a warning.
- **Messages:** `message` is shown when a value is not valid. `inputMessage` is shown under the cell while it is
  selected.

## The panel

The **Data validation** side panel sets a rule on the selected cells. It opens with `openPanel('dataValidation')` or
from the context menu key `'data_validation'`. It shows:

- the criteria and, for a list, its items (one per line, or a range such as `=A1:A5`);
- the condition and its values;
- whether values that are not valid are refused;
- both messages.

**Apply** sets the rule, **Remove** takes it away, and one undo step takes back either.

```js
contextMenu: ['undo', 'redo', '---------', 'data_validation'],
sidePanel: true,
```

## From code

```js
const validation = grid.getPlugin('dataValidation');

validation.setValidation({ type: 'number', operator: 'greater', value: 0 }); // the selected cells
validation.setValidation(null, [[0, 1], [0, 2]]);                            // removes it from two cells
validation.getValidation(0, 1);
```

`getDocument()` and Excel files keep the rules: a file from Excel brings its data validation, and Excel opens ours.
Turn the feature off with `dataValidation: false`.
