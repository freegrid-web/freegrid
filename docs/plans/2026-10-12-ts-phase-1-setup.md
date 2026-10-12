# TypeScript Phase 1 (Setup) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mixed JS/TS works in the `freegrid` package: strict `tsconfig`, TS in Vite/Vitest/ESLint, `pnpm typecheck`
in CI, and `src/helpers/number.js` converted to `number.ts` as the pattern for the remaining modules.

**Architecture:** One `packages/freegrid/tsconfig.json` (strict, `allowJs`, `noEmit`) used only for type checking. Vite
and Vitest already compile `.ts` through esbuild, and all 890 relative imports in `src` have no extension, so a
converted module needs no import changes. ESLint gets `typescript-eslint` for `src/**/*.ts` only. A unit test
stops a stale `.js` from silently shadowing its `.ts` replacement.

**Tech Stack:** TypeScript 5.9.3 (already a devDependency), typescript-eslint 8.71.x, Vite 7, Vitest 4, ESLint 9, pnpm.

**Spec:** `docs/specs/2026-10-12-typescript-and-clean-code-design.md` (§2 principles, §3 phase 1)

## Global Constraints

- `strict: true`. No `any` in converted code unless commented and justified (spec §2.5).
- Same behavior. No test deleted or weakened (spec §2.7). Unit, dist and E2E stay green in Chromium (against
  `docs/baseline/`), Firefox and WebKit (against `packages/freegrid/test/runner/known-failures.json`).
- Type checking only: `tsc` never emits. The build stays `node build/build.js` (Vite, `target: 'es2020'`).
- `lib` matches the build target: `ES2020` + `DOM`. Browser floor: Chrome 80, Firefox 74, Safari 14.
- E2E and unit specs stay JavaScript in this stage (spec §3).
- Readable names in converted code (no `hot`, `wot`, `priv`, `TD`); drop upstream comments that no longer explain
  anything (spec §2.6).
- One PR to `main` (protected). Conventional Commits. **No `Co-Authored-By` lines** in commits or the PR.
- File moves and content edits go in separate commits (CONTRIBUTING.md).
- Run browser tests locally only through `tools/in-playwright-docker.sh`.

## Review Focus

1. **A stale `.js` next to its `.ts`.** Vite tries `.js` before `.ts`, so a leftover `number.js` would silently win
   and the TS code would never run. Expected: a unit test fails. Pinned in Task 1, Step 1.
2. **`tsc` that checks nothing.** A wrong `include`/`exclude` gives a green `pnpm typecheck` that never sees
   `number.ts`. Expected: a deliberate type error makes `pnpm typecheck` fail. Pinned in Task 4, Step 7.
3. **ESLint that skips `.ts`.** Flat config lints `.ts` only when a config object names it. Expected: an `any` in
   `src/**/*.ts` fails `pnpm lint`. Pinned in Task 2, Step 4.
4. **The converted module missing from a shipped bundle.** `FreeGrid.helper.isNumeric` and the other number helpers
   are public (`src/index.js` copies them onto `FreeGrid.helper`). Expected: the plain UMD, full UMD and minified
   builds expose them with unchanged results. Pinned in Task 4, Step 1 (dist test).
5. **Silent behavior drift in the rewrite.** `isNumeric` and `valueAccordingPercent` have no unit tests today, and
   `isNumeric` has quirks (`new Number(NaN)` is numeric, `'.5'` is not, `'+ 3'` is). Expected: identical results.
   Pinned in Task 3 before any conversion.

---

## Task 0: Branch

**Prerequisite:** PR #15 (which adds the spec) is merged into `main`, so the spec this plan links to exists on
`main`. PR #14 (class names) is independent and does not need to be merged first.

- [ ] **Step 1: Create the branch from the latest `main`**

```bash
git fetch origin
git switch -c build/typescript-setup origin/main
test -f docs/specs/2026-10-12-typescript-and-clean-code-design.md && echo spec-present
```
Expected: `spec-present`. If it is missing, PR #15 is not merged yet: stop and ask.

- [ ] **Step 2: Commit this plan**

