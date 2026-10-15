// Production-browser paste measurements. Uses Node built-ins and the existing Playwright dependency.
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import { cpus } from 'node:os';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../../packages/sheet/test/runner/server.js';

const root = fileURLToPath(new URL('../..', import.meta.url));
const sheet = resolve(root, 'packages/sheet');
const { values } = parseArgs({ options: {
  rows: { type: 'string', default: '100,2000' }, columns: { type: 'string', default: '20' },
  shapes: { type: 'string', default: 'array,object,nested' }, methods: { type: 'string', default: 'populate,clipboard' },
  trials: { type: 'string', default: '15' }, warmup: { type: 'string', default: '3' },
  profile: { type: 'boolean', default: false }, counts: { type: 'boolean', default: false }, revision: { type: 'string' },
  'baseline-bundle': { type: 'string' },
  output: { type: 'string', default: 'tools/performance/results/paste.json' },
} });
const integer = (value, min = 1) => {
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < min) throw new Error(`Invalid integer: ${value}`);
  return Number(value);
};
const rows = values.rows.split(',').map(value => integer(value));
const columns = integer(values.columns);
const shapes = values.shapes.split(',');
const methods = values.methods.split(',');
if (shapes.some(shape => !['array', 'object', 'nested'].includes(shape)) || methods.some(method => !['populate', 'clipboard'].includes(method))) throw new Error('Invalid shape or method');
if (values.profile && values.counts) throw new Error('Run profiling and call counting separately');
const instrumented = values.profile || values.counts;
const trials = instrumented ? 1 : integer(values.trials);
const warmup = instrumented ? 0 : integer(values.warmup, 0);
const output = resolve(root, values.output);
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const evidence = { timestamp: new Date().toISOString(), node: process.version, cpu: cpus()[0].model, options: values,
  bundleSha256: hash(resolve(sheet, 'dist/freesheet.full.min.js')), runnerSha256: hash(fileURLToPath(import.meta.url)), results: [] };
