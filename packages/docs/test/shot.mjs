import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { chromium } from 'playwright';
const dist = new URL('../.vitepress/dist', import.meta.url).pathname;
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/sheet\//, '');
  let f = join(dist, p || 'index.html'); if (!existsSync(f) && existsSync(f + '.html')) f += '.html';
  try { res.writeHead(200, { 'content-type': T[extname(f)] || 'application/octet-stream' }).end(await readFile(f)); } catch { res.writeHead(404).end(); }
}).listen(4999);
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1400, height: 1000 } });
await page.goto('http://127.0.0.1:4999/sheet/' + process.argv[2]);
await page.waitForTimeout(1500);
const sel = process.argv[3];
if (sel) await page.locator(sel).first().screenshot({ path: 'test/shot.png' }); else await page.screenshot({ path: 'test/shot.png' });
await b.close(); server.close();
