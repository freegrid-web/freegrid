import { defineConfigWithTheme } from 'vitepress';
import baseConfig from 'vitepress-carbon/config';

export default defineConfigWithTheme({
  // GitHub-style theme: https://carbon.breno.tech
  extends: baseConfig,
  title: 'FreeSheet',
  description: 'A free, MIT-licensed, spreadsheet-like data grid for the web.',
  base: '/sheet/',
  vite: {
    // Pre-bundling would move IronCalc's wasm.js away from wasm_bg.wasm, which it loads by a relative URL.
    optimizeDeps: { exclude: ['@ironcalc/wasm'] },
  },
  lang: 'en-US',
  lastUpdated: true,
  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: '/sheet/logo.svg' }]],
  themeConfig: {
    logo: '/logo.svg',
    nav: [
      { text: 'Guide', link: '/guide/introduction', activeMatch: '/guide/' },
      { text: 'Examples', link: '/examples/basics', activeMatch: '/examples/' },
      { text: 'API', link: '/api/', activeMatch: '/api/' },
      { text: 'Project', link: '/project/roadmap', activeMatch: '/project/' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Getting started',
          items: [
            { text: 'Introduction', link: '/guide/introduction' },
            { text: 'Getting started', link: '/guide/getting-started' },
            { text: 'Migrating from Handsontable 6', link: '/guide/migrating-from-handsontable' },
          ],
        },
        {
          text: 'Essentials',
          items: [
            { text: 'Configuration', link: '/guide/configuration' },
            { text: 'Cell types', link: '/guide/cell-types' },
            { text: 'Formulas', link: '/guide/formulas' },
            { text: 'Sheets', link: '/guide/sheets' },
            { text: 'Hidden rows and columns', link: '/guide/hidden-rows-and-columns' },
            { text: 'Filters and the column menu', link: '/guide/filters' },
            { text: 'Nested rows', link: '/guide/nested-rows' },
            { text: 'Row groups', link: '/guide/row-groups' },
            { text: 'Column groups', link: '/guide/column-groups' },
            { text: 'Conditional formatting', link: '/guide/conditional-formatting' },
            { text: 'Side panel', link: '/guide/side-panel' },
            { text: 'Status bar and frozen panes', link: '/guide/status-bar-and-freezing' },
            { text: 'Excel and CSV files', link: '/guide/files' },
            { text: 'Find and replace', link: '/guide/find-and-replace' },
            { text: 'Fill and paste', link: '/guide/fill-and-paste' },
            { text: 'Data and events', link: '/guide/data-and-events' },
            { text: 'Plugins', link: '/guide/plugins' },
            { text: 'Localization', link: '/guide/localization' },
            { text: 'Styling', link: '/guide/styling' },
            { text: 'Theming', link: '/guide/theming' },
          ],
        },
      ],
      '/examples/': [
        {
          text: 'Examples',
          items: [
            { text: 'Basics', link: '/examples/basics' },
            { text: 'Cell types', link: '/examples/cell-types' },
            { text: 'Formulas', link: '/examples/formulas' },
            { text: 'Sheets', link: '/examples/sheets' },
            { text: 'Budget across sheets', link: '/examples/budget' },
            { text: 'Hidden rows and columns', link: '/examples/hidden-rows-and-columns' },
            { text: 'Filters', link: '/examples/filters' },
            { text: 'Nested rows', link: '/examples/nested-rows' },
            { text: 'Row groups', link: '/examples/row-groups' },
            { text: 'Column groups', link: '/examples/column-groups' },
            { text: 'Conditional formatting', link: '/examples/conditional-formatting' },
            { text: 'Excel and CSV files', link: '/examples/files' },
            { text: 'Formatting', link: '/examples/formatting' },
            { text: 'Merged cells and comments', link: '/examples/merged-cells-and-comments' },
            { text: '10,000 rows', link: '/examples/large-data' },
            { text: 'Search and languages', link: '/examples/search-and-languages' },
          ],
        },
      ],
      '/api/': [
        {
          text: 'API reference',
          items: [
            { text: 'Overview', link: '/api/' },
            { text: 'Methods', link: '/api/methods' },
            { text: 'Events', link: '/api/events' },
            { text: 'Settings', link: '/api/settings' },
            { text: 'Plugins', link: '/api/plugins' },
          ],
        },
      ],
      '/project/': [
        {
          text: 'Project',
          items: [
            { text: 'Roadmap', link: '/project/roadmap' },
            { text: 'Contributing', link: '/project/contributing' },
            { text: 'Changelog', link: '/project/changelog' },
            { text: 'Origin and license', link: '/project/origin-and-license' },
          ],
        },
      ],
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/freegrid-web/sheet' }],
    search: { provider: 'local' },
    editLink: {
      pattern: 'https://github.com/freegrid-web/sheet/edit/main/packages/docs/:path',
      text: 'Edit this page on GitHub',
    },
    footer: {
      message: 'Released under the MIT License. Not affiliated with or endorsed by Handsoncode.',
      copyright: 'Copyright © 2012-2014 Marcin Warpechowski, © 2015 Handsoncode, © 2026 FreeGrid contributors',
    },
  },
});
