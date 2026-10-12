import js from '@eslint/js';
import globals from 'globals';

// Upstream code has eslint-disable comments for eslint-plugin-import rules (airbnb config). Register
// no-op stand-ins so those comments stay valid without pulling in the plugin.
const noop = { create: () => ({}) };
const importStandIn = { rules: { 'no-unresolved': noop, 'prefer-default-export': noop } };

export default [
  {
    ignores: ['**/node_modules/**', '**/dist/**', 'packages/freegrid/lib/**', 'packages/freegrid/test/lib/**',
      'packages/freegrid/src/3rdparty/walkontable/test/lib/**', 'packages/freegrid/test-results/**', '.superpowers/**',
      'packages/docs/.vitepress/cache/**', 'packages/docs/.vitepress/dist/**'],
  },
  js.configs.recommended,
  {
    plugins: { import: importStandIn },
    // Upstream code carries many disable comments for airbnb rules that are not enabled here.
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, __FG_VERSION__: 'readonly', __FG_BUILD_DATE__: 'readonly', __FG_PACKAGE_NAME__: 'readonly' },
    },
    rules: {
      // Upstream code; revisit in Stage 2.
      'no-useless-assignment': 'off',
      'no-unassigned-vars': 'off',
      // ESLint 4 (upstream) did not report unused catch bindings.
      'no-unused-vars': ['error', { caughtErrors: 'none' }],
      // Possible upstream bugs (comments.js, selection/mouseEventHandler.js); kept visible, tracked for Stage 1.
      'no-dupe-else-if': 'warn',
      'no-constant-binary-expression': 'warn',
    },
  },
  {
    files: ['packages/freegrid/test/**', 'packages/freegrid/src/**/test/**', 'packages/freegrid/src/**/*.unit.js', 'packages/freegrid/src/**/*.e2e.js'],
    languageOptions: {
      globals: { ...globals.jasmine, ...globals.jquery, ...globals.vitest, jest: 'readonly', Handsontable: 'readonly', FreeGrid: 'readonly', Walkontable: 'readonly' },
    },
    // Upstream specs call helpers that test/helpers exports onto window at runtime.
    rules: { 'no-undef': 'off' },
  },
  {
    files: ['packages/freegrid/build/**', 'packages/freegrid/test/runner/**', 'packages/freegrid/test/build/**', 'packages/freegrid/*.config.js', 'tools/**', 'eslint.config.js',
      'packages/docs/test/**', 'packages/docs/.vitepress/config.mjs', 'packages/docs/postcss.config.mjs'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['tools/baseline/run-puppeteer-json.js'],
    languageOptions: { sourceType: 'commonjs' },
  },
];
