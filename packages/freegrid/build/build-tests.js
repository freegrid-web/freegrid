// Usage: node build/build-tests.js <e2e|walkontable|selftest>
import { build } from 'vite';
import { fileURLToPath } from 'node:url';
import { defineConstants } from './constants.js';
import { commonjsOptions, ignorePikadayCss, windowModule } from './plugins.js';

const r = p => fileURLToPath(new URL(`../${p}`, import.meta.url));
const suite = process.argv[2];

const ENTRIES = {
  e2e: { helpers: 'test/helpers/index.js', specs: 'test/e2e/index.js', out: 'test/dist' },
  walkontable: { helpers: 'src/3rdparty/walkontable/test/helpers/index.js', specs: 'src/3rdparty/walkontable/test/spec/index.js', out: 'src/3rdparty/walkontable/test/dist' },
  selftest: { helpers: null, specs: 'test/runner/selftest/order.spec.js', out: 'test/dist/selftest' },
};
const cfg = ENTRIES[suite];

if (!cfg) throw new Error(`Unknown suite "${suite}"`);

async function bundle(entry, name) {
  await build({
    configFile: false,
    logLevel: 'warn',
    define: defineConstants(),
    plugins: [windowModule(), ignorePikadayCss()],
    resolve: { alias: [{ find: /^handsontable(.*)$/, replacement: `${r('src')}$1` }] },
    build: {
      target: 'es2020', commonjsOptions, outDir: r(cfg.out), emptyOutDir: false, minify: false, sourcemap: 'inline',
      lib: { entry: r(entry), name: `fg_${name}`, formats: ['iife'], fileName: () => `${name}.entry.js` },
    },
  });
}

if (cfg.helpers) await bundle(cfg.helpers, 'helpers');
await bundle(cfg.specs, 'specs');
