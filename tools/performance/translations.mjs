// Browser measurements of the production distribution. No additional dependencies.
import { createRequire, SourceMap } from 'node:module';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import { cpus } from 'node:os';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../../packages/sheet/test/runner/server.js';

const root = fileURLToPath(new URL('../..', import.meta.url));
const sheet = resolve(root, 'packages/sheet');
const { values } = parseArgs({ options: {
  rows: { type: 'string', default: '100' }, columns: { type: 'string', default: '20,5000' },
  modes: { type: 'string', default: 'none,array,object' },
  trials: { type: 'string', default: '15' }, warmup: { type: 'string', default: '3' },
  counts: { type: 'boolean', default: false }, revision: { type: 'string' },
  'render-batches': { type: 'boolean', default: false },
  output: { type: 'string', default: 'tools/performance/results/translations.json' },
} });
const integer = (value, min = 1) => {
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < min) throw new Error(`Invalid integer: ${value}`);
  return Number(value);
};
const rows = values.rows.split(',').map(value => integer(value));
const columns = values.columns.split(',').map(value => integer(value));
const modes = values.modes.split(',');
if (modes.some(mode => !['none', 'array', 'object', 'function'].includes(mode))) throw new Error('Invalid --modes');
const trials = values.counts ? 1 : integer(values.trials);
const warmup = values.counts ? 0 : integer(values.warmup, 0);
const output = resolve(root, values.output);
const bundle = readFileSync(resolve(sheet, 'dist/freesheet.full.min.js'), 'utf8');
const sourceMap = new SourceMap(JSON.parse(readFileSync(resolve(sheet, 'dist/freesheet.full.min.js.map'), 'utf8')));
const lineStarts = [0];
for (let index = 0; index < bundle.length; index++) if (bundle[index] === '\n') lineStarts.push(index + 1);
const originalLocation = (offset) => {
  let line = 0;
  while (line + 1 < lineStarts.length && lineStarts[line + 1] <= offset) line++;
  const entry = sourceMap.findEntry(line, offset - lineStarts[line]);
  return { file: entry.originalSource, line: entry.originalLine + 1, column: entry.originalColumn + 1 };
};
const evidence = { timestamp: new Date().toISOString(), node: process.version, cpu: cpus()[0].model, options: values,
  bundleSha256: createHash('sha256').update(bundle).digest('hex'), results: [] };
