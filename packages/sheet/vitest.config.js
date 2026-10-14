import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { defineConstants } from './build/constants.js';

const src = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  define: defineConstants(),
  resolve: {
    alias: [
      { find: /^handsontable(.*)$/, replacement: `${src}$1` },
      { find: /^walkontable(.*)$/, replacement: `${src}/3rdparty/walkontable/src$1` },
    ],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    css: false,
    testTimeout: 15000,
    include: [
      'test/unit/**/*.spec.{js,ts}',
      'test/unit/**/*.unit.{js,ts}',
      'src/plugins/**/*.unit.{js,ts}',
      'test/setup/*.unit.{js,ts}',
    ],
    setupFiles: ['test/setup/jasmine-shim.js', 'test/bootstrap.js'],
  },
});
