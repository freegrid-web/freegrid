# Large-grid investigation

`scalability.mjs` measures the **production minified full build**, using Node built-ins and the repository's
existing Playwright dependency. It adds no packages and does not patch production code or instrument the grid
in the timing run. The optional diagnostic runs are deliberately separate.

From the repository root, after installing dependencies:

```sh
tools/in-playwright-docker.sh pnpm build
tools/in-playwright-docker.sh node tools/performance/scalability.mjs --revision "$(git rev-parse HEAD)"
```

For a shorter run:

```sh
tools/in-playwright-docker.sh node tools/performance/scalability.mjs \
  --cases small,tall100k --trials 5 --warmup 1 --frames 30 \
  --revision "$(git rev-parse HEAD)" --output tools/performance/results/short.json
```

The default cases are:

| Case | Rows | Logical columns | Source representation |
| --- | ---: | ---: | --- |
| `small` | 100 | 20 | Dense numeric arrays |
| `tall10k` | 10,000 | 20 | Dense numeric arrays |
| `tall100k` | 100,000 | 20 | Dense numeric arrays |
| `tall1m` | 1,000,000 | 20 | Dense numeric arrays |
| `wide` | 100 | 5,000 | Dense numeric arrays |
| `mixed` | 10,000 | 200 | Dense numeric arrays |
| `sparse` | 100,000 | 5,000 | Objects containing **20 populated properties per row**, explicit 5,000-column schema |

The sparse case is not a claim that 500 million populated cells fit into memory. It distinguishes the logical
sheet dimensions from the amount of source data. Every case uses explicit numeric column definitions,
1000 × 600 grid dimensions, a 1200 × 1000 browser viewport, 23px row heights, 80px column widths, both headers,
sorting enabled and both automatic sizing plugins disabled. These are controlled conditions, not a proposed
change to default behavior. Frozen panes, custom renderers, wrapped text and automatic sizing require additional
scenarios before changing their implementations.

`--axis vertical` and `--axis horizontal` isolate an axis; the default is `both`. The inactive axis stays at
zero, so only the active axis's last-cell reachability flag is relevant. Sorting still uses the top-left.
`--observe-changes auto|on|off` controls source-change observation. The default leaves the setting unspecified;
sorting can enable observation in a deferred task. Compare `auto` and `off` to attribute this feature's cost,
but do not present disabling externally observed updates as an equivalent optimization.

Data, schema and the expected minimum sort key are generated **before** constructor timing. Each trial uses a
new browser page. `--warmup` discards whole trials rather than reusing a grid. This warms the browser process,
not necessarily every fresh page's JavaScript JIT. No CPU throttling is applied. Run comparisons on the same
machine without other benchmark, build or browser jobs; report medians and ranges across trials, plus pooled
frame-gap percentiles. Do not use the quickest trial as the result.

The runner records:

- Synchronous constructor duration, including the constructor's render work. It does not isolate first paint.
- Jumps to the top, midpoint and bottom-right by setting the native holder's scroll offsets, then waiting for
  two animation callbacks. `settledMs` includes frame scheduling and is **not** render CPU time, trusted input
  latency or a guarantee that a frame reached the display. The top position can be a no-op.
- First rendered coordinates, rendered dimensions, DOM `td` count, scroll dimensions and whether the final
  logical row and column were included in the bottom-right viewport. These help detect scroll range limits.
- Thirty animation-driven diagonal steps back from the bottom-right by one row/column per callback. Frame gaps
  show missed scheduling opportunities; a 16.7ms gap on a 60Hz run is not 16.7ms of grid CPU work. The last
  mutation is flushed with another callback. Small grids can clamp at zero before the sequence ends; compare
  like-for-like workloads and inspect traces, rather than treating these gaps as a cross-size speed ratio.
  The fixed-size scroll extent is read once before the sequence so the harness does not repeatedly query layout
  inside the animation callback.
- CDP script, task, style and layout duration/count deltas for that sequence. Duration counters are in seconds;
  they overlap and must not be added together. They include browser scheduling and benchmark activity.
- One ascending numeric sort at the top-left, including map installation, hooks and synchronous rendering.
  `sort.settledMs` adds the same two-callback wait. The minimum displayed key is checked against the input.

Results include browser/Node versions, CPU model, supplied revision and SHA-256 hashes of the runner, production
bundle and stylesheet.
The revision is a label, not a substitute for rebuilding. The JSON is saved after each completed trial;
`complete: true` is required before treating a run as complete. A page watchdog aborts an unresponsive trial
after four minutes. Nothing under `results/` should be committed.

## Count and memory diagnostics

```sh
tools/in-playwright-docker.sh node tools/performance/scalability.mjs \
  --cases small,tall100k,tall1m,wide --diagnostics --frames 5 \
  --revision "$(git rev-parse HEAD)" --output tools/performance/results/counts.json
```

This runs one fresh page per case. V8 precise coverage records function calls, resolved back to source locations
using the production source map. Wrappers count master-table `getRowHeight` and `getColumnWidth` calls during each
jump; they do not include independent clone-table calls. No additional grid hooks are registered. Coverage,
wrappers and forced GC alter execution: **no timings from this mode are reported**.

CDP `Runtime.getHeapUsage().usedSize` is sampled after forced GC: empty page; caller-owned data and schema before
construction; initialized grid; after scrolling; destroyed grid while the caller retains data/settings; and
after releasing those caller references. Differences estimate JS-heap engine overhead separately from input
storage. They exclude DOM/native/GPU allocations, browser-process RSS and other contexts. Warmed code and module
caches can remain after destruction: a positive delta alone is not proof of a leak. Establish a plateau over
repeated creation/destruction and inspect retained objects before making that claim.

Cell meta objects are counted through `getCellMetaAtRow` outside the scroll operation. Do not use
`getCellsMeta().length` as an object count: its flattened result can include empty entries and its construction
can dominate a large diagnostic. Diagnostic samples happen after the tested scroll sequence; the count scan
itself is not part of scroll timing or profiles.

## CPU and browser traces

```sh
tools/in-playwright-docker.sh node tools/performance/scalability.mjs \
  --cases small,tall100k,tall1m,wide --profile \
  --revision "$(git rev-parse HEAD)" --output tools/performance/results/profile.json
```

This mode runs **without** coverage, wrappers or forced GC. It writes separate `.cpuprofile` files for the
position jumps, continuous scroll and sort, plus a Chrome trace spanning the interactions. Load CPU profiles in
DevTools' JavaScript profiler and the `.trace.json` in the Performance panel. Attribute geometry, hooks, DOM
rendering, style/layout, paint and GC separately. Trace times are diagnostic; use the uninstrumented run for
performance comparisons. `--profile` and `--diagnostics` are mutually exclusive.

This investigation supplements the general browser benchmark harness. It does not replace trusted wheel,
keyboard and pointer interaction traces, selection/edit/paste latency scenarios, long-duration retention tests
or Firefox/WebKit performance measurements. See the [stage-4 design](../../docs/specs/2026-10-15-large-grid-performance-design.md)
for those acceptance scenarios and compatibility requirements.
