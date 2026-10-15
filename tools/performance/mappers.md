# Mapper performance measurements

`mappers.mjs` uses Node built-ins, the existing Playwright installation and the production minified
bundle in `packages/sheet/dist`. It runs independently of the other performance entry points and adds
no dependencies. Use Node 24 with the repository dependencies installed.

From the repository root, using the existing Docker helper:

```sh
tools/in-playwright-docker.sh pnpm build
tools/in-playwright-docker.sh node tools/performance/mappers.mjs \
  --rows=100,100000 --amounts=1,32,1000,10000 --trials=15 --warmup=3 \
  --revision="$(git rev-parse HEAD)" --output=tools/performance/results/before.json
tools/in-playwright-docker.sh node tools/performance/mappers.mjs --grid-only \
  --rows=100,100000 --amounts=1,32,1000,10000 --trials=15 --warmup=3 \
  --revision="$(git rev-parse HEAD)" --output=tools/performance/results/before-grid.json
tools/in-playwright-docker.sh node tools/performance/mappers.mjs --memory \
  --rows=100,100000 --revision="$(git rev-parse HEAD)" \
  --output=tools/performance/results/before-memory.json
```

Rebuild the candidate and repeat with `after.json`, `after-grid.json` and `after-memory.json`. Keep the same browser,
hardware, viewport, data, trial counts and runner for both builds. Do not run other benchmarks or tests
at the same time. Results include raw samples, Node/browser versions, CPU, options and the bundle hash.
The revision is a label supplied by the caller; verify it matches the built source. Never commit results.

Defaults are 100 and 100,000 rows, amounts 1 and 1,000, 15 trials and three discarded warmups. Counts
larger than the source are skipped. Each trial uses a fresh browser page and a two-column grid with
manual row moving enabled, fixed dimensions, and automatic sizing disabled. Data and the descending
index map are prepared outside timers. A page watchdog aborts synchronous work after 120 seconds.
Only outputs with `complete: true` represent completed runs; failures exit unsuccessfully.

The four mapper timers call the actual production plugin mapper. Each starts with a fresh copy of the
descending map. Insertions target the middle; listed removals target its leading entries. These isolate
algorithm costs and are not full grid-operation timings. `lookupFirstBatch` measures 10,000 public
`toVisualRow` calls on a fresh map; `lookupWarmBatch` repeats the same queries without a mutation.
Both include hook dispatch and check a checksum. The runner then moves a row and checks translation.
The separate `--grid-only` mode measures a complete synchronous `grid.alter('remove_row', …)` call in
the middle of a fresh grid. It includes the grid's other data work and rendering, with manual moving
enabled. Separating the modes keeps allocations from mapper microbenchmarks out of the grid measurement.
Every operation checks its resulting length and representative values. These timers do not measure
paint or responsiveness; use the general browser runner for frame opportunities and scrolling.

The separate `--memory` diagnostic forces GC through CDP between phases. It records the empty page,
data allocation, initialized grid with a fresh map, reverse lookups, ten further batches and destruction
with all retained grid/data references released. `indexed - initialized` estimates the extra lookup
storage; `data - empty` separates source storage from grid overhead. Compare repeated/destroyed heaps
between builds. These are JS heap measurements, excluding native DOM/browser memory; a nonzero
post-destruction difference alone does not establish a leak. No timing comparisons use these GC runs.

Browser timer resolution can round an individual mapper operation to zero. Do not infer gains from
those small samples. Compare medians and spread across trials, and require a gain in the complete
grid operation before claiming a user benefit. The one-million-row row-removal limit in the existing
source rebuild also applies here; this runner does not change it.

The implementation keeps native splices below 256 inserted/listed entries. Browser measurements
showed full-tail compaction losing to splices at 32 entries. Renumbering switches at 32 removed values
because its nested scans have a different cost. Large maps build their reverse index after 1,024 queries
without a mutation, avoiding rebuilds between individual moves and amortizing setup for repeated lookups.
These are workload-dependent cutoffs, not cross-browser performance guarantees. Every in-place map
mutation in the mapper implementations invalidates the reverse index; replacement arrays use a new
cache key. The weak keys let the index go when its map is released.
Live arrays passed to persistence hooks or supplied by a persistence loader keep using `indexOf`,
since a hook can retain and mutate those arrays at any later time. Local and global listeners follow
the same rule. No array is copied or wrapped, and the hook calls remain in their original order.
