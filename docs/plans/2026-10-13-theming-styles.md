# Theming: Classic and Modern styles — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Size variables that JavaScript reads, and an opt-in Modern style (`fg-style-modern`), with Classic unchanged.

**Spec:** `docs/specs/2026-10-12-theming-design.md` §9.

## Global Constraints

- Classic (no style class) unchanged: both light snapshots in `Theme.spec.js` and all existing E2E stay green.
- No color literal outside `variables.css`; Modern sets no color literals.
- One PR (#25). No `Co-Authored-By`. Check the build's exit code.

## Review Focus

1. A style class on an ancestor added after the grid was created: row height in JS stale until `updateSettings`.
2. Custom `rowHeights` settings and `autoRowSize` must still win over the default.
3. Editors (text, autocomplete, date) must fill the taller cell and line up.
4. Context menu rows in Modern: height in JS must match the CSS.
5. Frozen rows/columns (overlays) with taller rows.

## Task 1: Size variables read by JavaScript (Classic unchanged)

- [ ] RED: E2E `Theme.spec.js` "uses --fg-row-height for rows": container with `style="--fg-row-height: 40px"`,
  `handsontable({ data: 50×3 })`; expect a body row's `offsetHeight` 40 and `hot.view.wt.wtSettings.settings.defaultRowHeight`
  40; `scrollViewportTo(49, 0)` then the last row is rendered and visible.
- [ ] `variables.css` (:root): `--fg-row-height: 23px; --fg-cell-padding-x: 4px; --fg-radius: 0; --fg-header-font-weight: normal;`
- [ ] CSS: `.freegrid th, .freegrid td` height `calc(var(--fg-row-height) - 1px)`, line-height `calc(var(--fg-row-height) - 2px)`,
  padding `0 var(--fg-cell-padding-x)`; editor/menu corners `border-radius: var(--fg-radius)`; header `font-weight`.
- [ ] `src/helpers/dom/theme.ts`: `getRowHeight(element): number` (parses `--fg-row-height` px from computed style,
  falls back to 23). `tableView.js` passes `defaultRowHeight: getRowHeight(rootElement)` to Walkontable;
  `updateSettings` re-reads it. Replace the 23s in `menu.js`, `autocompleteEditor.js`, `manualRowMove.js` with the
  instance's default row height.
- [ ] GREEN in three browsers; light snapshots unchanged; commit.

## Task 2: Modern style

- [ ] RED: E2E "Modern style": wrapper `fg-style-modern` → row `offsetHeight` 32, cell padding-left 8px, header
  font-weight etc.; with `fg-theme-dark` too: dark background; context menu container has `fg-style-modern` and its
  rows are 32px; the text editor's height equals the cell's.
- [ ] `variables.css`: `.fg-style-modern, [data-fg-style="modern"]` block (sizes, font, radius, shadow) and a derived
  block on grid parts inside/at it remapping header colors to base variables; `theme.ts` copies `fg-style-*`.
- [ ] GREEN three browsers; commit.

## Task 3: Docs

- [ ] Playground: Classic / Modern switch (sets `data-fg-style` on the frame); re-create or `updateSettings({})` the
  grid after a style change. Theming page: "Styles" section. Smoke test still green.
- [ ] Commit, full verification (all six browser runs), review, push.
