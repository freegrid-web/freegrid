// Production-browser mapper measurements. No dependencies beyond the repository's Playwright.
// Build first, then: tools/in-playwright-docker.sh node tools/performance/mappers.mjs
// Optional: --rows=100,100000 --amounts=1,1000 --trials=15 --warmup=3 --output=path.json
// --memory runs a separate explicit-GC heap diagnostic instead of timing operations.
// Data/maps and index lists are prepared outside each timer. Never commit result files.
import { createRequire } from 'node:module';
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
  rows: { type: 'string', default: '100,100000' }, amounts: { type: 'string', default: '1,1000' },
  trials: { type: 'string', default: '15' }, warmup: { type: 'string', default: '3' },
  output: { type: 'string', default: 'tools/performance/results/mappers.json' },
  memory: { type: 'boolean', default: false },
  'grid-only': { type: 'boolean', default: false },
  revision: { type: 'string' },
} });
if (values.memory && values['grid-only']) throw new Error('Choose --memory or --grid-only');
const integer = (text, min = 1) => {
  const value = Number(text);
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(value) || value < min) throw new Error(`Invalid integer: ${text}`);
  return value;
};
const rows = values.rows.split(',').map(value => integer(value));
const amounts = values.amounts.split(',').map(value => integer(value));
const trials = integer(values.trials);
const warmup = integer(values.warmup, 0);
const output = resolve(root, values.output);
const evidence = { timestamp: new Date().toISOString(), node: process.version, cpu: cpus()[0].model, options: values,
  bundleSha256: createHash('sha256').update(readFileSync(resolve(sheet, 'dist/freesheet.full.min.js'))).digest('hex'), results: [] };
