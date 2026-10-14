// MIT. Synthetic controls support hypotheses; browser scenarios measure the actual production grid.
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { configuration, distribution, metadata, save } from './common.mjs';

const config = configuration('micro');
const evidence = { ...metadata(config), kind: 'synthetic-microbenchmarks', results: [] };
let sink = 0;

function compare(name, parameters, variants) {
  const reference = variants[0].run();
  for (const variant of variants) assert.deepEqual(variant.run(), reference);
  for (let i = 0; i < config.warmup; i++) for (const variant of variants) sink += variant.run().length;
  const samples = Object.fromEntries(variants.map(variant => [variant.name, []]));
  for (let trial = 0; trial < config.trials; trial++) {
    const order = trial % 2 ? [...variants].reverse() : variants;
    for (const variant of order) {
      const start = performance.now();
      const result = variant.run();
      samples[variant.name].push(performance.now() - start);
      sink += result.length;
    }
  }
  const result = { name, ...parameters, samplesMs: samples, summaryMs: Object.fromEntries(Object.entries(samples).map(([key, values]) => [key, distribution(values)])) };
  evidence.results.push(result);
  console.log(JSON.stringify({ name, ...parameters, summaryMs: result.summaryMs }));
}

// Row indexes are integers: Set's NaN equality does not change matching against filter's rowIndex.
function membership(data, removed, useSet) {
  if (useSet) {
    const lookup = new Set(removed);
    return data.filter((_, rowIndex) => !lookup.has(rowIndex));
  }
  return data.filter((_, rowIndex) => removed.indexOf(rowIndex) === -1);
}

if (config.scenario !== 'iteration') {
  const sparse = new Array(4);
  sparse[1] = { id: 1 };
  sparse[3] = { id: 3 };
  for (const removed of [[], [1, 1], [NaN, undefined, '1', -1], [0, 3]]) {
    assert.deepEqual(membership(sparse, removed, false), membership(sparse, removed, true));
  }
  for (const rows of config.rows) {
    const data = Array.from({ length: rows }, (_, index) => index);
    for (const removedCount of config.remove.filter(amount => amount <= rows)) {
      const removed = Array.from({ length: removedCount }, (_, index) => Math.floor(index * rows / removedCount));
      compare('filter-membership', { rows, removedCount }, [
        { name: 'indexOf', run: () => membership(data, removed, false) },
        { name: 'Set', run: () => membership(data, removed, true) },
      ]);
    }
  }
}
if (config.scenario !== 'membership') {
  for (const rows of config.rows) {
    const data = Array.from({ length: rows }, (_, index) => index);
    compare('dense-filter-map', { rows }, [
      { name: 'filter-map', run: () => data.filter(value => value % 2 === 0).map(value => value + 1) },
      { name: 'single-pass', run: () => {
        const result = [];
        for (const value of data) if (value % 2 === 0) result.push(value + 1);
        return result;
      } },
    ]);
    compare('dense-forEach-for', { rows }, [
      { name: 'forEach', run: () => { const result = []; data.forEach(value => result.push(value + 1)); return result; } },
      { name: 'for', run: () => { const result = []; for (let i = 0; i < data.length; i++) result.push(data[i] + 1); return result; } },
    ]);
  }
}
save(config.output, { ...evidence, sink, complete: true });
console.log(`Saved ${config.output}`);
