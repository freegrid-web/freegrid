/* Usage: node run-puppeteer-json.js <html path relative to /hot> <out.json> */
const puppeteer = require('puppeteer');
const http = require('http');
const ecstatic = require('ecstatic');
const fs = require('fs');

const [, , htmlPath, outFile] = process.argv;
const PORT = 7992;
const results = [];

(async() => {
  const browser = await puppeteer.launch({
    timeout: 10000,
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--headless', '--disable-gpu', '--mute-audio'],
  });
  const page = await browser.newPage();
  page.setCacheEnabled(false);
  page.setViewport({ width: 1200, height: 1000 });

  const server = http.createServer(ecstatic({ root: '/hot', showDir: true, autoIndex: true }));
  server.listen(PORT);

  const finish = async(code) => {
    fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
    await browser.close();
    server.close();
    process.exit(code);
  };

  await page.exposeFunction('jasmineStarted', () => {});
  await page.exposeFunction('jasmineSpecStarted', () => {});
  await page.exposeFunction('jasmineSuiteStarted', () => {});
  await page.exposeFunction('jasmineSuiteDone', () => {});
  await page.exposeFunction('jasmineSpecDone', (r) => {
    results.push({ fullName: r.fullName, status: r.status });
    process.stdout.write(r.status === 'failed' ? 'F' : '.');
  });
  await page.exposeFunction('jasmineDone', () => finish(0));
  page.on('pageerror', (msg) => { console.log('\npageerror:', msg); finish(1); });

  await page.goto(`http://localhost:${PORT}/${htmlPath}`);
})();
