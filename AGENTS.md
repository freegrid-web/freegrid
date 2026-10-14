# Notes for coding agents

FreeSheet is an independent, MIT-licensed, Excel-style spreadsheet for the web (pnpm monorepo), the first component
of the FreeGrid family (`@freegrid/*` on npm, one repository per component). Read `CONTRIBUTING.md` first: its
clean-room, test, commit and TypeScript rules apply to every change.

## Repository

- `packages/sheet`: FreeSheet (`@freegrid/sheet` on npm; `@freegrid/core` was its name up to 0.2.0).
  - `src/core.ts` is the grid (`Core` class); `src/tableView.ts` connects it to Walkontable.
  - `src/3rdparty/walkontable/`: the rendering engine (virtual rendering, overlays for frozen rows, columns and
    headers, selection borders). TypeScript.
  - `src/plugins/*`, `src/editors/*`, `src/renderers/*`, `src/validators/*`, `src/selection/*`: TypeScript.
  - Tests: `test/unit` (Vitest), `test/e2e` and `src/plugins/*/test/*.e2e.js` (Jasmine in a real browser),
    `src/3rdparty/walkontable/test` (Walkontable's own Jasmine specs), `test/build` (dist checks).
- `packages/docs`: VitePress docs; the API reference is generated from the JSDoc of `core`, `pluginHooks`,
  `defaultSettings` and the plugins.
- `tools/`: test runners and baseline comparison.

## Commands

Run from the repository root unless noted.

```sh
pnpm install
pnpm lint                 # ESLint for the whole repo (an unused eslint-disable comment is an error)
pnpm typecheck            # tsc
pnpm build                # Vite build into packages/sheet/dist (the browser tests use dist/)
pnpm docs:build
```

In `packages/sheet`:

```sh
pnpm test:unit            # Vitest + comparison with the upstream baseline
pnpm test:types           # type tests of the public .d.ts
pnpm test:dist            # checks of the built files (run `pnpm build` first)
```

Browser tests need Playwright's browsers. Where they can't be installed (WSL without sudo), run them in Docker
with `tools/in-playwright-docker.sh` (from `packages/sheet`):

```sh
../../tools/in-playwright-docker.sh pnpm test:e2e            # Chromium, compared with the baseline
../../tools/in-playwright-docker.sh pnpm test:e2e:min        # the minified build
../../tools/in-playwright-docker.sh pnpm test:e2e:firefox    # only failures not in test/runner/known-failures.json fail
../../tools/in-playwright-docker.sh pnpm test:e2e:webkit
../../tools/in-playwright-docker.sh pnpm test:walkontable     # Walkontable's own specs
```

A subset: `node build/build-tests.js e2e` (bundles the specs), then
`../../tools/in-playwright-docker.sh node test/runner/run.js --suite e2e --grep '<part of a spec name>'`.
The browser tests run against `dist/`: run `pnpm build` after changing `src/`.

A change is ready when lint, typecheck, unit, types, build, dist, `e2e`, `e2e:min`, Firefox, WebKit, Walkontable,
the docs build and the docs smoke test (`pnpm --dir packages/docs test:smoke`, needs the docs build) all pass.

## Working rules

- One topic per PR, to `main`, small enough to review. PR descriptions follow `.github/PULL_REQUEST_TEMPLATE.md`
  (What / Why / Tests); leave the two checkboxes unticked for the maintainer.
- `main` is merged through a merge queue by the maintainer. A PR in the queue is locked: do not push to it; put a
  follow-up into a new PR. Base PRs on `main`, not on another PR's branch.
- No AI attribution lines in commits or PRs (no `Co-Authored-By` for an agent, no "Generated with …").
- Never copy code, tests or docs from Handsontable 7.0 or later or from HyperFormula, and do not mention them in
  issues, PRs, commits, code comments or docs. Describe problems and fixes in FreeSheet's own words.
- Every behavior change gets a spec that fails without the change; run it against the old code to see it fail.
  A pure refactor changes no spec. Add a `CHANGELOG.md` entry for anything a user could notice.
- The docs model must not change by accident: when touching `core.ts`, `pluginHooks.ts`, `defaultSettings.ts` or a
  plugin's main file, compare `buildReference()` from `packages/docs/api/reference.mjs` before and after.

## Current assignment: measured performance fixes (data operations)

Small, measured speed-ups in data operations, **without changing how FreeSheet behaves**. The rendering work (row
geometry cache, lazy cell meta, reusing DOM rows, batching layout reads) is a separate stage-4 design in
`docs/specs/` and is **out of scope** here: do not touch `viewportRows`, `viewportColumns`, `overlays`, the overlay
`sumCellSizes` code or `tableRenderer`.

Rules for every change:

- **Measure first.** Each change comes with before/after numbers from the same build setup, for a small case (where
  the old code may be faster) and a large one. Put the numbers in the PR. No change without a measured gain.
- **Pick the data structure by use, not by style.** `Set`/`Map` for repeated membership checks or lookups in large
  lists, an inverse map for reverse index lookups, `WeakMap` for data tied to an object or DOM node, `Map` instead of
  a plain object for dictionaries keyed by user input. Arrays stay where order matters, for iteration and for small
  lists. No `forEach` → `for` or `[]` → `Set` rewrites for style alone.
- **Same behavior.** Keep order, duplicates, `NaN` and sparse-array behavior, hook order and hook call counts. Each
  change gets specs that pin the behavior (they pass before and after), and a spec that fails before the change
  if behavior is meant to change (it should not be).
- One topic per PR, in this order:
  1. `tools/performance`: a dependency-free benchmark runner (browser scenarios on the production build plus
     microbenchmarks), so every later PR can show before/after numbers. Document how to run it.
  2. Removing many rows: `dataMap.filterData` checks membership with `indexOf` for every row (O(N×K)); use a
     `Set` built once, after `beforeDataFilter`, with the small-list path kept if it is faster.
  3. `mixins/arrayMapper.ts`: bulk `removeItems`/`unshiftItems`/`insertItems` without per-item `splice` and nested
     `filter`; a reverse lookup for `getIndexByValue` (`indexOf` today), rebuilt only when the map changes.
  4. Index translation: count how often `modifyRow`/`modifyCol`, `columns` (as a function) and `colToProp`/`propToCol`
     run for one render, `getColHeader` and a paste; cache results only where it is safe to invalidate.
  5. Paste and `populateFromArray`: avoid scanning the same column or row once per cell.
  6. Sorting dates and times: parse each value once per sort, not inside the compare function.
- Each PR: all the checks above pass (lint, typecheck, unit, types, build, dist, the three browser E2E suites,
  Walkontable, docs build and smoke). Add a `CHANGELOG.md` entry under "Changed" for a user-visible speed-up.
