# 0.7.0: hidden rows and columns, filters, nested rows, column groups

Status: proposed (2026-10-16). Release target: `0.7.0`.

## Goal

FreeSheet gets the features that turn it from an editable table into a data tool:

1. **Hidden rows and columns** (`hiddenRows`, `hiddenColumns`): hide and show from the context menu or the API.
2. **Filters and a column menu** (`filters`, `dropdownMenu`): a ▾ button in each column header with sorting,
   filtering by values (a checkbox list with a search box) and by condition.
3. **Nested rows** (`nestedRows`): a tree grid. Rows have children, which expand and collapse; optional outline
   numbering (1, 1.1, 1.2, 2…).
4. **Column groups** (`nestedHeaders`, `collapsibleColumns`): header rows above the column headers that span
   several columns ("2026" over "Q1 Q2 Q3 Q4"), and groups that collapse to one column.
5. **Outline groups, Excel style** (`outline`): select rows or columns, Group, and a +/− bar with level buttons
   appears beside the headers. The last stage; it moves to `0.8.0` if `0.7.0` grows too large.

All of them hide rows or columns, so they share one mechanism in the core (below). Each stage is one PR; each PR
is complete (code, specs, docs, example, CHANGELOG) and leaves `main` releasable.

## Settings rule

Every new setting takes `true` (on, with defaults), `false`/`undefined` (off) or an object (on, with options).
`updateSettings` turns them on and off and changes options without recreating the grid. These settings belong to a
sheet: `addSheet` does not inherit them.

The names `hiddenRows`, `hiddenColumns`, `filters`, `dropdownMenu`, `nestedRows`, `nestedHeaders`,
`collapsibleColumns` and the hooks `beforeFilter`, `afterFilter`, `beforeDropdownMenuShow`, … already exist in
`defaultSettings.ts` and `pluginHooks.ts` as undocumented placeholders (marked `@pro`). They are kept, so older
configurations keep working, and their JSDoc is rewritten for FreeSheet's behaviour; the `@pro` marks go.

## 1. The shared mechanism: index visibility

### Decision: a hidden row leaves the visual order

A hidden row is **removed from the visual indexes**; it is not drawn with zero height. `countRows()` is the number
of visible rows, `countSourceRows()` stays the number of data rows. The same holds for columns (`countCols()`).

Why:

- Walkontable, the row-height calculation and the uniform-height fast path from `0.5.0` stay unchanged: they only
  ever see visible rows.
- Selection, keyboard navigation, autofill, copying and "select all" skip hidden rows without any special case.
  Excel does the same for filtered rows.
- One rule for hidden, filtered and collapsed rows.

Cost, accepted: copying a range that contains rows hidden by hand skips them (Excel copies those, and skips only
filtered rows). Pasting over a range writes to visible rows only.

### Row headers show the gaps

The row header of a visible row shows its position before hiding (`1, 2, 5, 6`), as Excel shows gaps in the row
numbers. A header next to hidden rows gets `fs-hidden-before` / `fs-hidden-after`, drawn as a double line
(`--fs-hidden-indicator-color`). Column headers do the same with letters (`A, B, E`). Custom `rowHeaders` (an array
or a function) receive the visual index as before; `getRowHeader(row)` gives the number shown.

### Order of the translation

```
visual index ──visibility──▶ ordered index ──modifyRow (sorting, row move)──▶ physical index
```

The visibility map works on the **ordered** index: sorting and moving rows apply first, hiding applies to the
result. What is hidden is stored per **physical** index (a row stays hidden when the rows are sorted).

### `IndexVisibility` (new, `src/utils/indexVisibility.ts`)

One instance for rows and one for columns, owned by `Core`. Plugins never keep their own visual-index maps.

```ts
class IndexVisibility {
  /** Sets which physical indexes a source hides (`null` or an empty set: the source hides nothing). */
  setHidden(source: string, physicalIndexes: Iterable<number> | null): void;
  isHidden(physicalIndex: number): boolean;           // hidden by any source
  isHiddenBy(source: string, physicalIndex: number): boolean;
  /** visual → ordered, ordered → visual (−1 when hidden), and the visible count. */
  toOrdered(visual: number): number;
  toVisual(ordered: number): number;
  count(total: number): number;
  /** Marks the map for a rebuild (after sorting, moving, or a source change). */
  invalidate(): void;
  /** Shifts every source's physical indexes after rows (columns) are inserted or removed. */
  onInsert(physicalIndex: number, amount: number): void;
  onRemove(physicalIndexes: number[]): void;
}
```