const save = () => { mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`); };
const { chromium } = createRequire(resolve(sheet, 'package.json'))('playwright');
const server = await startServer(sheet, { '/translations.html': '<link rel="stylesheet" href="/dist/freesheet.full.min.css"><script src="/dist/freesheet.full.min.js"></script><div id="grid"></div>' });
let browser;
try {
  browser = await chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'] });
  evidence.browser = browser.version();
  for (const rowCount of rows) for (const columnCount of columns) for (const mode of modes) {
    for (let trial = -warmup; trial < trials; trial++) {
      const page = await browser.newPage({ viewport: { width: 1200, height: 1000 }, deviceScaleFactor: 1 });
      const watchdog = setTimeout(() => { page.close().catch(() => {}); }, 120000);
      try {
        await page.goto(`${server.url}/translations.html`);
        await page.evaluate(({ rowCount, columnCount, mode }) => {
          window.translationCounts = { columns: 0, modifyRow: 0, modifyCol: 0, totalHooks: 0 };
          const definitions = Array.from({ length: columnCount }, (_, index) => ({ data: index, title: `Header ${index}` }));
          window.translationSettings = {
            width: 1000, height: 600, rowHeights: 23, colWidths: 80, colHeaders: true,
            autoRowSize: false, autoColumnSize: false,
          };
          if (mode === 'object') {
            window.translationData = Array.from({ length: rowCount }, (_, row) => Object.fromEntries(Array.from({ length: columnCount }, (_, col) => [`field${col}`, row + col])));
          } else {
            window.translationData = Array.from({ length: rowCount }, (_, row) => Array.from({ length: columnCount }, (_, col) => row + col));
          }
          if (mode === 'array') window.translationSettings.columns = definitions;
          if (mode === 'function') window.translationSettings.columns = index => index % 5 === 4 ? undefined : definitions[index];
          window.translationPaste = Array.from({ length: Math.min(10, rowCount) }, () => Array(Math.min(10, columnCount)).fill(12345));
        }, { rowCount, columnCount, mode });
        const constructorMs = await page.evaluate(() => {
          const start = performance.now();
          window.translationGrid = new window.FreeSheet(document.getElementById('grid'), { ...window.translationSettings, data: window.translationData });
          return performance.now() - start;
        });
        await page.waitForTimeout(200);
        const cdp = await page.context().newCDPSession(page);
        if (values.counts) {
          await page.evaluate(() => {
            const grid = window.translationGrid;
            const runHooks = grid.runHooks;
            grid.runHooks = function(name, ...args) {
              window.translationCounts.totalHooks++;
              if (name === 'modifyRow' || name === 'modifyCol') window.translationCounts[name]++;
              return runHooks.call(this, name, ...args);
            };
            const columns = grid.getSettings().columns;
            if (typeof columns === 'function') grid.getSettings().columns = function(index) {
              window.translationCounts.columns++;
              return columns.call(this, index);
            };
          });
          await cdp.send('Profiler.enable');
        }
        const samples = {};
        for (const operation of values['render-batches'] ? ['renderBatch'] : ['render', 'headers', 'singleHeaders', 'paste']) {
          await page.evaluate(() => { window.translationCounts = { columns: 0, modifyRow: 0, modifyCol: 0, totalHooks: 0 }; });
          if (values.counts) await cdp.send('Profiler.startPreciseCoverage', { callCount: true, detailed: false });
          const result = operation === 'renderBatch' ? await page.evaluate(() => {
            const start = performance.now();
            for (let index = 0; index < 20; index++) window.translationGrid.render();
            return { synchronousMs: performance.now() - start, renders: 20, counts: window.translationCounts };
          }) : await page.evaluate(async ({ operation, columnCount }) => {
            const grid = window.translationGrid;
            const start = performance.now();
            let output;
            if (operation === 'render') grid.render();
            if (operation === 'headers') output = grid.getColHeader();
            if (operation === 'singleHeaders') for (let index = 0; index < 100; index++) output = grid.getColHeader(index % Math.min(columnCount, 10));
            let changed;
            if (operation === 'paste') {
              changed = new Promise(done => grid.addHookOnce('afterChange', done));
              grid.populateFromArray(0, 0, window.translationPaste, undefined, undefined, 'performance-paste');
            }
            const synchronousMs = performance.now() - start;
            if (changed) await changed;
            return { synchronousMs, settledMs: performance.now() - start, counts: window.translationCounts,
              headerCount: Array.isArray(output) ? output.length : null, firstHeader: Array.isArray(output) ? output[0] : output };
          }, { operation, columnCount });
          if (values.counts) {
            const { result: coverage } = await cdp.send('Profiler.takePreciseCoverage');
            await cdp.send('Profiler.stopPreciseCoverage');
            result.functions = coverage.filter(script => script.url.endsWith('/dist/freesheet.full.min.js')).flatMap(script => script.functions)
              .filter(fn => ['colToProp', 'propToCol', 'getColHeader', 'countSourceCols', 'countCols', 'runHooks'].includes(fn.functionName))
              .map(fn => ({ name: fn.functionName, calls: fn.ranges[0].count, location: originalLocation(fn.ranges[0].startOffset) }));
            const hookCalls = result.functions.filter(fn => fn.name === 'runHooks').reduce((sum, fn) => sum + fn.calls, 0);
            if (hookCalls !== result.counts.totalHooks) throw new Error('Hook wrapper missed a dispatch');
            delete result.synchronousMs;
            delete result.settledMs;
          }
          if (!values.counts) delete result.counts;
          if (operation === 'headers' && result.headerCount !== columnCount) throw new Error(`Unexpected header count: ${result.headerCount}`);
          if (operation === 'paste' && !await page.evaluate(() => window.translationGrid.getDataAtCell(0, 0) === 12345)) throw new Error('Paste did not settle');
          samples[operation] = result;
        }
        await page.evaluate(() => { window.translationGrid.destroy(); window.translationGrid = null; window.translationData = null; });
        if (trial >= 0) {
          evidence.results.push({ rows: rowCount, columns: columnCount, mode, trial, ...(values.counts ? {} : { constructorMs }), samples });
          save();
          console.log(JSON.stringify({ rows: rowCount, columns: columnCount, mode, trial,
            headers: samples.headers?.synchronousMs, renderBatch: samples.renderBatch?.synchronousMs }));
        }
      } finally { clearTimeout(watchdog); await page.close(); }
    }
  }
  evidence.complete = true;
} finally {
  save();
  await browser?.close();
  await server.close();
}
