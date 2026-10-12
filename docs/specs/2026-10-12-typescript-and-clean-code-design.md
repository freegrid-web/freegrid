# FreeGrid — TypeScript rewrite and clean code (Stage 2a)

- **Status:** Draft for review
- **Date:** 2026-10-12
- **Comes before:** the first npm release (`0.1.0`)

## 1. Goal

Turn the inherited code into simple, clean, modern FreeGrid code, before the first release:

- written in TypeScript, in small files that each have one job;
- built on ES2020+ and the platform's built-in APIs instead of homegrown helpers and IE workarounds;
- with the same behavior. The public API may change where it simplifies things (we are `0.x`), and every
  change is listed in the CHANGELOG.

## 2. Principles (the definition of "clean code" for this project)

1. **One responsibility per file.** Aim for files under ~300 lines; a file above ~500 lines needs a reason.
2. **Classes, not constructor functions or 3,000-line closures.** Private state uses `#private` fields.
3. **Use the platform.**
   - `Array`/`Object` methods instead of `arrayEach`/`objectEach`.
   - `classList`, `closest` and `matches` instead of their reimplementations.
   - `addEventListener(…, { signal })` with `AbortController` instead of manual listener bookkeeping.
   - `ResizeObserver`, `queueMicrotask` and `structuredClone`, wherever they replace custom code.
4. **No dead code.**
   - Remove IE and old-browser branches (`isIE8`, `isIE9`, `attachEvent`, `createEventObject`, …).
   - Remove unused helpers and Pro-only leftovers.
5. **Strict TypeScript.**
   - `strict: true`.
   - No `any` in new or converted code unless it is commented and justified.
   - Public types come from the source. The hand-written `freegrid.d.ts` is retired at the end.
6. **Readable names.**
   - Internal abbreviations such as `hot`, `wot`, `priv` and `TD` are replaced by descriptive names in
     converted code.
   - Upstream comments that no longer explain anything are removed.
7. **Tests stay green at every step.**
   - Every PR keeps unit, dist and E2E green in Chromium, Firefox and WebKit, against the baseline and
     the known-failures lists.
   - No test is deleted or weakened. A test changes only when the behavior it checks was deliberately
     changed, and the PR says so.

## 3. Approach: bottom-up, one module group per PR

Mixed JS/TS works throughout. Vite compiles TS, and `allowJs` lets unconverted modules import converted ones
and the reverse. Modules are converted from the leaves up, so each converted module only depends on modules
that are already typed.

| Phase | Content | Size |
|---|---|---|
| **1. Setup** | `tsconfig` (strict, `allowJs`), TS in Vite/Vitest/ESLint, `pnpm typecheck` in CI, first file converted as the pattern | 1 PR |
| **2. Cleanup** | Remove IE/legacy branches and polyfill-era helpers. Replace `EventManager` bookkeeping with `AbortController` (29 call sites). Swap homegrown DOM/array/object helpers for built-ins | 2–3 PRs |
| **3. Foundations** | `helpers/`, `utils/`, `i18n/`, `validators/`, `cellTypes/`, `renderers/` | 3–4 PRs |
| **4. Engine** | Walkontable (24 files, 7,300 lines): the rendering engine, with typed overlays, viewport and table | 3–4 PRs |
| **5. Interaction** | `selection/`, `editors/`, `editorManager`, `tableView`, `dataMap`, `dataSource` | 3–4 PRs |
| **6. Core** | `core.js` split into `src/core/` (see 4), `defaultSettings` and `pluginHooks` split into typed settings and hook definitions per feature | 3–4 PRs |
| **7. Plugins** | 87 files, 17,000 lines, one or two plugins per PR, largest first: mergeCells, columnSorting, comments, manual move/resize, customBorders, contextMenu, undoRedo | 5–7 PRs |
| **8. Types and docs** | Generate `types/` from source, retire `freegrid.d.ts`, generate the API reference for the docs site, `0.1.0` | 1–2 PR |

The E2E specs stay in JavaScript (Jasmine) during this stage. Moving them to Vitest browser mode in
TypeScript is a separate, later piece of work.

## 4. Splitting `core.js`

`core.js` is one 3,600-line constructor closure. It becomes a folder whose `Core` class only creates, wires
and destroys the parts; each concern lives in its own module:

```
src/core/
  Core.ts             lifecycle (init, destroy), wiring, hooks facade (~300 lines)
  data/
    access.ts         getData*, getSourceData*, setDataAtCell/RowProp, populateFromArray, splice*
    alter.ts          insert/remove rows and columns (today's internal grid.alter, ~700 lines → further split)
    changes.ts        validate-then-apply pipeline for edits (validateChanges, applyChanges, queue)
  meta/
    cellMeta.ts       get/set/remove cell meta, meta for rows
    lookups.ts        renderer/validator/editor lookup
  validation.ts       validateCell(s)/Rows/Columns
  selection.ts        selectCell(s)/Rows/Columns/All, getSelected*, deselect
  dimensions.ts       countRows/Cols, offsets, row heights, column widths, headers
  settings.ts         updateSettings and settings expansion
```

The public instance API (`grid.getDataAtCell()`, `grid.selectCell()`, …) stays on `Core` as thin methods that
delegate to these modules. Users see the same API, and the implementation becomes navigable.

The same rule applies to every file above ~500 lines (`defaultSettings`, `pluginHooks`, `helpers/dom/element`,
`dataMap`, the largest plugins).

## 5. Public API changes allowed in this stage

Each of these is listed in the CHANGELOG with a migration note:

- removing `FreeGrid.helper.*` / `FreeGrid.dom.*` functions that only re-implement built-ins;
- removing IE-specific behavior;
- renaming internal-looking public members, only when a clear replacement exists.

Changes to settings, hooks and instance methods that users rely on are not part of this stage.

## 6. Risks

| Risk | Mitigation |
|---|---|
| Behavior drift while restructuring | Tests at every PR. Restructuring PRs move code without changing it, and behavior changes go in separate PRs. |
| Long-lived branches conflicting | Small PRs merged to `main` one after another, never a big-bang branch. |
| Types that do not match runtime | Type tests (`test/types`) run against generated types before `freegrid.d.ts` is retired. |
| Scope creep into new features | New features (filters, formulas, signals, theming) are out of scope for this stage. |
