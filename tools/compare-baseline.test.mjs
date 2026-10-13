import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const script = new URL('./compare-baseline.mjs', import.meta.url).pathname;
const baseline = JSON.parse(readFileSync(new URL('../docs/baseline/6.2.2-results.json', import.meta.url), 'utf8'))
  .suites.unit;
const retired = JSON.parse(readFileSync(new URL('../docs/baseline/retired.json', import.meta.url), 'utf8')).unit || {};

// A Vitest JSON report in which every baseline test has its baseline status, plus `extraFiles`.
const report = (extraFiles = []) => ({
  testResults: [
    {
      name: 'baseline.unit.js',
      status: 'passed',
      message: '',
      assertionResults: Object.entries(baseline)
        .filter(([fullName]) => !(fullName in retired))
        .map(([fullName, status]) => ({ fullName, status })),
    },
    ...extraFiles,
  ],
});

const compare = (raw) => {
  const file = join(mkdtempSync(join(tmpdir(), 'compare-baseline-')), 'unit.json');

  writeFileSync(file, JSON.stringify(raw));

  return spawnSync(process.execPath, [script, 'unit', file], { encoding: 'utf8' });
};

test('the baseline as it is has no regressions', () => {
  const result = compare(report());

  assert.equal(result.status, 0, result.stdout);
  assert.match(result.stdout, /No regressions/);
});

test('a failing test that is not in the baseline is a regression', () => {
  const result = compare(report([{
    name: 'new.unit.ts',
    status: 'failed',
    message: '',
    assertionResults: [{ fullName: 'a new feature works', status: 'failed' }],
  }]));

  assert.equal(result.status, 1);
  assert.match(result.stdout, /a new feature works/);
});

test('a test file that fails to load is a regression', () => {
  const result = compare(report([{
    name: '/repo/test/unit/broken.unit.ts',
    status: 'failed',
    message: 'Failed to resolve import "./gone"',
    assertionResults: [],
  }]));

  assert.equal(result.status, 1);
  assert.match(result.stdout, /broken\.unit\.ts/);
  assert.match(result.stdout, /Failed to resolve import/);
});
