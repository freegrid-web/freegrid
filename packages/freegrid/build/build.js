import { build } from 'vite';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { browserTarget, defineConstants, banner } from './constants.js';
import { commonjsOptions, ignorePikadayCss, localeRegistration } from './plugins.js';
import { legacyClassNames } from './legacyClassNames.js';

const r = p => fileURLToPath(new URL(`../${p}`, import.meta.url));
const buildDate = new Date();
const define = defineConstants({ buildDate });
const deps = ['moment', 'numbro', 'pikaday'];
// Pikaday's CSS is not a dependency to keep external: ignorePikadayCss() drops it (upstream used an
// empty module), and an external CSS import would break Node/SSR and AMD/CommonJS consumers.
const isDep = id => !id.startsWith('pikaday/css') && deps.some(d => id === d || id.startsWith(`${d}/`));

const base = { configFile: false, logLevel: 'warn', define, css: { postcss: { plugins: [legacyClassNames()] } } };

async function esm() {
  await build({
    ...base,
    plugins: [ignorePikadayCss()],
    build: {
      target: browserTarget, cssTarget: browserTarget, commonjsOptions, outDir: r('dist/esm'), emptyOutDir: false, minify: false, sourcemap: true,
      lib: { entry: { index: r('src/index.js'), compat: r('src/compat.js') }, formats: ['es'], cssFileName: 'freegrid' },
      rollupOptions: { external: isDep, output: { banner: banner(buildDate) } },
    },
  });
}

async function umd({ full, minify }) {
  const name = `freegrid${full ? '.full' : ''}${minify ? '.min' : ''}`;

  await build({
    ...base,
    plugins: full ? [] : [ignorePikadayCss()],
    build: {
      target: browserTarget, cssTarget: browserTarget, commonjsOptions, outDir: r('dist'), emptyOutDir: false, minify: minify ? 'esbuild' : false,
      cssMinify: minify, sourcemap: true,
      lib: { entry: full ? r('build/full-entry.js') : r('src/index.js'), name: 'FreeGrid', formats: ['umd'], fileName: () => `${name}.js`, cssFileName: name },
      rollupOptions: {
        external: full ? [] : isDep,
        output: { exports: 'default', banner: banner(buildDate), globals: { moment: 'moment', numbro: 'numbro', pikaday: 'Pikaday' } },
      },
    },
  });
}

async function locales({ minify }) {
  const dir = r('src/i18n/languages');
  const files = readdirSync(dir).filter(f => f.endsWith('.js'));
  // Vite resolves lib entries as file paths, so each locale gets a tiny side-effect-only entry file.
  const entryDir = mkdtempSync(join(tmpdir(), 'freegrid-locales-'));

  try {
    for (const file of files) {
      const code = file === 'index.js' ? 'all' : file.replace(/\.js$/, '');
      const entry = join(entryDir, `${code}.js`);
      const imports = file === 'index.js'
        ? files.filter(f => f !== 'index.js').map(f => `import '${dir}/${f}';`).join('\n')
        : `import '${dir}/${file}';`;

      writeFileSync(entry, `${imports}\n`);
      await build({
        ...base,
        plugins: [localeRegistration()],
        build: {
          target: browserTarget, cssTarget: browserTarget, commonjsOptions, outDir: r('dist/languages'), emptyOutDir: false, minify: minify ? 'esbuild' : false,
          lib: { entry, name: 'FreeGridLanguage', formats: ['umd'], fileName: () => `${code}${minify ? '.min' : ''}.js` },
          rollupOptions: { external: ['@freegrid/core'], output: { globals: { '@freegrid/core': 'FreeGrid' } } },
        },
      });
    }
  } finally {
    rmSync(entryDir, { recursive: true, force: true });
  }
}

/** ESM locale modules for bundlers: `import '@freegrid/core/languages/de-DE'` registers on the imported FreeGrid. */
async function esmLocales() {
  const dir = r('src/i18n/languages');
  const files = readdirSync(dir).filter(f => /^[a-z]{2}-[A-Z]{2}\.js$/.test(f));
  const entryDir = mkdtempSync(join(tmpdir(), 'freegrid-esm-locales-'));
  const allEntry = join(entryDir, 'all.js');

  writeFileSync(allEntry, `${files.map(f => `import './${f}';`).join('\n')}\n`);
  try {
    await build({
      ...base,
      plugins: [localeRegistration(), {
        name: 'fg-esm-locale-all',
        resolveId: (id, importer) => (importer === allEntry && id.startsWith('./') ? join(dir, id) : null),
      }],
      build: {
        target: browserTarget, cssTarget: browserTarget, commonjsOptions, outDir: r('dist/esm/languages'), emptyOutDir: false, minify: false,
        lib: {
          entry: Object.fromEntries([['all', allEntry], ...files.map(f => [f.replace(/\.js$/, ''), join(dir, f)])]),
          formats: ['es'],
        },
        rollupOptions: { external: ['@freegrid/core'], output: { chunkFileNames: '[name].js' } },
      },
    });
  } finally {
    rmSync(entryDir, { recursive: true, force: true });
  }
}

/** Test-only bundle used by the walkontable browser suite (global `Walkontable`). */
async function walkontable() {
  await build({
    ...base,
    build: {
      target: browserTarget, cssTarget: browserTarget, commonjsOptions, outDir: r('src/3rdparty/walkontable/dist'), emptyOutDir: true, minify: false, sourcemap: true,
      lib: { entry: r('src/3rdparty/walkontable/src/index.js'), name: 'Walkontable', formats: ['iife'], fileName: () => 'walkontable.js' },
      rollupOptions: { output: { exports: 'named' } },
    },
  });
}

rmSync(r('dist'), { recursive: true, force: true });
mkdirSync(r('dist'), { recursive: true });
await esm();
for (const full of [false, true]) for (const minify of [false, true]) await umd({ full, minify });
await locales({ minify: false });
await locales({ minify: true });
await esmLocales();
await walkontable();
copyFileSync(r('build/compat-global.js'), r('dist/compat.js'));
console.log('FreeGrid build complete.');
