# Notes for coding agents

FreeGrid is an independent family of MIT-licensed components for the web (pnpm monorepo). Its first component is
FreeSheet, an Excel-style spreadsheet. Read `CONTRIBUTING.md` first: its clean-room, test, commit and TypeScript
rules apply to every change.

## Repository

- `packages/freegrid`: FreeSheet (`@freegrid/sheet` on npm; `@freegrid/core` was its name up to 0.2.0).
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
pnpm build                # Vite build into packages/freegrid/dist (the browser tests use dist/)
pnpm docs:build
```

In `packages/freegrid`:

```sh
pnpm test:unit            # Vitest + comparison with the upstream baseline
pnpm test:types           # type tests of the public .d.ts
pnpm test:dist            # checks of the built files (run `pnpm build` first)
```

Browser tests need Playwright's browsers. Where they can't be installed (WSL without sudo), run them in Docker
with `tools/in-playwright-docker.sh` (from `packages/freegrid`):

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
  issues, PRs, commits, code comments or docs. Describe problems and fixes in FreeGrid's own words.
- Every behavior change gets a spec that fails without the change; run it against the old code to see it fail.
  A pure refactor changes no spec. Add a `CHANGELOG.md` entry for anything a user could notice.
- The docs model must not change by accident: when touching `core.ts`, `pluginHooks.ts`, `defaultSettings.ts` or a
  plugin's main file, compare `buildReference()` from `packages/docs/api/reference.mjs` before and after.

## Current assignment

None. Walkontable stage A (TypeScript, without changing how it works) is done. New rendering approaches
(`position: sticky` instead of cloned overlays, rendering straight to the DOM, lazy cell meta) need a design in
`docs/specs/` before any code.
