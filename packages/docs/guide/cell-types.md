# Cell types

A cell type bundles a renderer (how a value looks), an editor (how it is edited) and a validator (what is
allowed). Set it with `type`, usually per column:

```js
columns: [
  { type: 'text' },
  { type: 'numeric', numericFormat: { pattern: '0,0.00' } },
  { type: 'date', dateFormat: 'YYYY-MM-DD', correctFormat: true },
  { type: 'checkbox' },
  { type: 'dropdown', source: ['Yes', 'No'] },
]
```

| Type | Notes |
| --- | --- |
| `text` | The default. |
| `numeric` | Right-aligned. `numericFormat: { pattern, culture }` uses [numbro](https://numbrojs.com) patterns. |
| `date` | A date picker. `dateFormat` uses moment format tokens; `correctFormat: true` reformats valid input. |
| `time` | `timeFormat` uses moment tokens. |
| `checkbox` | `checkedTemplate` and `uncheckedTemplate` set the stored values. |
| `dropdown` | A fixed list from `source`. |
| `autocomplete` | Suggestions from `source` (an array or a function). `strict: false` also allows other values. |
| `password` | Shows the value masked. |

## Validation

Invalid values get the `htInvalid` class. `allowInvalid: false` rejects them instead of keeping them.
Your own rule:

```js
{
  validator(value, callback) {
    callback(typeof value === 'string' && value.length <= 20);
  },
}
```

See it live in the [cell types example](../examples/cell-types).
