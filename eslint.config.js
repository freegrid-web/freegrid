import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Upstream code has eslint-disable comments for eslint-plugin-import rules (airbnb config). Register
// no-op stand-ins so those comments stay valid without pulling in the plugin.
const noop = { create: () => ({}) };
const importStandIn = { rules: { 'no-unresolved': noop, 'prefer-default-export': noop } };
const tsSources = ['packages/freegrid/src/**/*.ts'];
const tsTypeTests = ['packages/freegrid/src/**/test/**'];

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
  // TypeScript (spec docs/specs/2026-10-12-typescript-and-clean-code-design.md). `no-explicit-any` is an error:
  // an unavoidable `any` needs `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- <reason>`.
  // Type tests in src/**/test/ belong to `pnpm test:types`, like the ones in test/types/.
  ...tseslint.configs.recommended.map(config => ({ ...config, files: tsSources, ignores: tsTypeTests })),
  {
    files: tsSources,
    ignores: tsTypeTests,
    rules: {
      // Same option as for JS: unused catch bindings are allowed.
      '@typescript-eslint/no-unused-vars': ['error', { caughtErrors: 'none' }],
    },
  },
];
