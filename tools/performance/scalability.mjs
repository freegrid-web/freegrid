// Measures the production distribution; uses only Node built-ins and the existing browser test dependency.
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
const cases = {
  small: { rows: 100, columns: 20 },
  tall10k: { rows: 10000, columns: 20 },
  tall100k: { rows: 100000, columns: 20 },
  tall1m: { rows: 1000000, columns: 20 },
  wide: { rows: 100, columns: 5000 },
  mixed: { rows: 10000, columns: 200 },
  sparse: { rows: 100000, columns: 5000, populatedColumns: 20 },
};
const { values } = parseArgs({ options: {
  cases: { type: 'string', default: 'small,tall10k,tall100k,tall1m,wide,mixed,sparse' },
  trials: { type: 'string', default: '5' }, warmup: { type: 'string', default: '1' },
  frames: { type: 'string', default: '30' }, diagnostics: { type: 'boolean', default: false },
  profile: { type: 'boolean', default: false },
  'observe-changes': { type: 'string', default: 'auto' },
  axis: { type: 'string', default: 'both' },
  revision: { type: 'string' }, output: { type: 'string', default: 'tools/performance/results/scalability.json' },
} });
const integer = (value, minimum) => {
  const number = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(number) || number < minimum) throw new Error(`Invalid integer: ${value}`);
  return number;
};
const selected = values.cases.split(',');
if (selected.some(name => !Object.hasOwn(cases, name))) throw new Error('Unknown --cases');
if (!['auto', 'on', 'off'].includes(values['observe-changes'])) throw new Error('Invalid --observe-changes');
if (!['both', 'vertical', 'horizontal'].includes(values.axis)) throw new Error('Invalid --axis');
if (values.diagnostics && values.profile) throw new Error('Run --diagnostics and --profile separately');
const instrumented = values.diagnostics || values.profile;
const trials = instrumented ? 1 : integer(values.trials, 1);
const warmup = instrumented ? 0 : integer(values.warmup, 0);
const frames = integer(values.frames, 2);
const output = resolve(root, values.output);
const bundle = readFileSync(resolve(sheet, 'dist/freesheet.full.min.js'), 'utf8');
const sourceMap = new SourceMap(JSON.parse(readFileSync(resolve(sheet, 'dist/freesheet.full.min.js.map'), 'utf8')));
const lineStarts = [0];
for (let index = 0; index < bundle.length; index++) if (bundle[index] === '\n') lineStarts.push(index + 1);
const location = offset => {
  let line = 0;
  while (line + 1 < lineStarts.length && lineStarts[line + 1] <= offset) line++;
  const entry = sourceMap.findEntry(line, offset - lineStarts[line]);
  return { file: entry.originalSource, line: entry.originalLine + 1 };
};
const evidence = { timestamp: new Date().toISOString(), node: process.version, cpu: cpus()[0].model,
  options: values, bundleSha256: createHash('sha256').update(bundle).digest('hex'),
  cssSha256: createHash('sha256').update(readFileSync(resolve(sheet, 'dist/freesheet.full.min.css'))).digest('hex'),
  runnerSha256: createHash('sha256').update(readFileSync(fileURLToPath(import.meta.url))).digest('hex'), results: [] };
