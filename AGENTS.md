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

- Rendering direction: keep DOM; Canvas is deferred. Read
  [the decision and performance handoff](docs/specs/2026-10-15-dom-rendering-and-canvas-decision.md) before
  proposing a rendering rewrite, framework cell hosts or further Canvas work.
- Simple settings: a feature's settings go on the object they describe (a column in `columns`, a row object), not in
  a separate setting that names columns or rows by index; indexes are for API methods. Older forms from Handsontable
  (`nestedHeaders`, `collapsibleColumns` lists, …) keep working, documented as older, until `1.0`.
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

## Current assignment

- **Done:** measured data-operation fixes (row removal, mapper bulk operations, column headers, nested writes) and
  `tools/performance`. A reverse-lookup cache for the mappers was not adopted: it needs mappers that keep their
  arrays private first.
- **Open, small:** sorting dates and times parses each value inside the compare function; parse once per sort
  (measure with `tools/performance`, same rules as before: numbers before/after, unchanged behavior, specs).
- **Stage 4, rendering:** the shared geometry index from
  [the large-grid design](docs/specs/2026-10-15-large-grid-performance-design.md) is the next rendering work. It
  touches `viewportRows`, `viewportColumns`, `overlays`, `sumCellSizes` and `tableRenderer`; agree on the owner
  before starting, so two agents never change these files at the same time.
