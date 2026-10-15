# Paste and property-path measurements

`paste.mjs` measures FreeSheet's production `packages/sheet/dist/freesheet.full.min.js` and CSS in Chromium.
It uses Node built-ins, the existing test server and the repository's Playwright installation; no extra dependency
or benchmark framework is needed. Run from the repository root after `pnpm install`:

```sh
tools/in-playwright-docker.sh pnpm build
mkdir -p packages/sheet/test-results/paste-before-dist
cp packages/sheet/dist/freesheet.full.min.js packages/sheet/dist/freesheet.full.min.js.map \
  packages/sheet/test-results/paste-before-dist/
# Build the candidate, leaving the runner and all options identical, then:
tools/in-playwright-docker.sh node tools/performance/paste.mjs \
  --baseline-bundle packages/sheet/test-results/paste-before-dist/freesheet.full.min.js \
  --revision after --output tools/performance/results/paste-after.json
```

The default cases use 100 or 2,000 source rows and 20 columns. The 100-row case pastes 10 × 10 cells;
the 2,000-row case pastes all 40,000 cells. Shapes are numeric-column arrays, flat objects (`field0`) and
nested objects (`group.branch.leaf.field0`). Both `populateFromArray` and the clipboard plugin's text paste run.
The clipboard case includes TSV parsing, expansion, selection and the resulting render.

Each case discards three warm-up trials and records 15 measured trials. Every trial creates a fresh page and
grid, waits 600 ms after selection, pastes changed text values once and verifies every resulting cell, the
change count and the change source. Data, column definitions, paste arrays and TSV strings are generated outside
the timed interval. The grid is 1,000 × 600, the browser viewport 1,200 × 1,000 at device scale 1, row height 23,
column width 80, automatic sizing off, column headers off, text columns and default plugins (including undo).
No validators are configured. This is a deliberately controlled paste workload, not an initialization, scrolling
or million-row scalability benchmark.

With `--baseline-bundle`, each trial is a pair of fresh pages, alternating baseline/candidate then
candidate/baseline. This keeps both production builds close in time and balances order. The saved baseline must
be inside the repository so the local server can serve it. CSS comes from the current `dist/`, so this comparison
requires unchanged CSS. Without this option the runner measures only the current build.

`synchronousMs` ends when the paste method returns; `settledMs` ends after its `afterChange` promise resolves.
For these synchronous text cases they usually coincide. The timer includes synchronous rendering triggered by
the operation, but does not measure when pixels are presented. Report medians and variability, inspect controls,
and repeat in reverse build order if small cases drift. Do not run timed cases alongside tests or profiling.

The result JSON records options, browser/Node/CPU versions, bundle and runner SHA-256 hashes, and raw samples.
`complete: true` is written only after all cases pass verification; a partial result is not a completed run.
Outputs and CPU profiles under `tools/performance/results/` are ignored and must not be committed. Keep raw
evidence with the exact before/after bundles and source maps outside Git. Build timestamps can change the bundle
hash even when the source is unchanged.

## Instrumentation and wide-column controls

Instrumented runs are separate from timings; they record one trial per case and omit timing fields:

```sh
# Counts existing hook dispatches without registering modifyRow/modifyCol hooks.
tools/in-playwright-docker.sh node tools/performance/paste.mjs --counts \
  --output tools/performance/results/counts.json
# CDP CPU profiles; retain the matching dist bundle and source map for symbolication.
tools/in-playwright-docker.sh node tools/performance/paste.mjs --profile \
  --rows 2000 --shapes nested --output tools/performance/results/profile.json
# Wide-column control (25,600 cells).
tools/in-playwright-docker.sh node tools/performance/paste.mjs \
  --rows 50 --columns 512 --shapes object,nested --trials 10 --warmup 2 \
  --output tools/performance/results/wide.json
```

Other options: `--methods populate,clipboard`, `--rows 100,2000`, `--columns 20`,
`--shapes array,object,nested`, `--trials 15`, `--warmup 3`. A row count other than 100 pastes the full rectangle.
`--counts` and `--profile` cannot be combined. A trial has a 120-second watchdog.

## Scope and compatibility

Profiles identify repeated column-path splitting in data-map reads/writes, source reads and the unsafe-property
guard. `DataMap.set` now splits a string property once, checks the resulting segments for unsafe keys and reuses
the same array for nested traversal. The array lives for one write. Every property read, unsafe-key check and
hook dispatch still runs. Literal dotted keys retain their original precedence over nested traversal.

Compatibility specs cover literal dotted keys, empty segments, missing/null values, inherited properties,
numeric keys, repeated and reentrant getters, function-valued column accessors, changing source mappings,
long/many distinct paths, unsafe keys, async validation, undo/redo, read-only clipboard repetition and settings
replacement. The hook-count specs were verified against the unchanged production build first.