- Sources: `hiddenRows`, `filters`, `nestedRows`, `outline` (rows); `hiddenColumns`, `collapsibleColumns`,
  `outline` (columns). An index is visible when no source hides it, so a collapsed group and a filter combine.
- With no hidden index the map is the identity and costs nothing (no arrays, no rebuild).
- Otherwise it keeps two `Int32Array`s (visual → ordered, ordered → visual), rebuilt lazily on the first lookup
  after `invalidate()`. A rebuild is O(n) with one `modifyRow` translation per row. Target, measured with
  `tools/performance`: hiding or filtering on 1,000,000 rows under 100 ms; scrolling numbers unchanged.
- `Core` invalidates it after `afterColumnSort`, `afterRowMove`, `afterColumnMove`, `afterLoadData`,
  `updateData`, and shifts the sources in `afterCreateRow`/`afterRemoveRow` (and columns).

### Wiring in the core

- `RecordTranslator.toPhysicalRow` becomes `modifyRow(visibility.toOrdered(visual))`, `toVisualRow` the reverse;
  the same for columns.
- Every direct `runHooks('modifyRow' | 'unmodifyRow' | 'modifyCol' | 'unmodifyCol', …)` call goes through the
  translator instead: `dataMap.ts` (6 places), `editorManager.ts`, `core.ts`, `undoRedo.ts`,
  `manualRowResize.ts`, `manualColumnResize.ts`, `manualRowMove.ts`, `manualColumnMove.ts`, `validatorTime.ts`.
  This is a refactor with no behaviour change while nothing is hidden; it lands first, in its own commit, with the
  whole suite green.
- `DataMap.getLength()` and `countCols()` subtract the hidden count. The old "`modifyRow` returns `null`" trimming
  stays for compatibility.
- `mergeCells` keeps merged cells at visual positions (as it does with sorting), so they move with their rows when
  rows above them are hidden or shown; rows (columns) inside a merged cell cannot be hidden.
- Formulas are unaffected: they work on physical rows and columns. Hidden rows are still calculated.
- `getDocument()` saves `hiddenRows`, `hiddenColumns`, the filter conditions and the collapsed nodes and groups of
  each sheet; `loadDocument()` restores them.

## 2. Hidden rows and columns (PR 1)

```js
hiddenRows: true
hiddenRows: { rows: [3, 4], indicators: true }       // physical rows hidden at start
hiddenColumns: { columns: [2], indicators: true }
```

- Context menu (any selection, not only headers): "Hide rows" / "Hide columns" for the selection; "Show rows" / "Show columns" when the selection
  spans a gap (it shows the hidden rows inside it). A click on the arrows beside the double line in the headers shows them too.
- API (`getPlugin('hiddenRows')`): `hideRows(visualRows)`, `showRows(physicalRows)`, `showAllRows()`,
  `isHidden(physicalRow)`, `getHiddenRows(): number[]` (physical). A hidden row has no visual index, so showing
  takes physical indexes. Columns: the same names with `Column`.
- Hooks: `beforeHideRows(rows)` (return `false` to cancel), `afterHideRows(rows)`, `beforeUnhideRows`,
  `afterUnhideRows`; the same for columns.
- Hiding and showing are undoable.
- The old `hiddenRow`/`hiddenColumn` hooks stay registered, so configurations that listen to them still load; they
  are not fired (`isHidden` answers the question).

## 3. Filters and the column menu (PR 2)

### Column menu

```js
dropdownMenu: true
dropdownMenu: ['sort_asc', 'sort_desc', '---------', 'filter_by_condition', 'filter_by_value',
  'filter_action_bar', '---------', 'hide_column']
```

- A ▾ button in each column header (shown on hover and always while the column is filtered or sorted). It opens a
  menu built with the context menu's `Menu`, so items, keyboard handling, theming and custom items work the same.
- Default items: Sort A → Z, Sort Z → A, Clear sorting, Filter by condition, Filter by values, OK / Clear, and
  Hide column when `hiddenColumns` is on.
- Hooks: `beforeDropdownMenuShow`, `afterDropdownMenuShow`, `afterDropdownMenuHide`,
  `beforeDropdownMenuSetItems`.

### Filters

