# Contributing to FreeGrid

Thanks for helping keep a free data grid alive.

## Clean-room rule (important)

FreeGrid is based on Handsontable **6.2.2**, the last MIT release. **Do not copy code, tests, docs, or
assets from Handsontable 7.0 or later, or from HyperFormula** — those are not MIT-licensed. Do not read
their source while working on an equivalent FreeGrid feature. Pull requests that appear derived from
them will be closed.

## Tests

- Never delete or weaken a test to make it pass.
- A test that fails for an environmental reason is changed to `xit` with
  `// FG-SKIP: <specific reason> — <issue URL>`.
- `pnpm test` must pass before a PR is merged. It compares results with the upstream baseline in
  `docs/baseline/`.
- A test is removed only together with the public behavior it checks, when that removal is deliberate and
  listed in the CHANGELOG. Add the test's full name and the reason to `docs/baseline/retired.json`, and say so
  in the PR.

## Commits

- Conventional Commits (`feat:`, `fix:`, `build:`, `test:`, `docs:`, `chore:`).
- Keep file moves and content edits in separate commits so `git log --follow` and `git blame` keep working.
- Do not reformat code you are not otherwise changing.

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
- Types do not bind JavaScript callers. Keep the original runtime behavior for unexpected inputs (coercions,
  `null`, strings) unless the change is deliberate and listed in the CHANGELOG.
- Never keep `foo.js` next to `foo.ts`: Vite would load the `.js`. A unit test checks this.
- Conversion PRs are merged with **Rebase and merge**, so the move commit stays separate from the typing commit.

## Design documents

Larger changes start with a design document in `docs/specs/`.
