# Rendering direction: keep DOM, defer Canvas

Status: accepted direction, 2026-10-15. Keep the production DOM renderer. Canvas is a deferred research
option, not a planned feature or an approved core rewrite. This document records the experiment, its limits,
and the reasoning needed to continue performance work without repeating the discussion.

This change documents a decision; it changes no production code, public API or user-visible behavior. The
standalone prototype is not included in this PR or the published library. No implementation tasks below are
implicitly authorized by this document.

## Product requirements behind the decision

The goal is responsive scrolling, selection and editing with many rows **and** columns, while retaining
custom cell content: live charts, comboboxes, buttons and future React/Vue components. Fast plain-text drawing
alone is insufficient. Preserve compatibility, accessibility, maintainability and existing renderer/editor
behavior rather than optimize a restricted demonstration at their expense.

Several milliseconds of main-thread grid work per ordinary interaction is a useful target, not a universal
promise. Presentation also depends on refresh rate and browser work. Importing or globally sorting a million
values has a different cost from displaying the small visible rectangle. Moving work to a Worker can improve
responsiveness while that work is running; it does not make completion instantaneous.

## What the local experiment actually tested

An independently written, standalone prototype used the same controller, uniform geometry, value source and
visible display list with two interchangeable renderers:

- Canvas 2D drew visible plain-text cells and headers into a viewport-sized bitmap.
- A minimal DOM control reused absolutely positioned elements and updated their text/styles.

Both used DOM selection/focus elements, a native textarea editor, keyboard/pointer handling and bounded TSV
copy/paste. Moving selection within the viewport did not repaint Canvas content. Uniform offsets were
calculated arithmetically. Native scroll extent was capped at eight million CSS pixels and projected onto
logical coordinates; that cap was an experimental choice, not a discovered universal browser limit.

Computed sources generated values on demand and retained edits. A logical 1,000,000 by 5,000 sheet therefore
did **not** allocate five billion values. Real-array cases generated their data outside timed interactions
and were capped at two million cells. An optional adapter loaded the unchanged production FreeSheet bundle
for context, not as a feature-equivalent renderer comparison.

### Historical measurements

Baseline production source: `0b72f018c673edae3d11a633d483324dcd342f83`, without the pending data-operation PRs.
Local experiment commit: `9829413193f1765d67bca41a5353065c3ff6a6f7` on `codex/canvas-grid-prototype`.
That branch is retained locally, is not published by this PR, and is not assumed to be available to another
checkout. These are historical observations, not benchmarks runnable from this documentation-only branch.
Do not report a new result without retrieving or recreating the harness and running it again.
Where the local branch still exists, its `tools/canvas-grid/README.md` records the server, verification and
benchmark commands; generated reports remain untracked. This PR does not provide a durable prototype archive.

Environment: Intel i7-14700KF, Chromium 156.0.8078.4, Node 24.21.0 in the repository's Playwright Docker image;
browser viewport 1,200 by 1,000, grid 1,000 by 600, device scale 1, row height 28px, column width 120px.
Production full-min bundle SHA-256: `1fea070ccbb6a9ec469cd88b3d74102bc5645fd59393492108fe487a972b6a33`.

Each renderer/case had one discarded warm-up and five measured fresh-page trials, with renderer order
alternated. After reaching the last cell and settling near the middle, each trial applied 41 diagonal scroll
mutations across 40 animation-frame intervals. Small-case oscillation avoided repeatedly hitting an edge.
The completed run contained 50 measured trials, including the two array cases for production FreeSheet.

