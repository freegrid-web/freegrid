// MIT. Shared benchmark configuration and evidence metadata; no benchmark library required.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus, platform, release } from 'node:os';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

export const repository = fileURLToPath(new URL('../..', import.meta.url));
export const sheet = resolve(repository, 'packages/sheet');

export function configuration(kind, args = process.argv.slice(2)) {
  const { values } = parseArgs({ args, options: {
    rows: { type: 'string', default: '100,10000,100000,1000000' },
    trials: { type: 'string', default: '5' },
    warmup: { type: 'string', default: '1' },
    remove: { type: 'string', default: '1,100,1000' },
    columns: { type: 'string', default: '20' },
    iterations: { type: 'string', default: '20' },
    scenario: { type: 'string', default: kind === 'browser' ? 'grid' : 'all' },
    output: { type: 'string', default: resolve(repository, `tools/performance/results/${kind}.json`) },
    profile: { type: 'boolean', default: false },
    revision: { type: 'string' },
  } });
  const integer = (value, name, minimum = 1) => {
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < minimum) {
      throw new Error(`--${name} must be a safe integer >= ${minimum}`);
    }
    return Number(value);
  };
  const list = (value, name) => [...new Set(value.split(',').map(item => integer(item, name)))];
  const config = {
    rows: list(values.rows, 'rows'), remove: list(values.remove, 'remove'),
    trials: integer(values.trials, 'trials'), warmup: integer(values.warmup, 'warmup', 0),
    columns: integer(values.columns, 'columns'), iterations: integer(values.iterations, 'iterations'),
    revision: values.revision, scenario: values.scenario, output: resolve(values.output), profile: values.profile,
  };
  const scenarios = kind === 'browser' ? ['all', 'grid', 'remove-rows', 'auto-columns'] : ['all', 'membership', 'iteration'];
  if (!scenarios.includes(config.scenario)) throw new Error(`--scenario must be one of ${scenarios.join(', ')}`);
  if (config.profile && (kind !== 'browser' || config.rows.length !== 1 || config.trials !== 1 || config.warmup !== 0 || config.scenario === 'all')) {
    throw new Error('--profile requires browser, one row count, --trials 1 --warmup 0 and one scenario');
  }
  return config;
}

export function distribution(samples) {
  if (!samples.length) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return {
    count: sorted.length,
    median: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2,
    p95: sorted[Math.ceil(sorted.length * .95) - 1],
    max: sorted[sorted.length - 1],
  };
}

export function metadata(config, bundles = []) {
  // A Docker worktree mount may not expose its shared .git directory. Bundle hashes remain available.
  const git = (...args) => {
    try { return execFileSync('git', args, { cwd: repository, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
    catch { return null; }
  };
  return {
    timestamp: new Date().toISOString(), commit: config.revision ?? git('rev-parse', 'HEAD'),
    trackedChanges: git('status', '--porcelain', '--untracked-files=no'),
    node: process.version, v8: process.versions.v8, platform: platform(), release: release(),
    cpu: cpus()[0]?.model, logicalCpus: cpus().length, config,
    bundles: bundles.map(path => ({ path, sha256: createHash('sha256').update(readFileSync(resolve(sheet, path))).digest('hex') })),
  };
}

export function save(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}
