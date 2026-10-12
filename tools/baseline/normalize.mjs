// Usage: node tools/baseline/normalize.mjs <dir with raw json> <out file> <source label>
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { toMap, entriesOf } from './results-map.mjs';

const [dir, outFile, source] = process.argv.slice(2);

function read(name) {
  const file = join(dir, `${name}.json`);
  return existsSync(file) ? toMap(entriesOf(JSON.parse(readFileSync(file, 'utf8')))) : null;
}

const typesFile = join(dir, 'types.json');
const out = {
  source,
  generatedAt: new Date().toISOString(),
  suites: {
    unit: read('unit'),
    e2e: read('e2e'),
    walkontable: read('walkontable'),
    production: read('production'),
    types: existsSync(typesFile) ? JSON.parse(readFileSync(typesFile, 'utf8')) : null,
  },
};
writeFileSync(outFile, `${JSON.stringify(out, null, 2)}\n`);
for (const [k, v] of Object.entries(out.suites)) {
  if (v && typeof v === 'object') {
    const c = Object.values(v).reduce((a, s) => ({ ...a, [s]: (a[s] || 0) + 1 }), {});
    console.log(k, c);
  } else console.log(k, v);
}
