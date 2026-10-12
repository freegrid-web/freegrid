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

## Commits

- Conventional Commits (`feat:`, `fix:`, `build:`, `test:`, `docs:`, `chore:`).
- Keep file moves and content edits in separate commits so `git log --follow` and `git blame` keep working.
- Do not reformat code you are not otherwise changing.

## Design documents

Larger changes start with a design document in `docs/specs/`.