const save = () => { mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`); };
const { chromium } = createRequire(resolve(sheet, 'package.json'))('playwright');
const server = await startServer(sheet, { '/scalability.html': '<link rel="stylesheet" href="/dist/freesheet.full.min.css"><script src="/dist/freesheet.full.min.js"></script><div id="grid"></div>' });
let browser;
try {
  browser = await chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'] });
  evidence.browser = browser.version();
  for (const name of selected) for (let trial = -warmup; trial < trials; trial++) {
    const page = await browser.newPage({ viewport: { width: 1200, height: 1000 }, deviceScaleFactor: 1 });
    const watchdog = setTimeout(() => { page.close().catch(() => {}); }, 240000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const result = { name, ...cases[name], trial };
    try {
      await page.goto(`${server.url}/scalability.html`);
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Performance.enable');
      const stopProfile = async label => {
        const { profile } = await cdp.send('Profiler.stop');
        const path = output.replace(/\.json$/, '') + `-${name}-${label}.cpuprofile`;
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, JSON.stringify(profile));
        return path;
      };
      const heap = async () => {
        await cdp.send('HeapProfiler.collectGarbage');
        return (await cdp.send('Runtime.getHeapUsage')).usedSize;
      };
      if (values.diagnostics) result.heapEmptyPage = await heap();
      await page.evaluate(({ rows, columns, populatedColumns = columns, observeChanges, axis }) => {
        window.source = Array.from({ length: rows }, (_, row) => {
          const data = Array.from({ length: populatedColumns }, (_, column) => column === 0 ? Math.imul(row + 1, 2654435761) >>> 0 : row + column);
          return populatedColumns === columns ? data : Object.fromEntries(data.map((value, column) => [`field${column}`, value]));
        });
        window.settings = { data: window.source, width: 1000, height: 600, rowHeights: 23, colWidths: 80,
          rowHeaders: true, colHeaders: true, autoRowSize: false, autoColumnSize: false, columnSorting: true,
          columns: Array.from({ length: columns }, (_, column) => ({ data: populatedColumns === columns ? column : `field${column}`, type: 'numeric' })) };
        if (observeChanges !== 'auto') window.settings.observeChanges = observeChanges === 'on';
        window.scrollAxis = axis;
        window.minimum = window.source.reduce((minimum, row) => Math.min(minimum, Array.isArray(row) ? row[0] : row.field0), Infinity);
        window.sourceShape = { rows, columns: populatedColumns, firstKey: Math.imul(1, 2654435761) >>> 0,
          lastKey: Math.imul(rows, 2654435761) >>> 0 };
        window.frames = () => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
      }, { ...cases[name], observeChanges: values['observe-changes'], axis: values.axis });
      if (values.diagnostics) result.heapDataOnly = await heap();
      result.constructorMs = await page.evaluate(() => {
        const start = performance.now();
        window.grid = new window.FreeSheet(document.getElementById('grid'), window.settings);
        return performance.now() - start;
      });
      await page.evaluate(() => window.frames());
      await page.waitForTimeout(100);
      if (values.diagnostics) {
        result.heapInitialized = await heap();
        await page.evaluate(() => {
          window.geometryCalls = { rowHeights: 0, columnWidths: 0 };
          const table = window.grid.view.wt.wtTable;
          for (const [method, key] of [['getRowHeight', 'rowHeights'], ['getColumnWidth', 'columnWidths']]) {
            const original = table[method];
            table[method] = function(...args) { window.geometryCalls[key]++; return original.apply(this, args); };
          }
        });
      }
      if (instrumented) await cdp.send('Profiler.enable');
      if (values.profile) await cdp.send('Tracing.start', {
        categories: 'devtools.timeline,v8,disabled-by-default-v8.gc', transferMode: 'ReturnAsStream',
      });
      result.positions = [];
      for (const fraction of [0, 0.5, 1]) {
        if (values.diagnostics) {
          await page.evaluate(() => { window.geometryCalls = { rowHeights: 0, columnWidths: 0 }; });
          await cdp.send('Profiler.startPreciseCoverage', { callCount: true, detailed: false });
        }
        if (values.profile) await cdp.send('Profiler.start');
        const position = await page.evaluate(async fraction => {
          const grid = window.grid;
          const holder = grid.view.wt.wtTable.holder;
          const start = performance.now();
          if (window.scrollAxis !== 'horizontal') holder.scrollTop = (holder.scrollHeight - holder.clientHeight) * fraction;
          if (window.scrollAxis !== 'vertical') holder.scrollLeft = (holder.scrollWidth - holder.clientWidth) * fraction;
          await window.frames();
          const settledMs = performance.now() - start;
          const firstRow = grid.rowOffset();
          const firstColumn = grid.colOffset();
          return { fraction, settledMs, firstRow, firstColumn, renderedRows: grid.countRenderedRows(),
            renderedColumns: grid.countRenderedCols(), domCells: document.querySelectorAll('#grid td').length,
            lastRowReachable: firstRow + grid.countRenderedRows() === grid.countRows(),
            lastColumnReachable: firstColumn + grid.countRenderedCols() === grid.countCols(),
            scrollHeight: holder.scrollHeight, scrollWidth: holder.scrollWidth,
            geometryCalls: window.geometryCalls };
        }, fraction);
        if (values.diagnostics) {
          const { result: coverage } = await cdp.send('Profiler.takePreciseCoverage');
          await cdp.send('Profiler.stopPreciseCoverage');
          position.functions = coverage.filter(script => script.url.endsWith('/dist/freesheet.full.min.js'))
            .flatMap(script => script.functions).filter(fn => ['calculate', 'sumCellSizes', 'getRowHeight', 'getColumnWidth'].includes(fn.functionName))
            .map(fn => ({ name: fn.functionName, calls: fn.ranges[0].count, ...location(fn.ranges[0].startOffset) }));
        } else delete position.geometryCalls;
        if (values.profile) position.profilePath = await stopProfile(`position-${fraction}`);
        if (instrumented) delete position.settledMs;
        result.positions.push(position);
      }
      const before = await cdp.send('Performance.getMetrics');
      if (values.profile) await cdp.send('Profiler.start');
      result.scroll = await page.evaluate(async frames => {
        const holder = window.grid.view.wt.wtTable.holder;
        const maximumTop = holder.scrollHeight - holder.clientHeight;
        const maximumLeft = holder.scrollWidth - holder.clientWidth;
        const gaps = [];
        let previous;
        await new Promise(done => {
          const step = timestamp => {
            if (previous !== undefined) gaps.push(timestamp - previous);
            previous = timestamp;
            if (window.scrollAxis !== 'horizontal') holder.scrollTop = Math.max(0, maximumTop - 23 * (gaps.length + 1));
            if (window.scrollAxis !== 'vertical') holder.scrollLeft = Math.max(0, maximumLeft - 80 * (gaps.length + 1));
            if (gaps.length < frames) requestAnimationFrame(step);
            else requestAnimationFrame(done);
          };
          requestAnimationFrame(step);
        });
        return { frameGapsMs: gaps };
      }, frames);
      const after = await cdp.send('Performance.getMetrics');
      result.scroll.browserMetrics = Object.fromEntries(after.metrics.filter(metric =>
        ['LayoutDuration', 'RecalcStyleDuration', 'ScriptDuration', 'TaskDuration', 'LayoutCount', 'RecalcStyleCount'].includes(metric.name))
        .map(metric => [metric.name, metric.value - before.metrics.find(item => item.name === metric.name).value]));
      if (values.profile) result.scrollProfilePath = await stopProfile('scroll');
      if (values.diagnostics) result.metaObjectsAfterScroll = await page.evaluate(() => {
        let count = 0;
        const rowCount = window.grid.countRows();
        for (let row = 0; row < rowCount; row++) {
          const meta = window.grid.getCellMetaAtRow(row);
          if (meta) for (const column of Object.keys(meta)) if (meta[column] && typeof meta[column] === 'object') count++;
        }
        return count;
      });
      if (values.diagnostics) result.heapAfterScroll = await heap();
      if (values.profile) await cdp.send('Profiler.start');
      result.sort = await page.evaluate(async () => {
        const grid = window.grid;
        grid.scrollViewportTo(0, 0);
        await window.frames();
        const start = performance.now();
        grid.getPlugin('columnSorting').sort({ column: 0, sortOrder: 'asc' });
        const synchronousMs = performance.now() - start;
        await window.frames();
        const settledMs = performance.now() - start;
        return { synchronousMs, settledMs, correctMinimum: grid.getDataAtCell(0, 0) === window.minimum };
      });
      if (!result.sort.correctMinimum) throw new Error('Sort returned the wrong first row');
      if (values.profile) {
        result.sort.profilePath = await stopProfile('sort');
        const complete = new Promise(done => cdp.once('Tracing.tracingComplete', done));
        await cdp.send('Tracing.end');
        const { stream } = await complete;
        const parts = [];
        for (;;) {
          const chunk = await cdp.send('IO.read', { handle: stream });
          parts.push(chunk.data);
          if (chunk.eof) break;
        }
        await cdp.send('IO.close', { handle: stream });
        result.tracePath = output.replace(/\.json$/, '') + `-${name}.trace.json`;
        writeFileSync(result.tracePath, parts.join(''));
      }
      await page.evaluate(() => { window.grid.destroy(); window.grid = null; });
      if (values.diagnostics) result.heapDestroyedWithData = await heap();
      result.sourceIntact = await page.evaluate(() => {
        const first = window.source[0];
        const last = window.source[window.source.length - 1];
        const key = row => Array.isArray(row) ? row[0] : row.field0;
        return window.source.length === window.sourceShape.rows && Object.keys(first).length === window.sourceShape.columns &&
          Object.keys(last).length === window.sourceShape.columns && key(first) === window.sourceShape.firstKey && key(last) === window.sourceShape.lastKey;
      });
      if (!result.sourceIntact) throw new Error('Caller-owned source shape or boundary values changed');
      await page.evaluate(() => { window.source = null; window.settings = null; });
      if (values.diagnostics) result.heapDestroyedWithoutData = await heap();
      if (instrumented) {
        delete result.constructorMs;
        delete result.scroll;
        delete result.sort.synchronousMs;
        delete result.sort.settledMs;
      }
      if (errors.length) throw new Error(errors.join('\n'));
      if (trial >= 0) {
        evidence.results.push(result);
        save();
        console.log(JSON.stringify({ name, trial, constructorMs: result.constructorMs,
          bottom: result.positions[2], sort: result.sort, metaObjectsAfterScroll: result.metaObjectsAfterScroll }));
      }
    } catch (error) {
      evidence.error = { name, trial, message: error.message };
      throw error;
    } finally { clearTimeout(watchdog); await page.close(); }
  }
  evidence.complete = true;
} finally {
  save();
  await browser?.close();
  await server.close();
}
