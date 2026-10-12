import { createRequire } from 'node:module';
import { dirname, relative } from 'node:path';

const require = createRequire(import.meta.url);
const jasmine = require('jasmine-core');

export function runnerHtml(suite, buildKind) {
  // Serve jasmine-core through the package's node_modules link (pnpm stores the real files outside root).
  const pkgDir = dirname(require.resolve('jasmine-core/package.json'));
  const viaLink = abs => `/node_modules/jasmine-core/${relative(pkgDir, abs)}`;
  const jRel = f => viaLink(`${jasmine.files.path}/${f}`);
  const bRel = f => viaLink(`${jasmine.files.bootDir}/${f}`);
  const min = buildKind === 'min' ? '.min' : '';

  const SUITES = {
    e2e: {
      css: ['/test/lib/normalize.css', `/dist/freegrid${min}.css`, '/test/helpers/common.css'],
      js: ['/test/helpers/jasmine-bridge-reporter.js', '/test/lib/jquery.min.js', '/test/lib/jquery.simulate.js',
        '/test/lib/lodash.underscore.js', '/test/lib/backbone.js',
        '/node_modules/numbro/dist/numbro.js', '/node_modules/numbro/dist/languages.min.js',
        '/node_modules/moment/moment.js', '/node_modules/pikaday/pikaday.js',
        `/dist/freegrid${min}.js`, '/dist/compat.js', `/dist/languages/all${min}.js`,
        '/test/dist/helpers.entry.js', '/test/dist/specs.entry.js'],
    },
    walkontable: {
      css: ['/src/3rdparty/walkontable/css/walkontable.css'],
      js: ['/test/runner/set-immediate-global.js', '/src/3rdparty/walkontable/test/helpers/jasmine-bridge-reporter.js',
        '/src/3rdparty/walkontable/test/lib/jquery.min.js', '/src/3rdparty/walkontable/test/lib/jquery.simulate.js',
        '/src/3rdparty/walkontable/dist/walkontable.js',
        '/src/3rdparty/walkontable/test/dist/helpers.entry.js', '/src/3rdparty/walkontable/test/dist/specs.entry.js'],
    },
    selftest: {
      css: [],
      js: ['/test/helpers/jasmine-bridge-reporter.js', '/test/lib/jquery.min.js', '/test/dist/selftest/specs.entry.js'],
    },
  };
  const s = SUITES[suite];
  const css = [...jasmine.files.cssFiles.map(jRel), ...s.css].map(h => `<link rel="stylesheet" href="${h}">`);
  const js = [...jasmine.files.jsFiles.map(jRel), bRel('boot0.js'),
    // Jasmine 2.5 ran specs in declaration order; Jasmine 5 randomizes by default.
    'data:text/javascript,jasmine.getEnv().configure({random:false});', bRel('boot1.js'), ...s.js]
    .map(src => `<script src="${src}"></script>`);

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>FreeGrid ${suite}</title>${css.join('')}</head><body>${js.join('')}</body></html>`;
}
