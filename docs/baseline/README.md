# Upstream baseline

`6.2.2-results.json` records which upstream Handsontable 6.2.2 tests pass with the original toolchain
(Node 10, Jest 23, Jasmine 2.5, Puppeteer 1). FreeGrid's acceptance rule: every test that passed here
must pass on the new toolchain, or be marked `xit` with an `FG-SKIP` comment and a linked issue.

Recorded 2026-10-12: unit 454 passed; e2e 2034 passed / 27 pending; walkontable 256 passed / 8 pending;
production (minified build) 2034 passed / 27 pending; types passed. No upstream test failed.

Reproduce:

```bash
docker build -t freegrid-baseline tools/baseline
docker run --rm -v "$PWD":/repo:ro -v "$PWD/tools/baseline":/tools:ro -v /tmp/fg-baseline:/out \
  freegrid-baseline bash /tools/run-baseline.sh
node tools/baseline/normalize.mjs /tmp/fg-baseline docs/baseline/6.2.2-results.json "handsontable-6.2.2 (c2ba2dc)"
```
