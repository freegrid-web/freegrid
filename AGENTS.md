# Notes for coding agents

FreeGrid is an independent, MIT-licensed, Excel-style spreadsheet component for the web (pnpm monorepo). Read
`CONTRIBUTING.md` first: its clean-room, test, commit and TypeScript rules apply to every change.

## Repository

- `packages/freegrid`: the library (`@freegrid/core` on npm today; it will be renamed to `@freegrid/sheet`).
  - `src/core.ts` is the grid (`Core` class); `src/tableView.ts` connects it to Walkontable.
  - `src/3rdparty/walkontable/`: the rendering engine (virtual rendering, overlays for frozen rows, columns and
    headers, selection borders). Still JavaScript.
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

## Current assignment: Walkontable in TypeScript (stage A)

Convert `packages/freegrid/src/3rdparty/walkontable/src` (24 files, about 7,300 lines) to TypeScript **without
changing how it works**. Issue #71 lists what the rest of the grid uses from it.

- Same method as the rest of the codebase (`CONTRIBUTING.md` → TypeScript): for each group of files, a move
  commit (`git mv x.js x.ts` only), then a typing commit. Suggested PRs, in order:
  1. `cell/` (coords, range), `filter/`, `calculator/`, `settings`, `event`;
  2. `table`, `tableRenderer`, `viewport`, `scroll`, `core`, `index`;
  3. `overlay/*` and `overlays`;
  4. `border`, `selection`.
- Classes with `#private` fields where the field is not used from outside; regular methods; arrow functions for
  module-level helpers. Keep public names and the exported API (`index`) the same: the grid and its specs use them.
- Once a group is typed, replace the matching `any` stand-ins outside Walkontable (search for "Walkontable is not
  typed yet" in `src/`).
- Each PR: all the checks above pass, especially `test:walkontable` and the three browser E2E suites.
- **Out of scope for stage A:** new rendering approaches (`position: sticky` instead of cloned overlays, rendering
  straight to the DOM, lazy cell meta). They come later, as a separate design (`docs/specs/`), once the code is
  typed.
- **Ownership:** while this assignment runs, other work does not touch `src/3rdparty/walkontable/` or
  `src/tableView.ts`; this assignment does not touch other areas except the stand-in types named above.
