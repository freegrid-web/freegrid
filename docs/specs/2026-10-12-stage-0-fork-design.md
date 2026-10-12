# FreeGrid — Stage 0: Fork & Modern Toolchain

- **Status:** Draft for review
- **Date:** 2026-10-12
- **Scope:** Stage 0 of the FreeGrid roadmap (see [Roadmap](#roadmap))

## 1. Purpose

Handsontable was MIT-licensed until version 6.2.2 (December 2018). From 7.0 on it became
commercial. Many developers who built on it were left without a free, maintained option.

FreeGrid continues the last MIT version as a community project that stays MIT. The long-term
goal is a complete, free, Excel-like data grid component for the web, gradually rewritten in
modern TypeScript.

**Stage 0 delivers the foundation:** the 6.2.2 code, with its history, rebranded as FreeGrid, built
and tested with a modern toolchain on Node 24, and with CI running on GitHub. Runtime behavior stays
identical to Handsontable 6.2.2.

## 2. Success Criteria

Stage 0 is done when all of the following hold:

1. `github.com/freegrid-web/freegrid` exists. Its history contains every upstream commit up to and
   including `c2ba2dc02e3eb883a58f976ef5944fa629dc981d` (tag `6.2.2`) and no upstream commit after it.
2. On a clean checkout with Node 24 LTS, `pnpm install && pnpm build && pnpm test` succeeds.
3. Every test that passes in the **baseline** (section 6.1) also passes on the new toolchain. The
   only exceptions are tests explicitly marked `xit` with a linked GitHub issue and a written reason.
4. The required CI jobs (section 7) are green on `main`.
5. The public JS API behaves as in Handsontable 6.2.2, under the name `FreeGrid`.

## 3. Non-Goals (Stage 0)

- No behavior changes or new features.
- No TypeScript conversion of source files.
- No mass reformatting (it would destroy `git blame` attribution).
- No npm publishing, docs site, framework wrappers or dependency bots. These come in Stage 1.
- No CSS class renaming (`.handsontable`, `.ht*`). That comes in v2, with a migration guide.
- No replacement of `moment`, `numbro` or `pikaday`.

## 4. Repository, History & Legal

### 4.1 Repository construction

- Source: `https://github.com/handsontable/handsontable.git`, tag `6.2.2`, commit `c2ba2dc`.
- Fetch the history reachable from `c2ba2dc` only. Create `main` at `c2ba2dc` and add FreeGrid
  commits on top.
- Verification: `git rev-list main` must not contain any upstream commit that is not an ancestor
  of `c2ba2dc`.
- Push to `freegrid-web/freegrid` with one tag, `handsontable-6.2.2`, on `c2ba2dc`. No other upstream
  tags or branches are pushed.

### 4.2 License and notices

- `LICENSE` keeps the original MIT text and both original copyright lines, and adds
  `Copyright (c) 2026 FreeGrid contributors`.
- All new code is MIT.
- `README.md` states: *"FreeGrid is a fork of Handsontable 6.2.2, the last MIT-licensed release.
  FreeGrid is not affiliated with or endorsed by Handsoncode."*

### 4.3 Clean-room rule

`CONTRIBUTING.md` states that no code, tests, docs or assets may be taken from Handsontable 7.0 or
later, or from HyperFormula. Contributions that appear to be derived from them are rejected.

### 4.4 Branding removal

- Delete `CNAME`, `bower.json`, `.bowerrc`, `handsontable.jquery.json`, `update.json`, `.travis.yml`,
  the committed build outputs `dist/` and top-level `languages/` (generated from `src/i18n/languages`),
  `package-lock.json` and `yarn.lock`.
- Keep `lib/`. It holds vendored MIT runtime code that `src/` imports (SheetClip, autoResize, jsonpatch).
  Keep `test/lib/` too (jQuery, jquery.simulate, backbone, lodash.underscore, normalize.css), which the E2E
  specs use.
- Remove the Handsontable Pro license-key check: `_injectProductInfo` and `_checkKeySchema` in
  `src/helpers/mixed.js`, and the two `HOT_PACKAGE_TYPE !== 'ce'` branches in `src/core.js`. This code
  never runs in the CE build, so behavior does not change.
- Replace Handsontable logos and links in README, CHANGELOG header, `.github/` templates and code
  comments that point users to Handsoncode resources.
- Rewrite `CONTRIBUTING.md` and `.github/` issue templates for FreeGrid. Keep `CODE_OF_CONDUCT.md`
  and point its contact address to the FreeGrid maintainers.

### 4.5 Renaming depth

| Layer | Example | Stage 0 decision |
|---|---|---|
| JS API | `new Handsontable(el, opts)` | Primary export `FreeGrid`. A `Handsontable` alias exists **only** in the `freegrid/compat` entry. |
| CSS classes | `.handsontable`, `.htCore` | Unchanged until v2. |
| File and package names | `handsontable.full.js`, `handsontable.css`, `handsontable.d.ts` | Renamed to `freegrid.*`. |
| Build-time constants | `process.env.HOT_VERSION` etc. | Renamed to `__FG_VERSION__`, `__FG_BUILD_DATE__`, `__FG_PACKAGE_NAME__`. `HOT_RELEASE_DATE` is dropped (only the license check used it). `HOT_PACKAGE_TYPE` and `HOT_BASE_VERSION` are removed together with the code that used them (see 4.4). |
| Global namespace in the UMD build | `window.Handsontable` | `window.FreeGrid`. Loading `dist/compat.js` afterwards also sets `window.Handsontable`. |

Internal identifiers such as variable names or `hot` instances are not renamed in Stage 0.

## 5. Structure & Build

### 5.1 Layout

pnpm workspace monorepo. The original files move with `git mv`, so history follows them.

```
freegrid/
├── packages/
│   └── freegrid/
│       ├── lib/            (vendored runtime code)
│       ├── src/            (locales live in src/i18n/languages)
│       ├── test/
│       ├── types/freegrid.d.ts, types/compat.d.ts
│       ├── vite.config.js
│       └── package.json
├── docs/specs/
├── .github/workflows/
├── pnpm-workspace.yaml
├── package.json            (private; workspace scripts)
└── LICENSE, README.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md, CHANGELOG.md
```

### 5.2 Toolchain

| Concern | Before | After |
|---|---|---|
| Runtime | Node ~8–10 | Node 24 LTS (`engines` and `.nvmrc`) |
| Package manager | npm/yarn | pnpm (version pinned via `packageManager`) |
| Bundler | Webpack 3 + Babel 7 | Vite 7 library mode, `build.target: 'es2020'`. No Babel. The `@babel/polyfill` imports in `src/index.js` and the walkontable index are removed, because ES2020 browsers need no polyfills. |
| Build constants | Babel inline-env plugin | Vite `define` |
| Lint | ESLint 4 + airbnb-base | ESLint 9 flat config with rules carried over only where they pass on existing code without edits. Lint errors are fixed only when trivial; otherwise the rule is relaxed. |
| Types | TS 2.4, `test/types` | TS 5.x, same `test/types` checks against `types/freegrid.d.ts` |
| Unit tests | Jest 23 | Vitest + jsdom |
| E2E tests | Jasmine 2.5 + Puppeteer 1 | Jasmine 5 + Playwright (see section 6) |

Browser target: ES2020 (Chrome/Edge 80+, Firefox 74+, Safari 14+). IE is not supported.

### 5.3 Published outputs (built in Stage 0, published in Stage 1)

| Entry | Content |
|---|---|
| `freegrid` | ESM build plus `types/freegrid.d.ts` |
| `freegrid/compat` | ESM, re-exports `freegrid` and adds the `Handsontable` alias |
| `freegrid/dist/freegrid.js`, `.min.js` | UMD with `moment`, `numbro` and `Pikaday` as external globals (replaces `handsontable.js`) |
| `freegrid/dist/freegrid.full.js`, `.min.js` | UMD with the three dependencies bundled, also exposed as `window.moment` and `window.numbro`, as the original did (replaces `handsontable.full.js`) |
| `freegrid/dist/compat.js` | Small UMD script, loaded after either bundle, that sets `window.Handsontable = window.FreeGrid` |
| `freegrid/dist/freegrid.css`, `freegrid.full.css` (+ `.min.css`) | Styles (renamed from `handsontable.css`, class names unchanged). The `full` variant includes the Pikaday CSS. |
| `freegrid/dist/languages/*.js` | Locale UMD files (`all.js` plus one per locale) that register themselves on `window.FreeGrid` |

CommonJS output is dropped.

### 5.4 Dependencies

- `moment` 2.20.1 → 2.30.x, a security fix (CVE-2022-31129, CVE-2022-24785). Its API is unchanged.
- `numbro`, `pikaday`: keep the current major version and update to the latest patch only.
- All build and test devDependencies are replaced as listed in 5.2.

## 6. Testing

### 6.1 Baseline

Before any FreeGrid change, run the original 6.2.2 test suites with their original toolchain in a
container (Node 10, the original lockfile). Record the per-test pass/fail result in
`docs/baseline/6.2.2-results.json`, together with the container recipe used. This list defines
"passing" for success criterion 3.

If the original toolchain cannot run at all, the fallback is: the first run on the new toolchain
becomes the baseline, and every failing test gets an investigated issue.

### 6.2 Suites

| Suite | Size | New runner |
|---|---|---|
| Unit (`test/unit/**/*.spec.js`, `src/plugins/**/*.unit.js`) | 53 files (36 + 17) | Vitest with jsdom. A small shim (`test/setup/jasmine-shim.js`) provides `jasmine.createSpy`, `jasmine.any`, `jasmine.addMatchers`, global `spyOn` with `.and.*`, and `jest` → `vi`, so spec files stay unchanged. |
| E2E (`test/e2e/**/*.spec.js`, `src/plugins/**/test/*.e2e.js`) | 136 files (110 + 26). The 3 mobile specs stay excluded, as in the original. | Jasmine 5 in a real browser. Specs are bundled with Vite and driven by Playwright. They run against `dist/freegrid.js` plus `dist/compat.js`, because the specs use the global `Handsontable`. |
| Walkontable (`src/3rdparty/walkontable/test/spec`) | 18 files | Same as E2E, with its own bundle |
| Production | E2E specs | Same E2E specs run against `dist/freegrid.min.js` plus `dist/compat.js` |
| Types | `test/types`, `src/plugins/**/test/*.types.ts` | `tsc --noEmit` against `types/compat.d.ts` |

The suites contain about 2,066 test cases in total. Jasmine-specific APIs (`createSpy`, `.and.*`,
`jasmine.any`, custom matchers, `done` callbacks) are used heavily. Spec files stay unchanged except
for mechanical import or path fixes and Jasmine 2→5 API changes. Migration to Vitest browser mode
happens in Stage 2, file by file, together with the TypeScript conversion.

### 6.3 Rules

- Never delete or weaken a test to make it pass.
- A test that fails for an environmental reason (for example, newer Chromium layout metrics) is
  changed to `xit` with a comment `// FG-SKIP: <reason> — <issue URL>`.
- `Performance.spec.js`, `MemoryLeakTest.js` and mobile specs keep the same status they had in the
  baseline, whether included or excluded.

### 6.4 Browsers

- Chromium (Playwright-bundled) is required.
- Firefox and WebKit are informational and non-blocking. Their failures are triaged into Stage 1
  issues.

## 7. CI (GitHub Actions)

The workflow `ci.yml` runs on push to `main` and on pull requests:

```
install (pnpm, cached) → lint → unit → types → build
                                                ├→ e2e-chromium (dev build)    [required]
                                                ├→ e2e-chromium (min build)    [required]
                                                ├→ walkontable-chromium        [required]
                                                └→ e2e-firefox, e2e-webkit     [informational, continue-on-error]
```

`main` is protected so that required jobs must pass before merge. No release workflow in Stage 0.

## 8. Commit Conventions

- Conventional Commits (`build:`, `chore:`, `test:`, `docs:`, `fix:`).
- One logical change per commit. Do not mix file moves with content edits, so that `git log --follow`
  stays useful.
- No AI co-author or "generated by" trailers.

## 9. Risks

| Risk | Mitigation |
|---|---|
| The original toolchain does not run, so there is no clean baseline | The fallback in 6.1 applies. Failures are triaged one by one rather than bulk-skipped. |
| Vite or Rollup output differs from Webpack 3 (module order, side-effect imports, CSS order) | E2E runs against both the dev and the min builds. Plugin registration side effects are checked explicitly in `src/plugins/index.js`. |
| Jasmine 2.5 → 5 breaking changes | Fixed mechanically. Known areas: `done.fail`, the custom matcher API, and the clock. |
| Modern Chromium changes layout metrics that pixel-asserting tests rely on | `FG-SKIP` with an issue. Triaged in Stage 1. |
| Trademark concerns | The `Handsontable` name appears only in the compat alias, the README attribution and the LICENSE. |

## 10. Roadmap

| Stage | Content |
|---|---|
| **0** | This document |
| **1** | Publish `freegrid@1.0.0`, bug fixes, Firefox/WebKit fixes, React/Vue/Angular wrappers (`@freegrid/*`), docs site, release workflow, Renovate |
| **2** | TypeScript conversion module by module. Signals-based fine-grained reactivity (candidates: `alien-signals`, `@preact/signals-core`), not a virtual DOM. Theming via CSS custom properties (`--fg-*`) plus an optional Tailwind preset. Replace `moment` (`Intl`/Temporal or `date-fns`; decided then). Migrate tests to Vitest. |
| **3+** | Features never in MIT 6.2.2, written from scratch: filters, column dropdown menu, hidden rows/columns, nested headers, export, formulas (candidate engine: IronCalc or another MIT engine) |

Stage 2 directions are recorded here for context only. Each stage gets its own design document.
