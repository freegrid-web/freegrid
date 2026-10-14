import { chromium, firefox, webkit } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { startServer } from './server.js';
import { runnerHtml } from './page.js';

const root = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '');
const { values: o } = parseArgs({
  options: {
    suite: { type: 'string' },
    build: { type: 'string', default: 'dev' },
    browser: { type: 'string', default: 'chromium' },
    grep: { type: 'string' },
    json: { type: 'string' },
  },
});
const out = o.json || `${root}/test-results/${o.suite}-${o.build}-${o.browser}.json`;
const HARD_TIMEOUT_MS = 45 * 60 * 1000;

const results = [];
const server = await startServer(root, { '/__runner.html': runnerHtml(o.suite, o.build) });
// Upstream kept scrollbars visible in headless Chrome; many layout specs depend on their width.
// Modern Chromium dispatches scroll events in the next rendering step; without the 60fps frame cap
// that step comes within the few milliseconds upstream specs wait after scrolling.
const launchOptions = o.browser === 'chromium'
  ? { ignoreDefaultArgs: ['--hide-scrollbars'], args: ['--disable-frame-rate-limit', '--disable-gpu-vsync'] }
  : {};
const browser = await { chromium, firefox, webkit }[o.browser].launch(launchOptions);
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });

let finished = false;

async function finish(code, reason) {
  if (finished) return;
  finished = true;
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(results, null, 2));
  const failed = results.filter(r => r.status === 'failed');

  console.log(`\n${results.length} specs, ${failed.length} failed, ${results.filter(r => r.status === 'pending').length} pending${reason ? ` (${reason})` : ''}`);
  failed.forEach(f => console.log(`\n✗ ${f.fullName}\n  ${f.failedExpectations.map(e => e.message).join('\n  ')}`));
  await browser.close();
  await server.close();
  process.exit(code || (failed.length ? 1 : 0));
}

await page.exposeFunction('jasmineStarted', () => {});
await page.exposeFunction('jasmineSpecStarted', () => {});
await page.exposeFunction('jasmineSuiteStarted', () => {});
await page.exposeFunction('jasmineSuiteDone', () => {});
await page.exposeFunction('jasmineSpecDone', (r) => {
  const status = r.status === 'excluded' ? 'pending' : r.status;

  results.push({ fullName: r.fullName, status, failedExpectations: (r.failedExpectations || []).map(e => ({ message: e.message })) });
  process.stdout.write(status === 'failed' ? 'F' : status === 'pending' ? '*' : '.');
});
await page.exposeFunction('jasmineDone', () => finish(0));
page.on('pageerror', err => finish(1, `pageerror: ${err.message}`));
setTimeout(() => finish(1, 'hard timeout'), HARD_TIMEOUT_MS).unref();

const query = o.grep ? `?spec=${encodeURIComponent(o.grep)}` : '';

try {
  await page.goto(`${server.url}/__runner.html${query}`);
} catch (err) {
  if (!finished) await finish(1, `navigation failed: ${err.message}`);
}