```bash
git add docs/plans/2026-10-12-ts-phase-1-setup.md
git commit -m "docs: TypeScript phase 1 (setup) plan"
```

---

## Task 1: `tsconfig`, `pnpm typecheck`, Vitest globs, shadow guard

**Files:**
- Create: `packages/freegrid/tsconfig.json`
- Create: `packages/freegrid/test/setup/source-files.unit.js`
- Modify: `packages/freegrid/package.json` (scripts)
- Modify: `package.json` (root scripts)
- Modify: `packages/freegrid/vitest.config.js` (include globs)
- Modify: `.github/workflows/ci.yml` (checks job)

**Interfaces:**
- Produces: `pnpm typecheck` (root) → `pnpm --filter freegrid typecheck` → `tsc -p tsconfig.json`. Later tasks and
  CI call it by that name.

- [ ] **Step 1: Write the shadow-guard test**

`packages/freegrid/test/setup/source-files.unit.js`:

```js
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Vite resolves extensionless imports by trying `.js` before `.ts`, so a `.js` left next to its converted
// `.ts` would silently replace the TypeScript module everywhere.
describe('source files', () => {
  it('never keep a .js module next to a .ts module of the same name', () => {
    const src = fileURLToPath(new URL('../../src', import.meta.url));
    const files = readdirSync(src, { recursive: true }).map(String);
    const tsModules = new Set(files.filter(f => f.endsWith('.ts') && !f.endsWith('.d.ts')).map(f => f.slice(0, -3)));
    const shadowing = files.filter(f => f.endsWith('.js') && tsModules.has(f.slice(0, -3)));

    expect(shadowing).toEqual([]);
  });
});
```

- [ ] **Step 2: Check that the test is collected and can fail**

```bash
cd packages/freegrid
touch src/helpers/number.ts
pnpm exec vitest run test/setup/source-files.unit.js
```
Expected: FAIL. The diff shows `helpers/number.js` (or `helpers\number.js`) in the received array.

```bash
rm src/helpers/number.ts
pnpm exec vitest run test/setup/source-files.unit.js
```
Expected: PASS, 1 test.

- [ ] **Step 3: Add `tsconfig.json`**

`packages/freegrid/tsconfig.json`:

```jsonc
// Type checking only (`pnpm typecheck`). Vite compiles both .js and .ts for the build and the tests.
{
  "compilerOptions": {
    // Same as the build target in build/build.js; browser floor Chrome 80, Firefox 74, Safari 14.
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    // Converted .ts modules and unconverted .js modules import each other during the rewrite.
    "allowJs": true,
    "checkJs": false,
    "noEmit": true,
    // esbuild compiles one file at a time: type-only imports must say `import type`.
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    // Standard class-field semantics, the same as the existing JS classes get from Vite.
    "useDefineForClassFields": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "types": []
  },
  "include": ["src"],
  "exclude": ["src/**/test", "src/**/*.unit.js", "src/**/*.e2e.js", "src/3rdparty/walkontable/dist"]
}
```

- [ ] **Step 4: Add the scripts**

In `packages/freegrid/package.json` `scripts`, add after `"build"`:

```json
    "typecheck": "tsc -p tsconfig.json",
```

and prefix the `test` script with `pnpm typecheck && `:

```json
    "test": "pnpm typecheck && pnpm test:unit && pnpm test:types && pnpm build && pnpm test:dist && pnpm test:e2e && pnpm test:e2e:min && pnpm test:walkontable",
```

In the root `package.json` `scripts`, add after `"lint"`:

```json
    "typecheck": "pnpm --filter freegrid typecheck",
```

- [ ] **Step 5: Run the type check against the all-JS tree**

```bash
cd /home/mindaugas/Projects/excel
pnpm typecheck; echo "exit=$?"
pnpm --filter freegrid exec tsc -p tsconfig.json --listFilesOnly | grep -c '/packages/freegrid/src/'
```
Expected: no diagnostics, `exit=0`. The count is `227` (every source `.js` outside `test/`, `dist/`, `*.unit.js`
and `*.e2e.js`; checked while writing this plan). A much smaller number means `include`/`exclude` is wrong.