const save = () => { mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`); };
const { chromium } = createRequire(resolve(sheet, 'package.json'))('playwright');
const server = await startServer(sheet, { '/mappers.html': '<link rel="stylesheet" href="/dist/freesheet.full.min.css"><script src="/dist/freesheet.full.min.js"></script><div id="grid"></div>' });
let browser;
try {
  browser = await chromium.launch();
  evidence.browser = browser.version();
  if (values.memory) {
    for (const size of rows) {
      const page = await browser.newPage({ viewport: { width: 1200, height: 1000 }, deviceScaleFactor: 1 });
      const watchdog = setTimeout(() => { page.close().catch(() => {}); }, 120000);
      try {
        const cdp = await page.context().newCDPSession(page);
        const heap = async () => {
          await cdp.send('HeapProfiler.collectGarbage');
          return (await cdp.send('Runtime.getHeapUsage')).usedSize;
        };
        await page.goto(`${server.url}/mappers.html`);
        const empty = await heap();
        await page.evaluate((size) => {
          window.mapperData = Array.from({ length: size }, (_, row) => [row, row % 10]);
        }, size);
        const data = await heap();
        await page.evaluate((size) => {
          window.mapperGrid = new window.FreeSheet(document.getElementById('grid'), {
            data: window.mapperData, width: 1000, height: 600, rowHeights: 23, colWidths: 80,
            autoRowSize: false, autoColumnSize: false, manualRowMove: true,
          });
          window.mapperGrid.getPlugin('manualRowMove').rowsMapper._arrayMap = Array.from({ length: size }, (_, index) => size - 1 - index);
        }, size);
        const initialized = await heap();
        const lookup = async () => page.evaluate((size) => {
          let sum = 0;
          for (let index = 0; index < 10000; index++) sum += window.mapperGrid.toVisualRow((index * 7919) % size);
          return sum;
        }, size);
        await lookup();
        const indexed = await heap();
        for (let repeat = 0; repeat < 10; repeat++) await lookup();
        const repeated = await heap();
        await page.evaluate(() => { window.mapperGrid.destroy(); window.mapperGrid = null; window.mapperData = null; });
        const destroyed = await heap();
        evidence.results.push({ rows: size, heapBytes: { empty, data, initialized, indexed, repeated, destroyed } });
      } finally { clearTimeout(watchdog); await page.close(); }
    }
  } else {
    for (const size of rows) {
      for (const amount of amounts.filter(value => value <= size)) {
        for (let trial = -warmup; trial < trials; trial++) {
          const page = await browser.newPage({ viewport: { width: 1200, height: 1000 }, deviceScaleFactor: 1 });
          const watchdog = setTimeout(() => { page.close().catch(() => {}); }, 120000);
          try {
            await page.goto(`${server.url}/mappers.html`);
            const samples = await page.evaluate(({ size, amount, gridOnly }) => {
              const assert = (condition, message) => { if (!condition) throw new Error(message); };
              const data = Array.from({ length: size }, (_, row) => [row, row % 10]);
              const grid = new window.FreeSheet(document.getElementById('grid'), {
                data, width: 1000, height: 600, rowHeights: 23, colWidths: 80,
                autoRowSize: false, autoColumnSize: false, manualRowMove: true,
              });
              const mapper = grid.getPlugin('manualRowMove').rowsMapper;
              const samples = {};
              const time = (name, operation) => {
                const start = performance.now();
                const result = operation();
                samples[name] = performance.now() - start;
                return result;
              };
              if (gridOnly) {
                const row = Math.floor((size - amount) / 2);
                time('gridRemoveRows', () => grid.alter('remove_row', row, amount));
                assert(grid.countRows() === size - amount && mapper._arrayMap.length === size - amount, 'grid removal');
                const remaining = grid.getSourceData();

                assert(row === 0 || remaining[row - 1][0] === row - 1, 'row before removal');
                assert(row === remaining.length || remaining[row][0] === row + amount, 'row after removal');
                grid.destroy();
                return samples;
              }
              const original = Array.from({ length: size }, (_, index) => size - 1 - index);
              const position = Math.floor(size / 2);
              const indexes = Array.from({ length: amount }, (_, index) => index);
              for (const method of ['insertItems', 'removeItems', 'unshiftItems', 'shiftItems']) {
                mapper._arrayMap = original.slice();
                const removalIndexes = indexes.slice();
                time(method, () => method === 'removeItems' || method === 'unshiftItems' ? mapper[method](removalIndexes) : mapper[method](position, amount));
                assert(mapper._arrayMap.length === size + (method === 'insertItems' || method === 'shiftItems' ? amount : -amount), `${method} length`);
                if (method === 'removeItems') assert(mapper._arrayMap[0] === size - 1 - amount, 'remove order');
                if (method === 'unshiftItems') assert(mapper._arrayMap[0] === size - 1 - amount, 'unshift order');
                if (method === 'insertItems') assert(mapper._arrayMap[position] === size, 'insert value');
                if (method === 'shiftItems') assert(mapper._arrayMap[position] === position, 'shift value');
              }
              mapper._arrayMap = original.slice();
              const queries = Array.from({ length: 10000 }, (_, index) => (index * 7919) % size);
              let sum = 0;
              time('lookupFirstBatch', () => { for (const query of queries) sum += grid.toVisualRow(query); });
              time('lookupWarmBatch', () => { for (const query of queries) sum += grid.toVisualRow(query); });
              assert(sum === queries.reduce((total, query) => total + size - 1 - query, 0) * 2, 'lookup result');
              grid.getPlugin('manualRowMove').moveRow(0, size - 1);
              assert(grid.toVisualRow(size - 1) === size - 2, 'lookup after move');
              grid.destroy();
              return samples;
            }, { size, amount, gridOnly: values['grid-only'] });
            if (trial >= 0) {
              evidence.results.push({ rows: size, amount, trial, samples });
              console.log(JSON.stringify({ rows: size, amount, trial, ...samples }));
              save();
            }
          } finally { clearTimeout(watchdog); await page.close(); }
        }
      }
    }
  }
  evidence.complete = true;
} finally {
  save();
  await browser?.close();
  await server.close();
}
