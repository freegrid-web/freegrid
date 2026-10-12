# TypeScript Phase 2c-1 (Cleanup: array helpers → built-ins) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the call sites of `arrayMap`, `arrayFilter`, `arrayReduce`, `arraySum` and `arrayMax` outside
`src/helpers/` with built-in array methods, with the same behavior, including sparse arrays and array-likes.

**Architecture:** First slice of Phase 2c in the spec ("swap homegrown DOM/array/object helpers for built-ins"). The
helpers differ from the built-ins in two ways that matter: they turn array-likes into arrays (`Array.from`), and they
**visit holes** in sparse arrays (as `undefined`), where `map`/`filter`/`reduce` skip them. So every call site is
classified first:
- **Dense** (built by a loop from 0, a literal, `map`/`filter`/`sort` results, `Object.values`, selection ranges):
  use the native method.
- **Possibly sparse or array-like:** use a form that keeps the helper semantics: `Array.from(a, fn)` for `arrayMap`
  (it visits holes and accepts array-likes), `a.includes(undefined)` for "is any entry missing" (it treats holes as
  `undefined`), or keep the helper.

`arrayEach`/`objectEach` (early exit with `return false`, 155 sites) and the class-name DOM helpers (they also add
the legacy class names from #14) are **not** in this slice; they need their own plans. The exported helpers stay
(they are public `FreeGrid.helper.*`); removing them is decided when `helpers/array` is converted in Phase 3.

**Tech Stack:** JavaScript (ES2020), Vitest, Jasmine E2E via Playwright.

**Spec:** `docs/specs/2026-10-12-typescript-and-clean-code-design.md` (§2.3 "Use the platform", §3 phase 2)

## Global Constraints

- Same behavior. Unit, dist, types and E2E green in Chromium (baseline), Firefox and WebKit (known-failures).
- No public API change in this PR (helpers stay exported). No test deleted or weakened.
- Code stays `.js`. Package filter `@freegrid/core`. Browser tests locally through `tools/in-playwright-docker.sh`.
- One PR to `main`, squash merge (no renames). **No `Co-Authored-By` lines.**

## Review Focus

1. **Sparse `heights`/`widths` in autoRowSize/autoColumnSize.** `isNeedRecalculate()` counts holes as "not
   calculated". A native `filter` would skip them and report `false` while rows are still pending. Pinned in Task 1.
2. **`new Array(count)` in `core.js` (`spliceWith` value factory).** Native `map` leaves holes, so inserted rows
   would be empty slots. Covered by existing `Core_alter` E2E specs; pinned explicitly in Task 1.
3. **`priv.cellSettings` is sparse** (rows never rendered). `getCellsMeta()` uses `arrayFlatten`, which is out of
   scope and must stay untouched.
4. **User-provided arrays** (autocomplete `source` values) may be sparse or array-like: use `Array.from`.
5. **Callbacks using the 3rd/4th argument** (`index`, `array`): `Array.from`'s map function gets only
   `(value, index)`. Check each converted callback's parameter list.

---

## Task 0: Branch

```bash
cd /home/mindaugas/Projects/excel
git fetch origin
git switch -c refactor/array-helpers-to-builtins origin/main
git add docs/plans/2026-10-12-ts-phase-2c1-array-helpers.md
git commit -m "docs: TypeScript phase 2c-1 (array helpers) plan"
```

---

## Task 1: Pin the sparse-array behavior

**Files:**
- Modify: `packages/freegrid/src/plugins/autoRowSize/test/autoRowSize.e2e.js`
- Modify: `packages/freegrid/src/plugins/autoColumnSize/test/autoColumnSize.e2e.js`
- Modify: `packages/freegrid/test/e2e/Core_alter.spec.js` (only if no existing spec inserts rows into data whose
  `dataSchema`/value factory creates objects; check with `grep -n "dataSchema" test/e2e/Core_alter.spec.js` first)

- [ ] **Step 1: autoRowSize**

Add to the top-level `describe` of `autoRowSize.e2e.js`:

```js
  it('should report that recalculation is needed while some rows are not measured yet', async() => {
    const hot = handsontable({
      data: Handsontable.helper.createSpreadsheetData(500, 5),
      autoRowSize: { syncLimit: 5 },
    });
    const plugin = hot.getPlugin('autoRowSize');

    // Only the first rows are measured synchronously; the rest are holes in the `heights` array.
    expect(plugin.isNeedRecalculate()).toBe(true);

    await sleep(1500);

    expect(plugin.isNeedRecalculate()).toBe(false);
  });
```

- [ ] **Step 2: autoColumnSize**

Same in `autoColumnSize.e2e.js`, with `createSpreadsheetData(5, 500)`, `autoColumnSize: { syncLimit: 5 }` and
`hot.getPlugin('autoColumnSize')`.

- [ ] **Step 3: Both pass on the current code, and fail on a native `filter`**

```bash
cd /home/mindaugas/Projects/excel
tools/in-playwright-docker.sh bash -c "cd packages/freegrid && node build/build-tests.js e2e >/dev/null && node test/runner/run.js --suite e2e --grep 'recalculation is needed' --json /tmp/p.json | tail -1"
```
Expected: `2070+ specs, 0 failed` (the two new specs ran: check the count of non-pending specs is 2).

Then temporarily change `autoRowSize.js` `isNeedRecalculate` to `return !!this.heights.filter(item => item === void 0).length;`
and rerun: Expected: 1 failed. Revert with `git checkout`.

(If `sleep` is not a test helper global, use `await new Promise(r => setTimeout(r, 1500))`. If the async measuring
takes longer than 1.5 s in WebKit, raise the wait and say so in the ledger.)

- [ ] **Step 4: Commit**

```bash
git add packages/freegrid/src/plugins/autoRowSize/test packages/freegrid/src/plugins/autoColumnSize/test
git commit -m "test: pin isNeedRecalculate while rows/columns are still being measured"
```

---

## Task 2: Replace the call sites

**Files:** the call sites below (all outside `src/helpers/`). Remove an import from `helpers/array` when nothing in
the file uses it any more.

| File:line (before) | Input | Replacement |
|---|---|---|
| `core.js:295` `arrayMap(new Array(count), () => valueFactory())` | sparse by construction | `Array.from({ length: count }, () => valueFactory())` |
| `core.js:318` `arrayReduce(sortedIndexes, fn, [])` | dense (sorted copy) | `sortedIndexes.reduce(fn, [])` |
| `core.js:1315` `arrayMap(selection.getSelectedRange(), …)` | dense | `.map(…)` |
| `plugins/contextMenu/utils.js:7` `arrayMap(selRanges, …)` | dense | `selRanges.map(…)` |
| `plugins/observeChanges/utils.js:16,29,41` | dense (patch lists) | `.filter`/`.map` |
| `editors/autocompleteEditor.js:412,413` | user `source` (412), dense (413) | `Array.from(values, value => stringify(value))`; `stringifiedValues.map(…)` |
| `plugins/customBorders/customBorders.js:513` | `Object.values` | `values.reduce(fn, 0)` |
| `plugins/customBorders/customBorders.js:531,573` | dense | `.map(…)` |
| `plugins/contextMenu/menu.js:112` `arrayFilter(this.menuItems, …)` | dense | `.filter(…)` |
| `plugins/contextMenu/menu.js:679` `arrayReduce(data, fn, 0)` | dense | `data.reduce(fn, 0)` |
| `plugins/columnSorting/columnStatesManager.js:125` | dense | `.map(…)` |
| `plugins/columnSorting/columnSorting.js:228,282,314,389,575,584,585,597` | dense (configs, column lists) | `.map(…)` |
| `plugins/autoColumnSize/autoColumnSize.js:402` `arrayReduce(columnHeaders, fn, [])` | `getColHeader()` array | `columnHeaders.reduce(fn, [])` |
| `plugins/autoColumnSize/autoColumnSize.js:442` `!!arrayFilter(this.widths, i => i === void 0).length` | **sparse** | `this.widths.includes(void 0)` |
| `plugins/autoColumnSize/autoColumnSize.js:497` | dense (`changes`) | `.map(…)` |
| `plugins/autoRowSize/autoRowSize.js:392` `!!arrayFilter(this.heights, …).length` | **sparse** | `this.heights.includes(void 0)` |
| `mixins/arrayMapper.js:101` `arrayReduce(removedItems, fn, 0)` | dense | `removedItems.reduce(fn, 0)` |
| `mixins/arrayMapper.js:112,131` `arrayMap(this._arrayMap, …)` | dense (filled from 0) | `.map(…)` |
| `mixins/arrayMapper.js:51` `arrayMax(this._arrayMap)` | may be empty | keep (`Math.max` differs on `[]` and `null`) |
| `plugins/undoRedo/undoRedo.js:393,397` | row arrays / headers | `Array.from(row, sortByIndexes)`; `Array.from(this.headers, sortByIndexes)` |
| `plugins/manualRowMove/rowsMapper.js:58`, `plugins/manualColumnMove/columnsMapper.js:58` | dense (filled from 0) | `.filter(i => i !== null)` |
| `selection/utils.js:151,201` `arrayReduce(orderedIndexes, fn, [])` | dense (sorted) | `orderedIndexes.reduce(fn, [])` |

Rules while editing each row:
- Before writing `.map`/`.filter`/`.reduce`, open the line and confirm the input really is what the table says (how
  it is built). If it can be sparse or array-like, use `Array.from(…)` (map) or keep the helper, and note it.
- `arrayReduce(a, fn, acc)` → `a.reduce(fn, acc)` only when an initial `acc` is passed (no 4th `initFromArray`
  argument). The callback's 4th parameter is the array in both.
- `Array.from(a, fn)` passes only `(value, index)`: check that `fn` does not use a 3rd parameter.
- `undoRedo.js` `sortByIndexes`: check its parameter list (it is used as a map function).

- [ ] **Step 1: Edit the files** as in the table.

- [ ] **Step 2: No helper calls left outside `src/helpers/`**

```bash
cd /home/mindaugas/Projects/excel/packages/freegrid
grep -rnE "\b(arrayMap|arrayFilter|arrayReduce|arraySum)\(" src --include=*.js | grep -v '/test/\|/dist/\|src/helpers/'
```
Expected: no output (`arrayMax` in `arrayMapper.js` stays on purpose).

- [ ] **Step 3: Green**

```bash
cd /home/mindaugas/Projects/excel
pnpm lint && pnpm typecheck && pnpm --filter @freegrid/core test:unit
pnpm --filter @freegrid/core build && pnpm --filter @freegrid/core test:dist
```
Expected: lint 0 errors (2 existing warnings), unit `No regressions.`, dist all pass.

- [ ] **Step 4: Commit**

```bash
git add packages/freegrid/src
git commit -m "refactor: use built-in array methods instead of arrayMap/arrayFilter/arrayReduce"
```

---

## Task 3: Full verification and PR

- [ ] **Step 1: Browser suites in Docker**

```bash
for s in build test:e2e test:e2e:min test:walkontable test:e2e:firefox test:e2e:webkit; do
  tools/in-playwright-docker.sh pnpm --dir packages/freegrid $s
done
```
Expected: Chromium `No regressions.`; Firefox/WebKit `No unexpected failures.`

- [ ] **Step 2: Push and open the PR** (title `refactor: built-in array methods instead of array helpers (phase 2c-1)`),
  body: what changed, the dense/sparse classification rule, the new E2E pins, "helpers stay exported; removal is
  decided in Phase 3", the verification list. Squash merge.