- [ ] **Step 6: Let Vitest collect `.ts` unit tests too**

In `packages/freegrid/vitest.config.js`, replace the `include` array:

```js
    include: [
      'test/unit/**/*.spec.{js,ts}',
      'test/unit/**/*.unit.{js,ts}',
      'src/plugins/**/*.unit.{js,ts}',
      'test/setup/*.unit.{js,ts}',
    ],
```

Run: `pnpm --filter freegrid test:unit`
Expected: `No regressions.` at the end, and one more passing test than before (the shadow guard).

- [ ] **Step 7: Type check in CI**

In `.github/workflows/ci.yml`, job `checks`, add after `- run: pnpm lint`:

```yaml
      - run: pnpm typecheck
```

- [ ] **Step 8: Commit**

```bash
git add packages/freegrid/tsconfig.json packages/freegrid/test/setup/source-files.unit.js \
  packages/freegrid/package.json package.json packages/freegrid/vitest.config.js .github/workflows/ci.yml
git commit -m "build: strict tsconfig with allowJs, pnpm typecheck in CI"
```

---

## Task 2: ESLint for TypeScript

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml` (root devDependencies)
- Modify: `eslint.config.js`

**Interfaces:**
- Produces: `pnpm lint` lints `packages/freegrid/src/**/*.ts` with `typescript-eslint`'s recommended rules.

- [ ] **Step 1: Install**

```bash
cd /home/mindaugas/Projects/excel
pnpm add -Dw typescript-eslint@^8.71.1 typescript@^5.9.3
```
Expected: no peer-dependency warnings for `typescript-eslint` (it supports ESLint 9 and TypeScript `<6.1`).
`typescript` is added at the root because the ESLint parser runs from the root.

- [ ] **Step 2: Configure**

In `eslint.config.js`, add the import after `import globals from 'globals';`:

```js
import tseslint from 'typescript-eslint';
```

and add these entries at the **end** of the exported array (after the `tools/baseline/run-puppeteer-json.js`
entry), so they override the JS-wide `no-unused-vars` setting for `.ts`:

```js
  // TypeScript (spec docs/specs/2026-10-12-typescript-and-clean-code-design.md). `no-explicit-any` is an error:
  // an unavoidable `any` needs `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- <reason>`.
  ...tseslint.configs.recommended.map(config => ({ ...config, files: ['packages/freegrid/src/**/*.ts'] })),
  {
    files: ['packages/freegrid/src/**/*.ts'],
    rules: {
      // Same option as for JS: unused catch bindings are allowed.
      '@typescript-eslint/no-unused-vars': ['error', { caughtErrors: 'none' }],
    },
  },
```

- [ ] **Step 3: Lint still passes on the existing tree**

Run: `pnpm lint`
Expected: same output as on `main` (exit 0; the existing `no-dupe-else-if` / `no-constant-binary-expression`
warnings may remain).

- [ ] **Step 4: Check that `.ts` files are actually linted**

```bash
printf 'export const probe: any = 1;\n' > packages/freegrid/src/helpers/lintProbe.ts
pnpm lint; echo "exit=$?"
rm packages/freegrid/src/helpers/lintProbe.ts
```
Expected: `error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any` for
`lintProbe.ts`, and `exit=1`.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml eslint.config.js
git commit -m "build: lint TypeScript sources with typescript-eslint"
```

---

## Task 3: Pin the number helpers' behavior

`rangeEach` and `rangeEachReverse` are covered by `test/unit/helpers/Number.spec.js`; `isNumeric` and
`valueAccordingPercent` are not. These tests go in before the conversion and pass against the current JS.

**Files:**
- Modify: `packages/freegrid/test/unit/helpers/Number.spec.js`

- [ ] **Step 1: Add the tests**

Extend the import at the top of `Number.spec.js`:

```js
import {
  isNumeric,
  rangeEach,
  rangeEachReverse,
  valueAccordingPercent,
} from 'handsontable/helpers/number';
```

Add before the final `});` of `describe('Number helper', …)`:

```js
  describe('isNumeric', () => {
    it('accepts finite numbers only', () => {
      expect(isNumeric(0)).toBe(true);
      expect(isNumeric(-1.5)).toBe(true);
      expect(isNumeric(1e3)).toBe(true);
      expect(isNumeric(NaN)).toBe(false);
      expect(isNumeric(Infinity)).toBe(false);
      expect(isNumeric(-Infinity)).toBe(false);
    });

    it('accepts decimal, exponent and hex strings, with surrounding whitespace', () => {
      ['7', '12', ' 12 ', '-1.5', '+3', '+ 3', '1e3', '1E-3', '0x1F', '0XFF'].forEach((value) => {
        expect(isNumeric(value), JSON.stringify(value)).toBe(true);
      });
    });

    it('rejects other strings', () => {
      ['', ' ', 'a', '1.', '.5', '12px', '1,5', '0x', '--1', 'Infinity', 'NaN'].forEach((value) => {
        expect(isNumeric(value), JSON.stringify(value)).toBe(false);
      });
    });

    it('accepts Number objects (even NaN ones) but not dates or other objects', () => {
      expect(isNumeric(new Number(5))).toBe(true); // eslint-disable-line no-new-wrappers
      expect(isNumeric(new Number(NaN))).toBe(true); // eslint-disable-line no-new-wrappers
      expect(isNumeric(new Date())).toBe(false);
      expect(isNumeric({})).toBe(false);
      expect(isNumeric([])).toBe(false);
      expect(isNumeric([1])).toBe(false);
      expect(isNumeric(null)).toBe(false);
    });

    it('rejects other types', () => {
      expect(isNumeric(undefined)).toBe(false);
      expect(isNumeric(true)).toBe(false);
      expect(isNumeric(10n)).toBe(false);
      expect(isNumeric(() => 1)).toBe(false);
    });
  });

  describe('valueAccordingPercent', () => {
    it('takes a percent given as a number or a "N%" string', () => {
      expect(valueAccordingPercent(200, 50)).toBe(100);
      expect(valueAccordingPercent(200, '50%')).toBe(100);
      expect(valueAccordingPercent(200, '50')).toBe(100);
    });

    it('truncates the percent and the result to integers', () => {
      expect(valueAccordingPercent(10, '33%')).toBe(3);
      expect(valueAccordingPercent(10, '33.9%')).toBe(3);
      expect(valueAccordingPercent(3, '50%')).toBe(1);
      expect(valueAccordingPercent(-10, '50%')).toBe(-5);
      expect(valueAccordingPercent(-3, '50%')).toBe(-1);
    });
  });
```

- [ ] **Step 2: Run against the current JS**

Run: `pnpm --filter freegrid exec vitest run test/unit/helpers/Number.spec.js`
Expected: PASS. These tests describe today's behavior. If one fails, the expectation is wrong, not the code: fix
the expectation to the observed value and note it in the commit message.