const baseline = values['baseline-bundle'] && resolve(root, values['baseline-bundle']);
const baselineRelative = baseline && relative(root, baseline);
if (baselineRelative && (baselineRelative.startsWith('../') || isAbsolute(baselineRelative))) throw new Error('Baseline bundle must be inside the repository');
if (baseline) evidence.baselineBundleSha256 = hash(baseline);
const save = () => { mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`); };
const { chromium } = createRequire(resolve(sheet, 'package.json'))('playwright');
const html = script => `<link rel="stylesheet" href="/dist/freesheet.full.min.css"><script src="${script}"></script><div id="grid"></div>`;
const server = await startServer(root, { '/paste.html': html('/packages/sheet/dist/freesheet.full.min.js'),
  ...(baseline ? { '/baseline.html': html(`/${baselineRelative.split('/').map(encodeURIComponent).join('/')}`) } : {}),
});
let browser;
try {
  browser = await chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'] });
  evidence.browser = browser.version();
  for (const rowCount of rows) for (const shape of shapes) for (const method of methods) {
    for (let trial = -warmup; trial < trials; trial++) {
      // Alternate AB/BA within each pair to reduce drift from machine load and CPU frequency.
      const variants = baseline ? (trial % 2 === 0 ? ['baseline', 'candidate'] : ['candidate', 'baseline']) : ['candidate'];
      for (const variant of variants) {
        const page = await browser.newPage({ viewport: { width: 1200, height: 1000 }, deviceScaleFactor: 1 });
        const watchdog = setTimeout(() => { page.close().catch(() => {}); }, 120000);
        try {
          await page.goto(`${server.url}/${variant === 'baseline' ? 'baseline' : 'paste'}.html`);
          const dimensions = await page.evaluate(({ rowCount, columns, shape }) => {
            const data = Array.from({ length: rowCount }, (_, row) => {
              const values = Array.from({ length: columns }, (_, col) => `old${row}:${col}`);
              const fields = () => Object.fromEntries(values.map((value, col) => [`field${col}`, value]));

              return shape === 'array' ? values : shape === 'object' ? fields() : { group: { branch: { leaf: fields() } } };
            });
            window.pasteInput = Array.from({ length: rowCount === 100 ? 10 : rowCount }, (_, row) =>
              Array.from({ length: rowCount === 100 ? Math.min(10, columns) : columns }, (_, col) => `new${row}:${col}`));
            window.pasteText = window.pasteInput.map(row => row.join('\t')).join('\n');
            window.pasteGrid = new window.FreeSheet(document.getElementById('grid'), {
              data, width: 1000, height: 600, rowHeights: 23, colWidths: 80, colHeaders: false,
              autoRowSize: false, autoColumnSize: false,
              columns: Array.from({ length: columns }, (_, col) => ({ data: shape === 'array' ? col : shape === 'object' ? `field${col}` : `group.branch.leaf.field${col}`, type: 'text' })),
            });
            window.pasteGrid.selectCell(0, 0);
            window.pasteGrid.listen();
            return { pasteRows: window.pasteInput.length, pasteColumns: window.pasteInput[0].length };
          }, { rowCount, columns, shape });
          await page.waitForTimeout(600);
          if (values.counts) await page.evaluate(() => {
            window.pasteCounts = {};
            const grid = window.pasteGrid;
            const original = grid.runHooks;

            grid.runHooks = function(name, ...args) {
              window.pasteCounts[name] = (window.pasteCounts[name] || 0) + 1;
              return original.call(this, name, ...args);
            };
          });
          const cdp = await page.context().newCDPSession(page);
          if (values.profile) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.start'); }
          const result = await page.evaluate(async method => {
            const grid = window.pasteGrid;
            let actualChanges;
            let actualSource;
            const changed = new Promise(done => grid.addHookOnce('afterChange', (changes, source) => {
              actualChanges = changes.length;
              actualSource = source;
              done();
            }));
            const start = performance.now();
            if (method === 'populate') grid.populateFromArray(0, 0, window.pasteInput);
            else grid.getPlugin('copyPaste').paste(window.pasteText, '');
            const synchronousMs = performance.now() - start;
            await changed;
            const settledMs = performance.now() - start;
            return { synchronousMs, settledMs, actualChanges, actualSource, counts: window.pasteCounts };
          }, method);
          if (values.profile) {
            const { profile } = await cdp.send('Profiler.stop');
            const path = output.replace(/\.json$/, '') + `-${variant}-${rowCount}-${shape}-${method}.cpuprofile`;
            mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, JSON.stringify(profile));
            result.profilePath = path;
          }
          if (instrumented) { delete result.synchronousMs; delete result.settledMs; }
          const verified = await page.evaluate(() => {
            for (let row = 0; row < window.pasteInput.length; row++) for (let col = 0; col < window.pasteInput[row].length; col++) {
              if (window.pasteGrid.getDataAtCell(row, col) !== window.pasteInput[row][col]) return false;
            }
            return true;
          });
          if (!verified || result.actualChanges !== dimensions.pasteRows * dimensions.pasteColumns ||
              result.actualSource !== (method === 'populate' ? 'populateFromArray' : 'CopyPaste.paste')) throw new Error('Paste result/source/count mismatch');
          await page.evaluate(() => { window.pasteGrid.destroy(); window.pasteGrid = null; window.pasteInput = null; window.pasteText = null; });
          if (trial >= 0) {
            evidence.results.push({ variant, rows: rowCount, columns, shape, method, trial, ...dimensions, ...result });
            save();
            console.log(JSON.stringify({ variant, rows: rowCount, shape, method, trial, ...result }));
          }
        } finally { clearTimeout(watchdog); await page.close(); }
      }
    }
  }
  evidence.complete = true;
} finally { save(); await browser?.close(); await server.close(); }
