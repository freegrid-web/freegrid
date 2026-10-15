# Header and index translation measurements

`translations.mjs` uses Node built-ins and the repository's existing Playwright. It loads the production
minified full bundle and CSS from `packages/sheet/dist`, with no source instrumentation or extra dependency.
Use Node 24 and installed repository dependencies. Run from the repository root:

```sh
tools/in-playwright-docker.sh pnpm build
tools/in-playwright-docker.sh node tools/performance/translations.mjs \
  --rows=100 --columns=20,5000 --modes=none,array,object --trials=15 --warmup=3 \
  --revision="$(git rev-parse HEAD)" --output=tools/performance/results/headers-before.json
tools/in-playwright-docker.sh node tools/performance/translations.mjs \
  --rows=100000 --columns=20 --modes=none,array,function,object --trials=15 --warmup=3 \
  --revision="$(git rev-parse HEAD)" --output=tools/performance/results/rows-before.json
tools/in-playwright-docker.sh node tools/performance/translations.mjs --counts \
  --rows=100 --columns=20,200 --modes=none,array,function,object \
  --revision="$(git rev-parse HEAD)" --output=tools/performance/results/counts-before.json
```

Build the candidate and repeat with separate `after` outputs. Use identical runner code, data, hardware,
browser and options, without concurrent tests or benchmarks. The revision is a caller-supplied label;
check it matches the built source. Raw results record the bundle hash, Node/browser versions, CPU,
configuration and every trial. Do not commit generated results. A completed run has `complete: true`;
exceptions or the 120-second page watchdog fail the run. Output directories are created automatically.

Each case has a fresh page, a 1200×1000 viewport and a 1000×600 grid, fixed row/column dimensions, headers
enabled and automatic sizing disabled. Data and the 10×10 paste input (clipped for smaller sources)
are created outside all timers. The modes are numeric array data with no `columns` option (`none`), an
array of column definitions (`array`), object rows with inferred columns (`object`), and a `columns`
function omitting every fifth source column (`function`). Defaults are 100 rows, 20 and 5,000 columns,
the first three modes, 15 trials and three discarded warmups. Row/column/mode lists are comma-separated.
Very large row counts combined with thousands of columns require substantial source-data memory;
choose row and column scaling independently.

Timing mode records constructor duration, one complete synchronous `render()`, one `getColHeader()`
returning all headers, 100 individual header calls, and a paste of up to 100 cells. Paste records both
synchronous API duration and time until `afterChange`; postconditions verify the update settled. These
timings include the grid's synchronous rendering work but do not measure paint or frame presentation.
The individual headers cycle through the first ten columns. Each operation runs once per trial; small
bulk-header samples may round to zero. Compare medians and spread, and avoid claiming gains below timer
resolution. Row-heavy and functional-column cases are controls as well as performance workloads.

`--render-batches` instead measures a batch of 20 consecutive synchronous `render()` calls on each
fresh grid. Divide the recorded duration by 20 for amortized CPU cost, including the first call.
This supplementary control helps distinguish initial JIT/tier effects from repeated rendering cost;
it measures neither scrolling nor frame presentation. Use the same small cases in both builds:

```sh
tools/in-playwright-docker.sh node tools/performance/translations.mjs --render-batches \
  --rows=100 --columns=20 --modes=none,array,object --trials=15 --warmup=3 \
  --output=tools/performance/results/render-batches-before.json
```

`--counts` is a separate diagnostic: it wraps hook dispatch and a functional `columns`
callback, then uses CDP precise coverage for exact method counts. Counts identify both `Core` and
`DataMap` implementations of `colToProp`/`propToCol`, plus `getColHeader`, `countCols` and `countSourceCols`.
Node's built-in `SourceMap` maps production function offsets to original file/line locations. No production
source is changed. Coverage changes optimization and adds overhead, so diagnostic runs discard timings,
perform one trial without warmup, and must never be compared with timing runs. The dispatch wrapper preserves hook registration and checks its total against exact `runHooks`
coverage, avoiding instrumentation that would activate the special path for registered row modifiers.
Hook counters and coverage stop before postcondition reads. Missing function entries mean zero calls during the covered operation.

Translation hooks and `columns` callbacks may depend on invocation order and mutable state. Their results
cannot generally be cached across cells or renders while preserving behavior. The header fast path instead
avoids the unused source-column translation when `columns` is not a function. It checks after `modifyCol`
so that a hook installing a callback during a lookup is still observed. Functional columns retain their
existing scan and title-callback sequence, including when headers are disabled. No persistent cache or
invalidation state is added.
