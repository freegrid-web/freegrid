import assert from 'node:assert/strict';
import test from 'node:test';
import { configuration, distribution } from './common.mjs';

test('configuration rejects empty, fractional, zero, unsafe and unknown inputs', () => {
  for (const args of [['--rows', ''], ['--rows', '0'], ['--trials', '1.5'], ['--iterations', '-1'],
    ['--rows', '9007199254740992'], ['--scenario', 'other'], ['--unknown']]) {
    assert.throws(() => configuration('browser', args));
  }
});

test('configuration keeps row order, deduplicates sizes and permits no warmup', () => {
  const config = configuration('micro', ['--rows', '10000,100,10000', '--warmup', '0']);
  assert.deepEqual(config.rows, [10000, 100]);
  assert.equal(config.warmup, 0);
});

test('profiling requires a single diagnostic browser case without warmup', () => {
  assert.throws(() => configuration('browser', ['--profile']));
  assert.throws(() => configuration('micro', ['--profile', '--rows', '100', '--trials', '1', '--warmup', '0', '--scenario', 'membership']));
  assert.equal(configuration('browser', ['--profile', '--rows', '100', '--trials', '1', '--warmup', '0', '--scenario', 'grid']).profile, true);
});

test('summaries preserve samples and calculate even and odd medians', () => {
  const samples = [9, 1, 5, 3];
  assert.deepEqual(distribution(samples), { count: 4, median: 4, p95: 9, max: 9 });
  assert.deepEqual(samples, [9, 1, 5, 3]);
  assert.equal(distribution([1, 2, 3]).median, 2);
  assert.equal(distribution([]), null);
});