| Source and dimensions | Canvas / minimal DOM draw submission p95, ms | Canvas / minimal DOM layout total, ms | Canvas / minimal DOM frame-gap p95, ms |
| --- | ---: | ---: | ---: |
| Real array, 100 by 20 | 0.7 / 0.4 | 0.16 / 29.92 | 16.7 / 16.7 |
| Real array, 100,000 by 20 | 0.7 / 0.5 | 0.17 / 30.93 | 16.7 / 16.7 |
| Computed, 1,000,000 by 20 | 0.6 / 0.5 | 0.20 / 29.25 | 16.7 / 16.8 |
| Computed, 100,000 by 5,000 | 0.6 / 0.5 | 0.17 / 30.02 | 16.7 / 16.7 |

Draw columns are medians of trial p95 values; layout columns are median CDP totals for a **whole scroll
sequence**, not per-frame costs; frame-gap columns pool 200 intervals per renderer/case. Synchronous draw
submission includes display-list construction and visible value reads, but excludes deferred layout, raster,
GPU completion and presentation. CDP duration counters overlap and include harness activity; do not add them.
Scripted frame gaps are not trusted wheel-event input-to-display latency or a measure of grid CPU alone.

Both prototypes read 168 body-cell values at the final measured viewport. Canvas had 12 grid DOM elements;
minimal DOM had 213. In the dense array case, median whole-sequence task time was 58.2ms versus 115.8ms.
Array creation separately took roughly 113–115ms. None of these are single-frame latency measurements.

The production engine's small/dense frame-gap p95 was 16.8ms, with 592/560 body TDs including buffers/clones.
It ran metadata, callbacks, overlays and plugins absent from the prototype. Its cell count and functionality
differed, so these results cannot establish a Canvas-versus-production speed ratio. Prototype attachment
scheduled its first draw; production attachment included synchronous rendering. Those initialization fields
also had different timing boundaries and cannot establish a first-render advantage.

### What follows, and what does not

The measured result is reduced layout work in this controlled plain-text prototype. Canvas synchronous
submission was slightly slower than the minimal DOM control, while both stayed near a 60Hz frame interval.
No visible scrolling advantage over production FreeSheet, universal speed-up percentage, retained-memory
improvement or production feature parity was demonstrated. Fewer DOM nodes alone do not measure total memory;
Canvas backing stores also consume memory and scale with device pixel ratio.

The experiment omitted variable sizes, merged/frozen cells, formulas, sorting, undo/redo, custom HTML
renderers, production hooks/plugins and pointer-drag auto-scroll. Clipboard operations were bounded. Checks
passed for seven model tests and 12 browser check groups in each of Chromium, Firefox and WebKit, including
resize, high-DPI backing size and destruction. Chromium exercised real browser clipboard shortcuts; the other
two exercised clipboard-event integration. Composition testing covered the Enter guard, not real IMEs.
Active-cell semantic DOM was not a complete screen-reader implementation. These checks validate the narrow
prototype, not compatibility with the full spreadsheet.

## React/Vue wrappers and rich cells

A wrapper around the whole grid can mount an imperative instance, update settings/data, forward events and
destroy the instance on unmount. Canvas does not fundamentally prevent that integration. Efficient updates,
stable ownership and avoiding duplicate listeners still need design under either renderer.

Embedding arbitrary framework components **inside cells** is a different contract:

| Content | Existing DOM direction | Possible future hybrid direction |
| --- | --- | --- |
| Text, numbers, backgrounds and simple icons | Regular cell renderer | Canvas draw commands |
| Small live sparkline | DOM/SVG/Canvas hosted in a cell | Draw into grid Canvas; update only visible changed content |
| Combobox while editing | Native or framework DOM editor | Paint the inactive value; mount a real DOM editor when activated |
| Always-visible combobox, button or framework component | DOM cell content | A positioned DOM host over the cell |
| Full interactive chart with tooltips | Component owns its DOM/SVG/Canvas within a cell | Visible-cell DOM host; a generic chart library cannot automatically draw into the grid's shared Canvas |

