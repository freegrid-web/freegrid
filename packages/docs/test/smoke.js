// Smoke test for the built docs site: every example page renders its live grid without console errors.
// Usage: pnpm build (FreeGrid) && pnpm --filter @freegrid/docs build && node test/smoke.js
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = '/freegrid/';
const dist = fileURLToPath(new URL('../.vitepress/dist', import.meta.url));
const PAGES = [
  { path: '', grids: 1 },
  { path: 'guide/getting-started.html', grids: 1 },
  { path: 'examples/basics.html', grids: 1 },
  { path: 'examples/cell-types.html', grids: 1 },
  { path: 'examples/merged-cells-and-comments.html', grids: 1 },
  { path: 'examples/large-data.html', grids: 1 },
  { path: 'examples/search-and-languages.html', grids: 1 },
];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' };

if (!existsSync(dist)) {
  console.error('Docs are not built: run `pnpm --filter @freegrid/docs build` first.');
  process.exit(1);
}

// Serves the built site under BASE, like GitHub Pages (including `/x` → `/x.html`).
const server = createServer(async(req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);

  if (!path.startsWith(BASE)) {
    res.writeHead(404).end();
    return;
  }
  path = path.slice(BASE.length) || 'index.html';
  if (path.endsWith('/')) path += 'index.html';
  let file = normalize(join(dist, path));

  if (!existsSync(file) && existsSync(`${file}.html`)) file = `${file}.html`;
  let body;

  try {
    body = await readFile(file);
  } catch {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' }).end(body);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const failures = [];

for (const { path, grids } of PAGES) {
  // Dark mode is the harder case: the grid is light-only, so it must not inherit the theme's light text.
  const page = await browser.newPage({ colorScheme: 'dark' });
  const errors = [];

  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  await page.goto(`${origin}${BASE}${path}`);
  if (grids > 0) {
    await page.waitForSelector('.live-example .handsontable .htCore', { timeout: 10000 }).catch(() => {});
  }
  const rendered = await page.locator('.live-example').evaluateAll(els => els.filter(el => el.querySelector('.htCore')).length);
  // The docs theme must not restyle the grid: tables keep `display: table`, rows keep FreeGrid's height and
  // the grid's viewport shows more than a sliver.
  const layoutProblems = await page.locator('.live-example').evaluateAll(els => els.flatMap((el) => {
    const table = el.querySelector('.ht_master table.htCore');
    const cell = el.querySelector('.ht_master td');
    const holder = el.querySelector('.ht_master .wtHolder');

    if (!table || !cell || !holder) return [];
    const problems = [];

    if (getComputedStyle(table).display !== 'table') problems.push(`table display is ${getComputedStyle(table).display}`);
    if (cell.getBoundingClientRect().height > 30) problems.push(`row height is ${cell.getBoundingClientRect().height}px`);
    if (holder.getBoundingClientRect().height < 80) problems.push(`grid viewport is ${holder.getBoundingClientRect().height}px tall`);
    const [r, g, b] = getComputedStyle(cell).color.match(/\d+/g).map(Number);

    if (r + g + b > 300) problems.push(`cell text color ${getComputedStyle(cell).color} is too light for the white grid`);
    if (holder.getBoundingClientRect().right > el.getBoundingClientRect().right + 1) problems.push('grid viewport overflows its frame');
    return problems;
  }));

  if (rendered < grids) failures.push(`${path || '/'}: expected ${grids} live grid(s), found ${rendered}`);
  layoutProblems.forEach(p => failures.push(`${path || '/'}: ${p}`));
  errors.forEach(e => failures.push(`${path || '/'}: ${e}`));
  console.log(`${failures.length ? '…' : '✓'} ${path || '/'} (${rendered} grid(s))`);
  await page.close();
}

await browser.close();
server.close();
if (failures.length) {
  console.log(`\nFAILED:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log('\nDocs smoke test passed.');