```js
filters: true
filters: { reapplyOnChange: false }
```

- **By condition**: up to two conditions per column joined by AND/OR. Conditions: `empty`, `not_empty`, `eq`,
  `neq`, `contains`, `not_contains`, `begins_with`, `ends_with`, `gt`, `gte`, `lt`, `lte`, `between`,
  `not_between`; for `type: 'date'` columns also `date_before`, `date_after`, `date_today`, `date_yesterday`,
  `date_tomorrow`.
- **By values**: a checkbox list of the column's distinct values as the cells show them (formula results,
  formatted numbers and dates), sorted, with "(Blank)", a search box and Select all. The list draws at most 1,000
  entries at a time and narrows with the search; Select all applies to every value, drawn or not.
- Columns are joined with AND. Comparisons use the value the cell shows (`getDataAtCell`, so formulas filter by
  their result); text comparisons ignore case.
- An edited row stays visible until the filter is applied again (Excel behaviour), unless
  `reapplyOnChange: true`. New rows are visible.
- The header of a filtered column gets `fs-filtered` (the ▾ becomes a funnel); the row numbers of a filtered
  sheet are drawn in the accent colour, as in Excel.
- API (`getPlugin('filters')`): `addCondition(column, name, args = [], operation = 'conjunction')`,
  `removeConditions(column)`, `clearConditions(column?)`, `filter()`, `getConditions(column)`,
  `exportConditions()`, `importConditions(conditions)`. Columns are visual; conditions are stored per physical
  column, so they follow moved columns.
- Hooks: `beforeFilter(conditions)` (return `false` to cancel), `afterFilter(conditions)`.
- Sorting a filtered sheet sorts all rows; the filter stays.

## 4. Nested rows (PR 3)

```js
nestedRows: true
nestedRows: {
  childrenKey: '__children', // the property that holds a row's children
  numbering: 'flat',         // 'outline': 1, 1.1, 1.2, 1.2.1, 2
  collapsed: false,          // true: all collapsed; a number: show levels up to it (1 = top level only)
  toggle: 'rowHeader',       // where ▸/▾ is: 'rowHeader', or 'column' (the first column, as a file tree)
  indent: 16,                // pixels per level
}
```

- Data: an array of objects; a row's children are in `childrenKey`. Array rows cannot have children.
  `getSourceData()` returns the grid's rows (every row, parents before children: physical indexes and
  `countSourceRows()` count them); `getPlugin('nestedRows').getSourceData()` returns the tree, which `getDocument()`
  saves. The plugin gives the grid its rows through the new `beforeLoadData` hook.
- Inside the grid each node is one physical row, in depth-first order. Formulas, rendering, editing and the
  visibility map see ordinary rows. Inserting a child is inserting a row (the formula engine moves references as
  for any insert).
- Collapsing a node hides its descendants (visibility source `nestedRows`); the node remembers its state.
- Context menu: Insert child row, Indent (becomes the last child of the row above on its level), Outdent (becomes
  the sibling after its parent; the rows after it under that parent become its children, so no row moves), Expand /
  Collapse, Expand all / Collapse all.
- Keyboard: <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>→</kbd> expands, <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>←</kbd>
  collapses the selected row's node.
- **Sorting** sorts each set of siblings, keeping children under their parent. Column sorting gets the tree from
  the plugin through an internal interface (`getRowTree()`), not a hook.
- **Filtering** shows the rows that match and their ancestors; while a filter is on, collapsing hides nothing (the
  filter decides what is shown). Ancestors shown only for context get `fs-nested-context` (dimmed).
- **Row moving** (drag, `manualRowMove`) is not supported together with nested rows in `0.7.0`; Indent and Outdent
  change the parent.
- **Numbering** `'outline'`: the row header shows the node's path among its siblings in the current order
  (`1.2.3`); filtered-out siblings leave gaps (`1.1, 1.3`). The header width grows to the longest number.
- Classes `fs-nested-level-0`, `-1`, … on the row's cells; `fs-nested-parent` on rows with children.
- API (`getPlugin('nestedRows')`): `expand(row)`, `collapse(row)`, `expandAll()`, `collapseAll()`,
  `getParent(row)`, `getChildren(row)`, `getLevel(row)`, `getRowNumber(row)`, `addChild(row, data?)`,
  `indent(row)`, `outdent(row)`. Rows are visual.
