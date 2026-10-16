# 0.7.0: conditional formatting and the side panel

Status: agreed (2026-10-17). Release target: `0.7.0`, after the visibility work
([2026-10-16-row-column-visibility-design.md](2026-10-16-row-column-visibility-design.md)).

## Goal

Cells format themselves from their values, as in Excel: a total over 1000 turns red, a column gets a color scale, data
bars or icons. Rules are written in the settings, through the API, or in a side panel opened from the context menu.
The same side panel lists the comments of the document.

Two PRs:

1. **Conditional formatting**: rules, evaluation, drawing, settings, API, documents, docs.
2. **Side panel**: the panel in the grid's frame; the Comments panel; the Conditional formatting menu, rule editor and
   rule manager.

## Rules

```js
conditionalFormatting: [
  { range: 'F2:F20', when: 'gt', value: 1000, style: { background: '#f8d7da', color: '#842029' } },
  { range: ['B2:E20'], colorScale: ['#f8696b', '#ffeb84', '#63be7b'] },
  { range: 'A2:F20', when: '=$F2<0', style: { color: '#c00000' }, stopIfTrue: true },
  { range: 'C:C', dataBar: '#638ec6' },
  { range: 'D2:D50', iconSet: 'arrows' },
],
columns: [{ data: 'total', format: [{ when: 'gt', value: 1000, style: { fontWeight: 'bold' } }] }],
```

- `range`: one or more A1 ranges (`B2`, `B2:F20`, `C:C`, `3:5`). Ranges name data rows and columns (physical), as
  formulas do: sorting moves the values, and the rules follow them. Inserting and removing rows and columns moves
  and resizes the ranges; a range removed entirely drops its rule.
- A column's `format` is a list of rules for that whole column (no `range`), the short form on the object it
  describes (see the settings rule in the visibility design).
- Kinds (one per rule):
  - **Highlight** `when` + `value`: every filter condition (`gt`, `between`, `contains`, `empty`, `date_*`, custom
    conditions from `FreeSheet.filters.registerCondition`), plus `duplicate`, `unique`, `top` / `bottom` (`value`: a
    count, `percent: true` for a share), `aboveAverage` / `belowAverage`, and new date conditions `date_last_7_days`,
    `date_this_week`, `date_last_week`, `date_next_week`, `date_this_month`, `date_last_month`, `date_next_month`.
  - **Formula** `when: '=…'`: a formula written for the range's top-left cell, with relative references that move
    for each cell (`$` fixes a part), true when the result is TRUE or a non-zero number. Needs `formulas`; without an
    engine the rule does nothing (a warning once).
  - **Color scale** `colorScale`: 2 or 3 colors from the lowest number in the range to the highest (the middle at
    the 50th percentile).
  - **Data bar** `dataBar`: a color (or `{ color }`); a bar from 0 to the value, scaled to the range's largest
    absolute value.
  - **Icon set** `iconSet`: `arrows`, `trafficLights` or `signs`: three icons by thirds of the range (≥ 67 %,
    ≥ 33 %, below).
- Highlight and formula rules draw with `style` (`background`, `color`, `fontWeight`, `fontStyle`,
  `textDecoration`, `border`) or `className`.
- Order is priority: the first rule wins where two set the same style; `stopIfTrue` skips the rules after it for that
  cell. The column `format` rules come after the sheet's rules.
- Values are the ones the cells show (`getDataAtCell`: formula results).

## Evaluation and drawing

- Rules are kept as rectangles of physical indexes. Statistics a rule needs (minimum, maximum, percentiles, counts
  of values, the n-th largest) are computed once per rule after the data changes, over every cell of its ranges
  (hidden rows too, as Excel), and kept until the next change.
- Formula rules: the formulas, moved for each cell, go into a block of cells far to the right of the sheet in the
  formula engine (never in the grid's data), so one recalculation evaluates them all; the formulas plugin owns this
  (`setConditionFormulas(key, cells)`, `getConditionResult(key, row, column)`), and the block moves with inserted and
  removed rows like any formula.
- Drawing: an `afterRenderer` hook. Inline styles and classes the plugin set on a cell are removed before it draws
  the cell again (cells are reused while scrolling). Data bars are a background gradient; icons are a span before the
  value; color scales a background color.

## API and events

`getPlugin('conditionalFormatting')`: `addRule(rule, index?)` (returns the rule's id), `updateRule(id, rule)`,
`removeRule(id)`, `moveRule(id, index)`, `getRules()` (JSON-safe, A1 ranges), `getRulesAt(row, column)` (visual),
`clearRules(range?)` (a range removes the rules' parts inside it; no range removes every sheet rule).
Event `afterConditionalFormattingChange(rules)`. `getDocument()` saves the sheet's rules; `loadDocument()` restores
them. Changes to rules are not undoable in `0.7.0`.

## Side panel (PR 2)

- `sidePanel` lives in the grid's frame (like the formula bar and the tabs): the sheet narrows, the panel takes the
  right side, at most 320 px and at least 240 px; on a container narrower than 600 px it covers the sheet.
- API: `hot.openPanel(name, options?)`, `hot.closePanel()`, `hot.getOpenPanel()`; events `afterPanelOpen`,
  `afterPanelClose`. Panels: `comments`, `conditionalFormatting`.
- **Comments**: every comment of every sheet with its cell (`Costs!H4`), text, and `author` / `date` when the comment
  has them; a click selects the cell (switching the sheet); edit and delete in place; New adds a comment to the
  selected cell. Opened from the context menu (Show all comments).
- **Conditional formatting**: the context menu gets *Conditional formatting ▸* with Highlight Cell Rules ▸ (Greater
  Than, Less Than, Between, Equal To, Text that Contains, A Date Occurring, Duplicate Values), Top/Bottom Rules ▸ (Top
  10 items, Top 10 %, Bottom 10 items, Bottom 10 %, Above Average, Below Average), Data Bars ▸, Color Scales ▸, Icon
  Sets ▸, New Rule, Clear Rules ▸ (from selected cells, from the entire sheet), Manage Rules.
  - The rule editor: Apply to (a range, with a button that takes the selection), the kind (highlight, top/bottom,
    data bar, color scale, icon set, formula), the condition and its values, Stop if true, and the format style:
    preset styles (light red fill with dark red text, yellow, green, light red fill, red text, red border) or a
    custom one (fill, text color, bold, italic). The grid shows the rule while it is edited; Done keeps it, Cancel
    drops it.
  - Manage Rules: the rules of the selection or of the sheet, each with a preview of its style, its description and
    its range; a click edits a rule; + adds one; the bin deletes the selected one; arrows change the priority.
- Everything is built with DOM APIs (no HTML strings) and theme variables.

## Tests

Unit: A1 range parsing and moving, formula reference moving, statistics. e2e: every kind, priority and
`stopIfTrue`, ranges moving with inserted and removed rows and columns, formulas, column `format`, documents, the
panel (open, close, sizes), comments panel (list, jump across sheets, edit, delete, new), the menu, the editor (live
preview, Done, Cancel) and the manager.