[React portals](https://react.dev/reference/react-dom/createPortal) and
[Vue Teleport](https://vuejs.org/guide/built-ins/teleport) can place component DOM in a grid-managed host while
preserving the framework's logical component hierarchy. They do not turn a DOM component into Canvas pixels
or remove its lifecycle cost. Many always-mounted rich components retain their DOM/framework cost even if
plain cells are painted with Canvas. Virtualize components to visible cells plus a bounded buffer.

The current [cell renderer bridge](../../packages/sheet/src/tableView.ts#L316) passes an actual
`HTMLTableCellElement` to renderers and before/after hooks. Canvas cannot transparently replace this contract.
A future backend would need explicit capabilities and a new drawing/hosting contract, with a compatible DOM
path for existing custom renderers. An outer React/Vue wrapper does not solve that compatibility issue.

Both a DOM wrapper and any hybrid design must address:

- **Identity and state:** bind state to stable data-row/column identities, not recycled viewport positions.
  Sorting, filtering and moving rows must not attach an existing editor/chart to the wrong record.
- **Lifecycle:** mount/update/unmount hosts deliberately; dispose chart instances, observers, listeners and
  subscriptions when cells leave the viewport or the grid is destroyed. Test repeated cycles for retention.
- **Focus and input:** define keyboard ownership, composition, clipboard and commit/cancel behavior. Decide
  whether scrolling pins an active editor or ends editing; do not silently destroy focused input.
- **Positioning:** synchronize hosts, clipping and popups with scrolling, resize, zoom, RTL and frozen panes.
  A popup may need a separate host outside the cell's clipped area.
- **Updates:** batch visible chart/data changes into frame work. Avoid rerendering the full grid for each
  sample or selection change. Keep offscreen work bounded without silently dropping required data updates.
- **Accessibility:** keep semantics, focus navigation and assistive-technology behavior as explicit
  requirements. A few hidden DOM elements are not evidence of spreadsheet accessibility parity.

## What still limits large DOM grids

DOM virtualization already bounds rendered content. It does not ensure the calculations feeding that content
are bounded. The current baseline has these independently inspectable paths:

| Path | Why it matters | Candidate direction and compatibility constraint |
| --- | --- | --- |
| [Row](../../packages/sheet/src/3rdparty/walkontable/src/calculator/viewportRows.ts#L87) and [column](../../packages/sheet/src/3rdparty/walkontable/src/calculator/viewportColumns.ts#L103) viewport calculations | Walk from index zero toward the viewport and build prefix positions; deep scrolling can process offscreen dimensions | Shared geometry index. Arithmetic for proven uniform sizes; prefix search or a measured updateable structure for variable sizes. Preserve callback behavior, exact boundaries and invalidation. |
| [Overlay size sums](../../packages/sheet/src/3rdparty/walkontable/src/overlay/top.ts#L118) | Repeated range walks can duplicate geometry work | Use the same geometry version for viewport, offsets and frozen panes; avoid independent caches that drift. |
| [Width lookup](../../packages/sheet/src/core.ts#L3011) | Reads row-zero cell meta, including translations/hooks, for queried columns | First reduce redundant queries. A settings-only path is safe only when live cell meta and hooks cannot alter the answer. |
| [Row count validation](../../packages/sheet/src/dataMap.ts#L721) | With row-translation hooks, cache revalidation can scan source rows | Investigate mutation/version-based counts; arbitrary hooks and external source writes need a compatible path. |
| [Cell rendering](../../packages/sheet/src/3rdparty/walkontable/src/tableRenderer.ts#L385) | Nodes are already reused, but full passes clear styles/classes and invoke renderers for rendered cells | Profile redundant rebinding and layout reads after writes. Skipping renderer/hook calls may change behavior; it is not automatically a safe refactor. |
| Global sort and full-source storage | They process/store more than the viewport | Prepare supported sort keys once, measure index installation, and consider an explicit provider/Worker mode only if needed. Changing drawing does not remove these costs. |

The separate [large-grid design and diagnostic baseline](https://github.com/freegrid-web/sheet/pull/105)
contains the broader profiling evidence. That proposal is independent of this PR and may still be pending;
do not assume its files or the benchmark harness from PR #101 are already present on `main`. Its geometry,
feature settings and data sources differed from the Canvas experiment: do not combine the two result tables
as a before/after comparison. Rebaseline after pending data-operation changes merge.

In that separate production baseline, a midpoint-to-bottom jump made 3,000,074 master row-height queries for
one million rows despite only 444 body TDs at the final viewport. A separate CPU sample attributed about
1.95s of a 3.05s continuous-scroll profile to calculator ancestry. Numeric global sort took about 2.6s in
uninstrumented trials. These historical diagnostics motivate investigating offscreen JavaScript work before
replacing the drawing backend; they are not Canvas speed-up measurements or current-main guarantees.

Geometry work needs explicit invalidation for insertion/removal, visual reordering/filtering, resize,
settings/hooks, measured content, fonts/themes and wrapping. Preserve the logical scroll anchor when sizes
change. A scalar height setting alone does not prove effective sizes are uniform. Dynamic callbacks and
live mutable metadata can defeat naive caching; metadata is already created lazily on access, and eviction
can break its identity. Keep a compatible fallback until eligibility is established.

For proven uniform sizes, offsets and range sums can use O(1) arithmetic without per-row storage. Known
variable sizes can use prefix sums with binary search, but a point change costs O(N) to update the suffix.
A Fenwick tree supports O(log N) point updates, range sums and offset lookup, with O(N) construction/storage;
chunked default-size summaries may suit mostly uniform sheets. Benchmark construction, resize, structural
changes and memory as well as warm lookup; do not add a tree for a scalar size.

IndexedDB remains a possible persistence/cache layer, not a rendering optimization. Its
[asynchronous storage and indexes](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) can support
a separately designed data provider. Reading everything back into the same full-memory grid does not bound
memory. Sorting only loaded pages is incorrect for a global sort, and database index ordering does not
automatically implement every custom comparator. Worker messaging, stale jobs, edits during sorting and the
main-thread cost of applying results must be measured separately.

## Handoff: how to continue

1. Keep DOM as the production backend; retain HTML/custom renderer and editor compatibility. Do not land the
   prototype as a feature or start a Canvas/core rewrite from this decision.
2. Finish independent data-operation PRs in the agreed order. Rebaseline the merged production build using
   the shared performance tools when available. Do not stack a new optimization on an unmerged PR.
3. Agree on a separate rendering design before changing viewport calculators, overlays, `sumCellSizes` or
   `tableRenderer`. Start with the smallest justified geometry change; these files remain outside the current
   data-operation assignment. Compare small and large cases and pin current behavior before changing code.
4. Profile again after each measured fix. Improve layout scheduling, cell updates and rich-component hosting
   where remaining evidence justifies it. Do not treat `forEach` rewrites or cache additions as gains by style.
5. For wrappers, design cell-host lifecycle independently of a renderer rewrite. A representative scenario
   should combine plain columns, live charts and actual combobox/framework components, including sort,
   scroll-out/return, editing, resize and destruction.

Measure source generation/storage separately from engine overhead; initialization and first useful
presentation separately; and scroll, selection, edit, sort and destruction separately. Use production builds,
identical feature settings/visible work, fresh-page trials and small/large datasets. Include real input latency,
120Hz or slower-device scenarios, GC and repeated create/interact/destroy retention checks where relevant.
Keep generated results out of Git. Implementation PRs still require the repository's behavior specs and
validation gates; this document adds no production performance claim or new test exception.

Revisit Canvas only if a fresh profile shows DOM/style/paint is a material remaining limit and a
feature-equivalent rich-cell comparison demonstrates a useful gain. Any such proposal needs a separate
compatibility/accessibility design and approval. Until then, the result of this experiment is knowledge about
layout costs, not a commitment to ship another rendering backend.
