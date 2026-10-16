---
api: [Conditional formatting]
---

# Conditional formatting

Cells can format themselves from their values, as in Excel: a total over 1000 turns red, numbers get a color scale,
data bars or icons. A rule applies to a range of cells and uses the value a cell shows, so formulas are formatted by
their result.

```js
new FreeSheet(container, {
  data,
  formulas: { engine: Model },
  conditionalFormatting: [
    { range: 'F2:F20', when: 'gt', value: 1000, style: { background: '#f8d7da', color: '#842029' } },
    { range: 'B2:E20', colorScale: ['#f8696b', '#ffeb84', '#63be7b'] },
    { range: 'A2:F20', when: '=$F2<0', style: { color: '#c00000' } },
  ],
});
```

## Ranges

`range` is an A1 range, or a list of them: `B2`, `B2:F20`, `C:C` (whole columns), `3:5` (whole rows). Ranges name
data rows and columns, as formulas do: sorting moves the values and the formatting with them, and inserting or
removing rows and columns moves and resizes the ranges.

For one column there is a shorter form, on the column itself:

```js
columns: [
  { data: 'region', title: 'Region' },
  { data: 'total', title: 'Total', format: [{ when: 'gt', value: 1000, style: { fontWeight: 'bold' } }] },
],
```

## Kinds of rules

| Rule | Formats |
| --- | --- |
| `when: 'gt', value: 100` | cells greater than 100; also `gte`, `lt`, `lte`, `eq`, `neq` |
| `when: 'between', value: [10, 20]` | cells between two values; also `not_between` |
| `when: 'contains', value: 'late'` | text containing a value; also `not_contains`, `begins_with`, `ends_with` |
| `when: 'empty'` | blank cells; also `not_empty` |
| `when: 'date_this_week'` | dates in a period: `date_today`, `date_yesterday`, `date_tomorrow`, `date_last_7_days`, `date_this_week`, `date_last_week`, `date_next_week`, `date_this_month`, `date_last_month`, `date_next_month`, `date_before`, `date_after` |
| `when: 'duplicate'` | values that appear more than once in the range; `unique` for once |
| `when: 'top', value: 10` | the 10 largest numbers; `percent: true` for the top 10 %; `bottom` for the smallest |
| `when: 'aboveAverage'` | numbers above the range's average; `belowAverage` |
| `when: '=$F2<0'` | cells where a formula is true (see below) |
| `colorScale: ['#f8696b', '#63be7b']` | a color from the lowest number to the highest (2 or 3 colors, `#rrggbb`) |
| `dataBar: '#638ec6'` | a bar as long as the number |
| `iconSet: 'arrows'` | icons by thirds of the numbers: `arrows`, `trafficLights`, `signs` |

Conditions added with `FreeSheet.filters.registerCondition` work here too.

Highlight and formula rules draw with `style` (`background`, `color`, `fontWeight`, `fontStyle`, `textDecoration`,
`border`) or `className` (your own CSS class).

## Formulas as conditions

`when: '=…'` is a formula written for the range's first cell; for the other cells its relative references move, as
when a formula is copied (`$` fixes a column or a row). `{ range: 'A2:F20', when: '=$F2<0' }` formats a whole row
when its F is negative. A formula rule needs `formulas`; without an engine it does nothing.

## Priority

Rules are in priority order: where two rules set the same style, the first wins; others still add their styles.
`stopIfTrue: true` stops the rules after it for the cells it formats.

## In the grid

With `contextMenu: true`, the context menu has **Conditional formatting ▸** with Excel's menu (Highlight Cell
Rules, Top/Bottom Rules, Data Bars, Color Scales, Icon Sets, New Rule, Clear Rules, Manage Rules); rules are written
in the [side panel](./side-panel). `conditionalFormatting: true` turns the plugin on without rules.

## The API

```js
const rules = hot.getPlugin('conditionalFormatting');

const id = rules.addRule({ range: 'B2:B20', when: 'lt', value: 0, style: { color: '#c00000' } });
rules.updateRule(id, { range: 'B2:B30', when: 'lt', value: 0, style: { color: '#c00000' } });
rules.moveRule(id, 0);          // highest priority
rules.getRules();               // the sheet's rules, JSON-safe, with ids
rules.getRulesAt(3, 1);         // the rules of a cell (visual row and column)
rules.clearRules('B5:B10');     // removes the rules from these cells (a larger rule keeps the rest)
rules.clearRules();             // removes every rule
rules.removeRule(id);
```

`afterConditionalFormattingChange` runs after a change. `getDocument()` saves the rules of each sheet and
`loadDocument()` restores them. `conditionalFormatting: true` turns the plugin on without rules.
