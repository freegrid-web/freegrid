// Usage: node tools/compare-baseline.mjs <unit|e2e|walkontable|production> <results.json>
// Exits 1 when a test that passed in the upstream baseline does not pass now (and is not FG-SKIP'd), when a test
// that is not in the baseline fails, or when a test file fails to load.
// Tests removed on purpose, together with the behavior they checked, are listed with a reason in
// docs/baseline/retired.json; a listed test that still runs is an error, so the list stays accurate.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { toMap, entriesOf } from './baseline/results-map.mjs';

const [suite, file] = process.argv.slice(2);
const baseline = JSON.parse(readFileSync(new URL('../docs/baseline/6.2.2-results.json', import.meta.url), 'utf8')).suites[suite];
const raw = JSON.parse(readFileSync(file, 'utf8'));
const now = toMap(entriesOf(raw));
const retired = JSON.parse(readFileSync(new URL('../docs/baseline/retired.json', import.meta.url), 'utf8'))[suite] || {};

if (!baseline) {
  console.log(`No baseline for "${suite}" — every non-passing test needs an issue.`);
}

// Count FG-SKIP markers in FreeGrid sources (no git needed, so it also works inside containers).
function countSkips(dir) {
  return readdirSync(dir, { withFileTypes: true }).reduce((n, e) => {
    if (e.isDirectory()) return ['node_modules', 'dist', 'test-results', 'lib'].includes(e.name) ? n : n + countSkips(join(dir, e.name));
    return /\.(js|ts)$/.test(e.name) ? n + (readFileSync(join(dir, e.name), 'utf8').match(/\/\/ FG-SKIP:/g) || []).length : n;
  }, 0);
}
const pkgDir = fileURLToPath(new URL('../packages/freegrid', import.meta.url));
const skipCount = countSkips(join(pkgDir, 'src')) + countSkips(join(pkgDir, 'test'));
const regressions = [];
const skippedNow = [];
const newlyPassing = [];

for (const name of Object.keys(retired)) {
  if (name in now) regressions.push(`${name}  (listed in docs/baseline/retired.json but still runs)`);
}

for (const [name, status] of Object.entries(baseline || now)) {
  const current = now[name];

  if (current === undefined && name in retired) continue;

  if ((baseline ? status === 'passed' : true) && current !== 'passed') {
    const line = `${name}  [baseline: ${baseline ? status : 'n/a'}, now: ${current ?? 'missing'}]`;

    (current === 'pending' ? skippedNow : regressions).push(line);
  }
}
// Tests newer than the baseline must pass too (the runner's exit code is not checked).
if (baseline) {
  for (const [name, status] of Object.entries(now)) {
    if (!(name in baseline) && status === 'failed') regressions.push(`${name}  [not in baseline, now: failed]`);
  }
}
// A test file that fails to load (Vitest) has no test results at all.
for (const { name, status, message, assertionResults } of Array.isArray(raw) ? [] : raw.testResults) {
  if (status === 'failed' && !assertionResults.some(a => a.status === 'failed')) {
    regressions.push(`${name}  (test file failed: ${(message || '').split('\n')[0]})`);
  }
}
// A baseline-passing test may only become pending through an FG-SKIP marker.
if (skippedNow.length > skipCount) regressions.push(...skippedNow.map(l => `${l}  (pending without enough FG-SKIP markers)`));

if (baseline) {
  for (const [name, status] of Object.entries(now)) {
    if (status === 'passed' && baseline[name] && baseline[name] !== 'passed') newlyPassing.push(name);
  }
}

console.log(`${suite}: ${Object.keys(now).length} now, ${baseline ? Object.keys(baseline).length : 0} in baseline`);
console.log(`FG-SKIP markers in repo: ${skipCount}; baseline-passing tests now pending: ${skippedNow.length}; retired: ${Object.keys(retired).length}`);
if (newlyPassing.length) console.log(`Newly passing (${newlyPassing.length}):\n  ${newlyPassing.join('\n  ')}`);
if (regressions.length) {
  console.log(`REGRESSIONS (${regressions.length}):\n  ${regressions.join('\n  ')}`);
  process.exit(1);
}
console.log('No regressions.');