- Hooks: `beforeRowExpand`, `afterRowExpand`, `beforeRowCollapse`, `afterRowCollapse`, `beforeAddChild`,
  `afterAddChild`, `beforeDetachChild`, `afterDetachChild` (Outdent).

## 5. Column groups (PR 4)

```js
nestedHeaders: [
  ['Name', { label: '2026', colspan: 4 }, { label: '2027', colspan: 4 }],
  ['', 'Q1', 'Q2', 'Q3', 'Q4', 'Q1', 'Q2', 'Q3', 'Q4'],
],
collapsibleColumns: true,                         // every group wider than one column
collapsibleColumns: [{ row: 0, col: 1, show: 'last' }], // or chosen groups; show: 'first' | 'last' | offset
```

- The last row of `nestedHeaders` is the column headers; the rows above are group rows.
- Rendering: Walkontable draws one header cell per column, so a group label is drawn in the group's first visible
  column with the width of the group's visible columns (as drawn, stretched), and the borders inside the group are
  removed. The group rows are header renderers added through `afterGetColumnHeaderRenderers`: Walkontable itself
  is not changed. A group scrolled partly out of view scrolls its label with it (keeping the label in view is left
  for the stage-4 rendering work).
- A collapsible group gets a −/+ button. Collapsing hides every column of the group but the one in `show`
  (default `'first'`; `'last'` keeps a total column, as in a summary). Visibility source `collapsibleColumns`.
- Moving columns: allowed inside a group; a move across a group's border is refused.
- API (`getPlugin('collapsibleColumns')`): `collapse(row, col)`, `expand(row, col)`, `collapseAll()`,
  `expandAll()`, `isCollapsed(row, col)`. `getPlugin('nestedHeaders').getGroup(row, col)` gives the group's
  label and columns.
- Hooks: `beforeColumnCollapse`, `afterColumnCollapse`, `beforeColumnExpand`, `afterColumnExpand`.

## 6. Outline groups, Excel style (PR 5, may move to 0.8.0)

```js
outline: { rows: [[1, 4], [2, 3]], columns: [[2, 5]] }   // physical ranges, nested by level
```

- Context menu on a selection: Group rows / Ungroup rows (and columns).
- A bar to the left of the row headers (above the column headers for columns) draws a bracket per group with a
  −/+ button; level buttons 1, 2, 3 … in the corner collapse everything below that level.
- Collapsing hides the group's rows (visibility source `outline`). Groups shift with inserted and removed rows.
- The bar takes room inside the given element; the sheet keeps filling what is left.
- API (`getPlugin('outline')`): `group('rows' | 'columns', from, to)`, `ungroup(…)`, `collapse(…)`,
  `expand(…)`, `showLevel(kind, level)`, `getGroups(kind)`.

## Docs, examples, tests

- A guide page per feature (hidden rows and columns, filters, nested rows, column groups, outline), each with a
  live example; one combined example (a project plan: tree rows, outline numbering, a filter, quarters grouped in
  the header). The docs smoke test covers the new pages.
- Specs: `IndexVisibility` gets unit tests (identity, several sources, insert/remove shifts, rebuild after
  sorting). Each plugin gets e2e specs, including the combinations: filter + hidden rows, filter + sorting, filter +
  nested rows, collapse + formulas, hidden rows + merged cells, hidden columns + copy/paste, `getDocument()`
  round-trips.
- The public API lists (`Core_methods.spec.js`, `test/build/dist.test.js`, `types/freesheet.d.ts`,
  `packages/docs/api/topics.mjs`) gain the new methods and plugins.
- `tools/performance`: a hide-and-filter scenario at 1,000,000 rows.

## Order of work

| PR | Content |
| --- | --- |
| 1 | `IndexVisibility`, translator wiring (refactor commit first), `hiddenRows`, `hiddenColumns`, header gaps |
| 2 | `dropdownMenu`, `filters` |
| 3 | `nestedRows`, with sorting and filtering inside the tree, outline numbering |
| 4 | `nestedHeaders`, `collapsibleColumns` |
| 5 | `outline` (or `0.8.0`) |
| — | release `0.7.0` |

## Out of scope

- Hiding by zero height (rejected above).
- Filters that keep re-applying while typing (only with `reapplyOnChange`).
- Parent values computed from children (formulas do this).
- Dragging a row into another parent (Indent / Outdent do it).
- Dragging a whole column group by its header.