Nested writes avoid one temporary split array per call; retained data and metadata are unchanged. Whole-grid
row/column scans and hook dispatch costs remain outside this change. Gains on nested object data must not be
generalized to array data or rendering performance. Local reuse also works with many distinct paths without
introducing cache capacity, eviction work or invalidation rules.

## Local measurements (2026-10-15)

Baseline: `0b72f018`. Candidate: local path reuse in `DataMap.set`. Same runner, production minified builds,
Docker image `freesheet-playwright:1.64.0`, Chromium 156.0.8078.4, Node 24.21.0, Intel Core i7-14700KF.
The default run completed 15 AB/BA pairs per case after three warm-up pairs (360 verified measured pastes).
Times below are synchronous medians in ms. Paired saving is the median of `(before - after)` within a trial;
it can differ from subtracting the two medians. Positive means faster. P10–P90 uses nearest-rank quantiles.

| Pasted cells | Shape | Method | Before | After | Median paired saving |
| ---: | --- | --- | ---: | ---: | ---: |
| 100 | Array | Populate | 4.6 | 4.6 | 0.1 |
| 100 | Array | Clipboard | 6.4 | 6.3 | 0.0 |
| 100 | Flat object | Populate | 4.7 | 4.7 | 0.1 |
| 100 | Flat object | Clipboard | 7.0 | 6.9 | 0.1 |
| 100 | Nested object | Populate | 5.1 | 5.1 | 0.0 |
| 100 | Nested object | Clipboard | 6.9 | 7.0 | -0.1 |
| 40,000 | Array | Populate | 67.1 | 66.8 | -0.5 |
| 40,000 | Array | Clipboard | 76.0 | 74.4 | -0.5 |
| 40,000 | Flat object | Populate | 70.5 | 71.8 | -0.1 |
| 40,000 | Flat object | Clipboard | 73.4 | 72.7 | 0.9 |
| 40,000 | Nested object | Populate | 74.5 | 72.6 | 1.7 |
| 40,000 | Nested object | Clipboard | 79.6 | 79.2 | 0.4 |

For 40,000 nested cells, populate P10–P90 was 70.3–78.2 before and 69.9–75.9 after; 11/15 paired trials were
faster. Clipboard P10–P90 was 78.8–82.5 before and 77.5–82.2 after; 10/15 were faster. These are modest gains,
with overlapping distributions, and the clipboard result alone is weak evidence. Small cases and array/flat
controls show no consistent speed-up; individual control medians vary by up to 1.6 ms. No percentage, GC or
retained-heap improvement is inferred from these timings.

The 50 × 512 control pastes 25,600 cells. Ten AB/BA pairs after two warm-up pairs gave:

| Shape | Method | Before median (ms) | After median (ms) | Median paired saving (ms) |
| --- | --- | ---: | ---: | ---: |
| Flat object | Populate | 62.70 | 61.25 | 0.40 |
| Flat object | Clipboard | 65.90 | 64.60 | 1.00 |
| Nested object | Populate | 79.30 | 78.20 | 1.65 |
| Nested object | Clipboard | 84.85 | 86.05 | 1.00 |

The last row illustrates why subtracting medians is insufficient: its after median is higher while its paired
median difference favors the candidate. Its P10–P90 ranges overlap (81.7–88.4 vs 82.5–88.4 ms), so it does not
establish a clipboard improvement or regression. For an even sample count, medians average the middle two values.

Separate `--counts` runs matched the complete hook-dispatch dictionaries for all 12 small/large cases. The
`beforeChange` preparation-count specs also pin calls to function-valued `columns`. CDP profiles are diagnostic
samples; their timings and GC samples are excluded from the before/after table.

Because the 40,000-cell clipboard result was small, a larger replication used 10,000 source rows × 20 nested
columns (200,000 pasted cells), again 15 pairs and three warm-up pairs:

```sh
tools/in-playwright-docker.sh node tools/performance/paste.mjs \
  --baseline-bundle packages/sheet/test-results/paste-before-dist/freesheet.full.min.js \
  --rows 10000 --shapes nested --output tools/performance/results/large.json
```

| Method | Before median (ms) | After median (ms) | Median paired saving (ms) | Faster pairs |
| --- | ---: | ---: | ---: | ---: |
| Populate | 289.1 | 286.9 | 6.2 | 11/15 |
| Clipboard | 319.2 | 305.7 | 14.7 | 13/15 |

Populate P10–P90 was 283.0–298.6 before and 278.6–292.4 after; clipboard was 310.2–330.4 before and 297.5–319.2
after. This provides stronger evidence for the large clipboard workload, while leaving its cost in the hundreds
of milliseconds. It does not establish gains with arbitrary validators, plugins or data shapes.