(All expected values were checked against the current `number.js` while writing this plan. The Jasmine shim has
no `withContext`, so the string cases use Vitest's `expect(value, message)` form.)

- [ ] **Step 3: Commit**

```bash
git add packages/freegrid/test/unit/helpers/Number.spec.js
git commit -m "test: pin isNumeric and valueAccordingPercent behavior"
```

---

## Task 4: Convert `src/helpers/number.js` to TypeScript

**Files:**
- Rename: `packages/freegrid/src/helpers/number.js` → `packages/freegrid/src/helpers/number.ts`
- Modify: `packages/freegrid/test/build/dist.test.js`

**Interfaces:**
- Produces (unchanged names, now typed):
  - `export type RangeIteratee = (index: number) => unknown;` (returning `false` stops the iteration)
  - `isNumeric(value: unknown): boolean`
  - `rangeEach(rangeTo: number, iteratee: RangeIteratee): void` and
    `rangeEach(rangeFrom: number, rangeTo: number, iteratee: RangeIteratee): void`
  - `rangeEachReverse(rangeFrom: number, iteratee: RangeIteratee): void` and
    `rangeEachReverse(rangeFrom: number, rangeTo: number, iteratee: RangeIteratee): void`
  - `valueAccordingPercent(value: number, percent: string | number): number`
- Consumers: 29 JS modules in `src` (extensionless imports) and `FreeGrid.helper.*` via `src/index.js`. None change.

- [ ] **Step 1: Dist test for the public helpers**

In `packages/freegrid/test/build/dist.test.js`, add inside `describe('dist outputs', …)`, after the
`'full UMD bundles dependencies…'` test:

```js
  it('UMD builds expose the number helpers on FreeGrid.helper', () => {
    ['freegrid.full.js', 'freegrid.full.min.js'].forEach((file) => {
      const { helper } = windowWith(read(file)).FreeGrid;
      const visited = [];

      expect(helper.isNumeric('0x1F'), file).toBe(true);
      expect(helper.isNumeric('.5'), file).toBe(false);
      expect(helper.valueAccordingPercent(200, '50%'), file).toBe(100);
      helper.rangeEach(1, 3, index => visited.push(index));
      helper.rangeEachReverse(2, index => visited.push(index));
      expect(visited, file).toEqual([1, 2, 3, 2, 1, 0]);
    });
  });
```

Run: `pnpm --filter freegrid build && pnpm --filter freegrid test:dist`
Expected: PASS (it pins today's built behavior; the conversion must keep it).

```bash
git add packages/freegrid/test/build/dist.test.js
git commit -m "test: number helpers in the UMD builds"
```

- [ ] **Step 2: Move commit (rename only)**

```bash
cd packages/freegrid
git mv src/helpers/number.js src/helpers/number.ts
git commit -m "refactor: move helpers/number.js to number.ts"
```
No content change, so git records a rename and `git log --follow src/helpers/number.ts` keeps the upstream
history. This one commit may fail `pnpm typecheck`/`pnpm lint` (untyped code under `strict`); the build and tests
still run because Vite does not type-check. The PR head must pass everything.

- [ ] **Step 3: See the type errors to fix**

Run: `pnpm typecheck`
Expected: FAIL, `TS7006: Parameter 'n' implicitly has an 'any' type.` and the same for the other parameters in
`src/helpers/number.ts`.

- [ ] **Step 4: Write the typed module**

Replace the whole content of `packages/freegrid/src/helpers/number.ts`:

```ts
/** Called with each index; returning `false` stops the iteration. */
export type RangeIteratee = (index: number) => unknown;

/**
 * Checks if a value is numeric: a finite number, a `Number` object, or a string in decimal, exponent or hex
 * notation (surrounding whitespace allowed). Dates are not numeric.
 */
export function isNumeric(value: unknown): boolean {
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }
  if (typeof value === 'string') {
    if (value.length === 0) {
      return false;
    }
    if (value.length === 1) {
      return /\d/.test(value);
    }

    return /^\s*[+-]?\s*(?:(?:\d+(?:\.\d+)?(?:e[+-]?\d+)?)|(?:0x[a-f\d]+))\s*$/i.test(value);
  }
  if (typeof value === 'object' && value !== null) {
    return typeof value.valueOf() === 'number' && !(value instanceof Date);
  }

  return false;
}

/**
 * Calls `iteratee` for each index from `rangeFrom` to `rangeTo`, both included. With two arguments, iterates
 * from 0 to the first argument.
 */
export function rangeEach(rangeTo: number, iteratee: RangeIteratee): void;
export function rangeEach(rangeFrom: number, rangeTo: number, iteratee: RangeIteratee): void;
export function rangeEach(rangeFrom: number, rangeTo: number | RangeIteratee, iteratee?: RangeIteratee): void {
  let from = rangeFrom;
  let to: number;
  let callback: RangeIteratee;

  if (typeof rangeTo === 'function') {
    from = 0;
    to = rangeFrom;
    callback = rangeTo;
  } else {
    to = rangeTo;
    // The overloads require an iteratee whenever `rangeTo` is a number.
    callback = iteratee as RangeIteratee;
  }
  for (let index = from; index <= to; index++) {
    if (callback(index) === false) {
      break;
    }
  }
}

/**
 * Calls `iteratee` for each index from `rangeFrom` down to `rangeTo`, both included. With two arguments,
 * iterates down to 0.
 */
export function rangeEachReverse(rangeFrom: number, iteratee: RangeIteratee): void;
export function rangeEachReverse(rangeFrom: number, rangeTo: number, iteratee: RangeIteratee): void;
export function rangeEachReverse(rangeFrom: number, rangeTo: number | RangeIteratee, iteratee?: RangeIteratee): void {
  let to: number;
  let callback: RangeIteratee;

  if (typeof rangeTo === 'function') {
    to = 0;
    callback = rangeTo;
  } else {
    to = rangeTo;
    // The overloads require an iteratee whenever `rangeTo` is a number.
    callback = iteratee as RangeIteratee;
  }
  for (let index = rangeFrom; index >= to; index--) {
    if (callback(index) === false) {
      break;
    }
  }
}

/**
 * Returns `percent` of `value`, truncated to an integer. `percent` is a number or a string such as `'33%'`;
 * its fraction is dropped first.
 */
export function valueAccordingPercent(value: number, percent: string | number): number {
  const wholePercent = parseInt(percent.toString().replace('%', ''), 10);

  return parseInt(String(value * wholePercent / 100), 10);
}
```

Notes for the reviewer, each one checked against the original:
- `Number.isFinite(n)` equals the original `!isNaN(n) && isFinite(n)` for numbers.
- The object branch keeps `valueOf()` (so `new Number(NaN)` stays numeric) and the `Date` exclusion.
- The `for` loops visit the same indexes as the original `while (++index <= rangeTo)` /
  `while (--index >= rangeTo)` loops, including fractional bounds.
- `parseInt(String(x), 10)` is what the original `parseInt(x, 10)` did implicitly (it converts a number to a
  string first), so results such as `1e21` or `1e-7` keep their original truncation.

- [ ] **Step 5: Type check, lint and unit tests**

```bash
cd /home/mindaugas/Projects/excel
pnpm typecheck && pnpm lint && pnpm --filter freegrid test:unit
```
Expected: no type errors, lint exit 0, unit run ends with `No regressions.`; all `Number helper` tests pass.

- [ ] **Step 6: Commit the typed module**

```bash
git add packages/freegrid/src/helpers/number.ts
git commit -m "refactor: type helpers/number in TypeScript"
```

- [ ] **Step 7: Check that `tsc` really checks `number.ts`**

```bash
cd packages/freegrid
pnpm exec tsc -p tsconfig.json --listFilesOnly | grep 'src/helpers/number.ts'
printf '\nexport const typeProbe: number = "not a number";\n' >> src/helpers/number.ts
pnpm typecheck; echo "exit=$?"
git checkout src/helpers/number.ts
```
Expected: the first command prints the path of `number.ts`. Then
`error TS2322: Type 'string' is not assignable to type 'number'.` and `exit=2`.

- [ ] **Step 8: History survives**

Run: `git log --follow --oneline packages/freegrid/src/helpers/number.ts | tail -3`
Expected: commits from before this branch (the fork's import commit), not only this branch's commits.

- [ ] **Step 9: Build and dist test**

Run: `pnpm --filter freegrid build && pnpm --filter freegrid test:dist`
Expected: `FreeGrid build complete.` and all dist tests pass, including `UMD builds expose the number helpers on
FreeGrid.helper`.

---

## Task 5: Document the pattern

**Files:**
- Modify: `CONTRIBUTING.md` (new section after `## Commits`)
- Modify: `CHANGELOG.md` (`## Unreleased` list)

- [ ] **Step 1: CONTRIBUTING section**

Add after the `## Commits` section of `CONTRIBUTING.md`:

```markdown
## TypeScript

FreeGrid is moving to TypeScript one module group at a time (see
`docs/specs/2026-10-12-typescript-and-clean-code-design.md`). JavaScript and TypeScript modules import each
other freely, and imports have no file extension, so converting a module needs no changes in its importers.
Unit and E2E specs stay JavaScript for now.

To convert a module (`src/helpers/number.ts` is the reference):

1. If some behavior is not covered by a unit test, add the test first, in its own commit, against the JS code.
2. Move commit: `git mv foo.js foo.ts` and nothing else, so git keeps the file's history. This commit may fail
   `pnpm typecheck`; the build and tests still run.
3. Typing commit: add types and apply the clean-code rules from the spec. Behavior stays the same.
4. `pnpm lint`, `pnpm typecheck` and `pnpm test` pass.

Rules:

- `strict` mode. No `any`; if one is unavoidable, use
  `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- <reason>`.
- Type-only imports use `import type` (`pnpm typecheck` enforces it).
- No `@ts-ignore` or `@ts-nocheck`.
- Never keep `foo.js` next to `foo.ts`: Vite would load the `.js`. A unit test checks this.
- Conversion PRs are merged with **Rebase and merge**, so the move commit stays separate from the typing commit.
```

- [ ] **Step 2: CHANGELOG line**

Add at the end of the `## Unreleased (Stage 0)` list in `CHANGELOG.md`:

```markdown
- Source code is moving to TypeScript (strict). The first converted module is `helpers/number`; there is no change
  in behavior.
```

- [ ] **Step 3: Commit**

```bash
git add CONTRIBUTING.md CHANGELOG.md
git commit -m "docs: how to convert a module to TypeScript"
```

---

## Task 6: Full verification and PR

- [ ] **Step 1: Checks job, locally**

```bash
cd /home/mindaugas/Projects/excel
pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm --filter freegrid test:unit \
  && pnpm --filter freegrid test:types && pnpm --filter freegrid build && pnpm --filter freegrid test:dist
```
Expected: every command succeeds; `test:unit` ends with `No regressions.`

- [ ] **Step 2: Browser suites in Docker**

Run from the repo root, one at a time (each builds the test bundles itself):

```bash
tools/in-playwright-docker.sh pnpm --dir packages/freegrid build
tools/in-playwright-docker.sh pnpm --dir packages/freegrid test:e2e
tools/in-playwright-docker.sh pnpm --dir packages/freegrid test:e2e:min
tools/in-playwright-docker.sh pnpm --dir packages/freegrid test:walkontable
tools/in-playwright-docker.sh pnpm --dir packages/freegrid test:e2e:firefox
tools/in-playwright-docker.sh pnpm --dir packages/freegrid test:e2e:webkit
```
Expected: the three Chromium runs end with `No regressions.`; Firefox and WebKit end with
`No unexpected failures.` If a WebKit spec fails that is already known to be flaky in CI, rerun that suite once
before investigating; do not add entries to `known-failures.json` in this PR without a cause.

- [ ] **Step 3: Docs site still builds**

```bash
pnpm build && pnpm docs:build
```
Expected: both succeed (the docs import the built package).

- [ ] **Step 4: Push and open the PR**

```bash
git push -u origin build/typescript-setup
gh pr create --base main --title "build: TypeScript setup (phase 1), helpers/number converted" --body "$(cat <<'EOF'
Phase 1 of docs/specs/2026-10-12-typescript-and-clean-code-design.md.

- `packages/freegrid/tsconfig.json`: strict, `allowJs`, type checking only (`noEmit`); `lib` matches the ES2020 build target.
- `pnpm typecheck` (root and package), run in CI's checks job and at the start of `pnpm test`.
- ESLint: typescript-eslint recommended rules for `packages/freegrid/src/**/*.ts`.
- Vitest collects `.ts` unit tests as well as `.js`.
- A unit test fails if a `.js` module is left next to its `.ts` (Vite would load the `.js`).
- `src/helpers/number.js` → `number.ts`, the pattern for later phases. Behavior pinned first with new unit tests (`isNumeric`, `valueAccordingPercent`) and a dist test for `FreeGrid.helper`.
- CONTRIBUTING: how to convert a module.

Verified locally: lint, typecheck, unit, types, dist, docs build; E2E Chromium (dev, min), Walkontable, Firefox and WebKit in `tools/in-playwright-docker.sh`.

Please merge with **Rebase and merge**, so the `git mv` commit stays separate and `git log --follow` keeps the history of `number.ts`.
EOF
)"
```

- [ ] **Step 5: CI green**

Run: `gh pr checks --watch`
Expected: `checks`, `docs` and all five `browser` jobs pass.
