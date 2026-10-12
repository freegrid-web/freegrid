// Usage: node tools/check-known-failures.mjs <firefox|webkit> <results.json>
// Fails when a spec fails that is not listed for that browser in
// packages/freegrid/test/runner/known-failures.json. Listed specs that now pass are reported so the
// list can shrink.
import { readFileSync } from 'node:fs';
import { toMap, entriesOf } from './baseline/results-map.mjs';

const [browser, file] = process.argv.slice(2);
const known = JSON.parse(readFileSync(new URL('../packages/freegrid/test/runner/known-failures.json', import.meta.url), 'utf8'))[browser];

if (!known) {
  console.error(`No known-failures entry for "${browser}".`);
  process.exit(1);
}
const now = toMap(entriesOf(JSON.parse(readFileSync(file, 'utf8'))));
const failed = Object.keys(now).filter(name => now[name] === 'failed');
const unexpected = failed.filter(name => !known[name]);
const fixed = Object.keys(known).filter(name => now[name] === 'passed');
const missing = Object.keys(known).filter(name => !(name in now));

console.log(`${browser}: ${Object.keys(now).length} specs, ${failed.length} failed, ${Object.keys(known).length} known failures`);
if (fixed.length) console.log(`Known failures that now pass — remove them from known-failures.json:\n  ${fixed.join('\n  ')}`);
if (missing.length) console.log(`Known failures not found in this run (renamed or removed?):\n  ${missing.join('\n  ')}`);
if (unexpected.length) {
  console.log(`UNEXPECTED FAILURES (${unexpected.length}):\n  ${unexpected.join('\n  ')}`);
  process.exit(1);
}
console.log('No unexpected failures.');
