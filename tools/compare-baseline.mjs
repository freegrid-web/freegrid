// Usage: node tools/compare-baseline.mjs <unit|e2e|walkontable|production> <results.json>
// Exits 1 when a test that passed in the upstream baseline does not pass now (and is not FG-SKIP'd).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { toMap, entriesOf } from './baseline/results-map.mjs';

const [suite, file] = process.argv.slice(2);
const baseline = JSON.parse(readFileSync(new URL('../docs/baseline/6.2.2-results.json', import.meta.url), 'utf8')).suites[suite];
const now = toMap(entriesOf(JSON.parse(readFileSync(file, 'utf8'))));

if (!baseline) {
  console.log(`No baseline for "${suite}" — every non-passing test needs an issue.`);
}

// Count FG-SKIP markers in FreeGrid sources (no git needed, so it also works inside containers).
function countSkips(dir) {
  return readdirSync(dir, { withFileTypes: true }).reduce((n, e) => {
    if (e.isDirectory()) return ['node_modules', 'dist', 'test-results', 'lib'].includes(e.name) ? n : n + countSkips(join(dir, e.name));
    return e.name.endsWith('.js') ? n + (readFileSync(join(dir, e.name), 'utf8').match(/\/\/ FG-SKIP:/g) || []).length : n;
  }, 0);
}
const pkgDir = fileURLToPath(new URL('../packages/freegrid', import.meta.url));
const skipCount = countSkips(join(pkgDir, 'src')) + countSkips(join(pkgDir, 'test'));
const regressions = [];
const skippedNow = [];
const newlyPassing = [];

for (const [name, status] of Object.entries(baseline || now)) {
  const current = now[name];

  if ((baseline ? status === 'passed' : true) && current !== 'passed') {
    const line = `${name}  [baseline: ${baseline ? status : 'n/a'}, now: ${current ?? 'missing'}]`;

    (current === 'pending' ? skippedNow : regressions).push(line);
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
console.log(`FG-SKIP markers in repo: ${skipCount}; baseline-passing tests now pending: ${skippedNow.length}`);
if (newlyPassing.length) console.log(`Newly passing (${newlyPassing.length}):\n  ${newlyPassing.join('\n  ')}`);
if (regressions.length) {
  console.log(`REGRESSIONS (${regressions.length}):\n  ${regressions.join('\n  ')}`);
  process.exit(1);
}
console.log('No regressions.');
