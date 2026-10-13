# Replace moment with FreeGrid's own date module — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** FreeGrid parses, formats and compares dates with its own small module (`src/helpers/dateFormat.ts`)
instead of moment, with the same `dateFormat` / `timeFormat` token syntax and the same validation, editing and
sorting behavior. No date library at runtime.

**Why not Day.js** (decided 2026-10-13, after measuring): Day.js has moment's tokens but not moment's parsing. Moment
is lenient (`"1:00 pm"` with `h:mm:ss a` → 13:00, `"1/2/2015"` with `DD/MM/YYYY` → 1 February, `"30:10:25"` →
invalid); Day.js rejects most of these, accepts overflowing dates (`02/30` → 2 March) and reads `"10:00:00 pm"` with
`A` as 10 AM. The validators' `correctFormat` and date sorting depend on moment's behavior, so we would have written
our own lenient parser anyway. One module of our own: 0 dependencies, no extra `<script>` tags for UMD users, and
FreeGrid's date picker (next PR) uses the same module.

## Global Constraints

- Same behavior: every existing unit and E2E spec stays green in Chromium (baseline), Firefox and WebKit (known
  failures). Specs that build expected values with moment keep it (moment becomes a devDependency).
- The parser follows moment's algorithm (token regexes searched in order, lenient vs strict regexes, overflow checks,
  strict = no leftover characters and no unused tokens, 12-hour `h` > 12 invalid in strict mode, `a`/`A` case
  insensitive, missing date parts default to today, list of formats picks the best-scoring one).
- Tokens: `YYYY YY Y M MM MMM MMMM D DD Do d dd ddd dddd H HH h hh k kk m mm s ss S SS SSS a A Z ZZ X x Q`, `[literal]`
  and the English long formats `LT LTS L LL LLL LLLL l ll lll llll`. English names. Weekday names are matched when
  parsing but not checked against the date.
- Public changes, listed in the CHANGELOG and the docs: no moment needed on the page, `freegrid.full.js` no longer
  exposes `window.moment`; the ESM build no longer imports `moment`.
- Pikaday stays until FreeGrid's own date picker (next PR); its internal `require('moment')` is left unresolved, so
  moment is not bundled, and without moment it falls back to native dates (FreeGrid writes the picked date itself).
- No `Co-Authored-By`. Check the build's exit code. One PR, squash merge.

## Review Focus

1. Lenient parsing in date sorting and in the validators' "is it a date at all" checks.
2. Strict parsing with several formats (`timeValidator`'s list) and time-only formats.
3. Pikaday without moment: the selected day, the cell's text after picking, `correctFormat` re-formatting.
4. Bundles: no moment left in `freegrid.js`, `freegrid.full.js` or the ESM output.
5. Time zones: `Z`/`ZZ` offsets and local dates near DST changes.

## Task 1: `src/helpers/dateFormat.ts`

- [ ] Unit spec `test/unit/helpers/dateFormat.unit.ts`: compares `parseDate` (valid or not, and the time value) and
  `formatDate` with moment over a grid of inputs × formats, strict and lenient, plus format lists; then targeted cases
  (meridiem, overflow, 2-digit years, timestamps, offsets, literals, long formats). Watch it fail.
- [ ] Implement `parseDate(input, format | formats, strict = false): Date | null` and
  `formatDate(date, format): string`. Make the spec pass.

## Task 2: Use it; drop moment

- [ ] Replace moment in `editors/dateEditor.js`, `validators/dateValidator.js`, `validators/timeValidator.js`,
  `plugins/columnSorting/sortFunction/date.js`.
- [ ] Build: `deps` = `['numbro', 'pikaday']`, no `moment` global, `commonjsOptions.ignore: ['moment']`;
  `full-entry.js` stops exposing `window.moment`. Dist tests first (RED): no moment in any bundle, full has no
  `window.moment`, ESM does not import moment.
- [ ] Unit + dist + E2E date specs in the three browsers; commit.

## Task 3: Docs, CHANGELOG, full verification, PR

- [ ] Getting started (script tags), cell types (`dateFormat`/`timeFormat` tokens table), migration guide, CHANGELOG.
- [ ] Lint, typecheck, unit, types, build, dist, docs build + smoke, all six browser runs; review; PR.
