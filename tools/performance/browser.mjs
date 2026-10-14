// MIT. Uses the repository's existing Playwright; no added dependencies or source instrumentation.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { startServer } from '../../packages/sheet/test/runner/server.js';
import { configuration, distribution, metadata, save, sheet } from './common.mjs';

const config = configuration('browser');
const evidence = { ...metadata(config, ['dist/freesheet.full.min.js', 'dist/freesheet.full.min.css']),
  viewport: { width: 1200, height: 1000 }, deviceScaleFactor: 1,
  headless: true, timing: 'Normal frame scheduling; two RAF callbacks are a frame opportunity, not measured presentation.',
  memory: config.profile ? 'Disabled while profiling: no forced GC inside diagnostic window.' : 'Explicit-GC JS heap snapshots; native DOM/process memory excluded.',
  results: [],
};
const { chromium } = createRequire(resolve(sheet, 'package.json'))('playwright');
const server = await startServer(sheet, { '/performance.html':
  '<link rel="stylesheet" href="/dist/freesheet.full.min.css"><script src="/dist/freesheet.full.min.js"></script><div id="grid"></div>' });
let browser;
try {
  // The correctness runner removes the frame cap; performance measurements keep normal scheduling.
  browser = await chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'] });
  evidence.browser = browser.version();
  const scenarios = config.scenario === 'all' ? ['grid', 'remove-rows'] : [config.scenario];
  for (const scenario of scenarios) {
    for (const rows of config.rows) {
      const amounts = scenario === 'remove-rows' ? config.remove.filter(amount => amount <= rows) : [null];
      if (!amounts.length) throw new Error(`No --remove amount fits ${rows} rows`);
      for (const removedCount of amounts) {
        for (let trial = -config.warmup; trial < config.trials; trial++) {
          const page = await browser.newPage({ viewport: evidence.viewport, deviceScaleFactor: evidence.deviceScaleFactor });
          page.setDefaultTimeout(120000);
          // Node timers cannot interrupt synchronous JS in the renderer. Close the page on an overrun.
          const timeout = setTimeout(() => { page.close().catch(() => {}); }, 120000);
          try {
            const cdp = await page.context().newCDPSession(page);
            await page.goto(`${server.url}/performance.html`);
            await page.waitForFunction(() => typeof window.FreeSheet === 'function');
            const heap = async () => {
              if (config.profile) return null;
              await cdp.send('HeapProfiler.collectGarbage');
              return (await cdp.send('Runtime.getHeapUsage')).usedSize;
            };
            const emptyHeap = await heap();
            await page.evaluate(({ rows, columns }) => {
              // Allocate outside all timed operations. Column zero pins original row identity.
              window.performanceData = Array.from({ length: rows }, (_, row) => Array.from({ length: columns }, (_, col) => col === 0 ? row : (row + col) % 1000));
              window.performanceFrames = () => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
            }, { rows, columns: config.columns });
            const dataHeap = await heap();
            const traceEvents = [];
            if (config.profile) {
              await cdp.send('Profiler.enable');
              await cdp.send('Profiler.start');
              cdp.on('Tracing.dataCollected', ({ value }) => traceEvents.push(...value));
              await cdp.send('Tracing.start', { categories: 'v8,devtools.timeline', transferMode: 'ReportEvents' });
            }
            const initialization = await page.evaluate(async ({ scenario }) => {
              window.performanceRenderTimes = [];
              window.performanceFilterCalls = 0;
              const start = performance.now();
              window.performanceGrid = new window.FreeSheet(document.getElementById('grid'), {
                data: window.performanceData, width: 1000, height: 600,
                rowHeaders: true, colHeaders: true, rowHeights: 23, autoRowSize: false,
                ...(scenario === 'auto-columns' ? {} : { colWidths: 80, autoColumnSize: false }),
                afterRender() { window.performanceRenderTimes.push(performance.now() - start); },
              });
              const constructorMs = performance.now() - start;
              window.performanceGrid.addHook('beforeDataFilter', () => { window.performanceFilterCalls++; });
              await window.performanceFrames();
              return { constructorMs, firstAfterRenderMs: window.performanceRenderTimes[0], initialFrameOpportunityMs: performance.now() - start };
            }, { scenario });
            await page.waitForTimeout(300);
            const initializedHeap = await heap();
            const interaction = await page.evaluate(async ({ scenario, rows, removedCount, columns, iterations }) => {
              const grid = window.performanceGrid;
              if (scenario === 'remove-rows') {
                const startRow = Math.floor((rows - removedCount) / 2);
                const start = performance.now();
                grid.alter('remove_row', startRow, removedCount);
                const synchronousMs = performance.now() - start;
                await window.performanceFrames();
                const frameOpportunityMs = performance.now() - start;
                const data = grid.getSourceData();
                if (grid.countRows() !== rows - removedCount || data.length !== rows - removedCount || window.performanceFilterCalls !== 1 ||
                  (startRow > 0 && data[startRow - 1][0] !== startRow - 1) ||
                  (startRow < data.length && data[startRow][0] !== startRow + removedCount)) {
                  throw new Error(`Row-removal postconditions failed: ${JSON.stringify({ rows: grid.countRows(), sourceRows: data.length, filterCalls: window.performanceFilterCalls, startRow, removedCount })}`);
                }
                return { startRow, synchronousMs, frameOpportunityMs, filterCalls: window.performanceFilterCalls, remainingRows: data.length };
              }
              const samples = { scroll: [], selectionSyncMs: [], updateSyncMs: [], updateFrameOpportunityMs: [], frameIntervalsMs: [] };
              let recording = true;
              let previous;
              let frameId;
              const frame = (time) => {
                if (previous !== undefined) samples.frameIntervalsMs.push(time - previous);
                previous = time;
                if (recording) frameId = requestAnimationFrame(frame);
              };
              frameId = requestAnimationFrame(frame);
              try {
                const scroller = grid.view.wt.wtTable.holder;
                for (const fraction of [0, .1, .5, .9, 1, .5, 0, .9]) {
                  const start = performance.now();
                  scroller.scrollTop = (scroller.scrollHeight - scroller.clientHeight) * fraction;
                  await window.performanceFrames();
                  samples.scroll.push({ fraction, frameOpportunityMs: performance.now() - start,
                    actualTop: scroller.scrollTop, firstRenderedRow: grid.view.wt.wtTable.getFirstRenderedRow() });
                }
                for (let i = 0; i < iterations; i++) {
                  const row = i % rows;
                  const column = i % columns;
                  let start = performance.now();
                  grid.selectCell(row, column, row, column, false);
                  samples.selectionSyncMs.push(performance.now() - start);
                  start = performance.now();
                  grid.setDataAtCell(row, column, i + 2000);
                  samples.updateSyncMs.push(performance.now() - start);
                  await window.performanceFrames();
                  samples.updateFrameOpportunityMs.push(performance.now() - start);
                  if (grid.getDataAtCell(row, column) !== i + 2000) throw new Error('Cell update postcondition failed');
                }
                return { ...samples, scrollHeight: scroller.scrollHeight, renderedCells: document.querySelectorAll('#grid td').length };
              } finally {
                recording = false;
                cancelAnimationFrame(frameId);
              }
            }, { scenario, rows, removedCount, columns: config.columns, iterations: config.iterations });
            if (config.profile) {
              const { profile } = await cdp.send('Profiler.stop');
              const prefix = `${config.output.replace(/\.json$/, '')}-${scenario}-${rows}-${removedCount ?? 0}`;
              save(`${prefix}-cpu.json`, profile);
              const completed = new Promise(done => cdp.once('Tracing.tracingComplete', done));
              await cdp.send('Tracing.end');
              await completed;
              save(`${prefix}-trace.json`, traceEvents);
            }
            const interactionHeap = await heap();
            await page.evaluate(async () => {
              window.performanceGrid.destroy();
              window.performanceGrid = null;
              await window.performanceFrames();
              if (document.querySelector('#grid').childNodes.length) throw new Error('Grid destruction postcondition failed');
            });
            const destroyedWithDataHeap = await heap();
            await page.evaluate(() => { window.performanceData = null; window.performanceRenderTimes = null; });
            const releasedHeap = await heap();
            if (trial >= 0) {
              const result = { scenario, rows, columns: config.columns, removedCount, trial, initialization, interaction,
                heapBytes: { emptyHeap, dataHeap, initializedHeap, interactionHeap, destroyedWithDataHeap, releasedHeap } };
              evidence.results.push(result);
              console.log(JSON.stringify({ scenario, rows, removedCount, trial, constructorMs: initialization.constructorMs,
                operationMs: interaction.synchronousMs, selectionMs: distribution(interaction.selectionSyncMs ?? [])?.median }));
              save(config.output, evidence);
            }
          } finally {
            clearTimeout(timeout);
            await page.close();
          }
        }
      }
    }
  }
  evidence.complete = true;
} catch (error) {
  evidence.failure = { message: error.message };
  throw error;
} finally {
  try { save(config.output, evidence); } finally {
    try { await browser?.close(); } finally { await server.close(); }
  }
}
console.log(`Saved ${config.output}`);
