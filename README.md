# FreeGrid

A free, MIT-licensed, spreadsheet-like data grid for the web — and it stays that way.

FreeGrid is an independent project that started from the code of **Handsontable 6.2.2**, the last
MIT-licensed release. From here on, its API, structure and releases are FreeGrid's own: it is being
modernized step by step (TypeScript, signals-based reactivity, CSS-variable theming). Versions start at
`0.1.0`; while FreeGrid is `0.x`, a compatibility layer helps projects migrate from Handsontable 6.x.

> FreeGrid is not affiliated with or endorsed by Handsoncode. "Handsontable" is a trademark of its owner
> and is used here only to describe where the code came from and how to migrate.

**Documentation and live examples:** https://freegrid-web.github.io/freegrid/

## Status

FreeGrid is on npm as [`@freegrid/core`](https://www.npmjs.com/package/@freegrid/core) (latest: `0.2.0`). Until
`1.0.0` the API may still change between minor versions (see the [changelog](CHANGELOG.md)). What comes next:
the [roadmap](https://freegrid-web.github.io/freegrid/project/roadmap).

## Usage

```bash
npm install @freegrid/core
```


```js
import FreeGrid from '@freegrid/core';
import '@freegrid/core/dist/freegrid.full.css';

new FreeGrid(document.getElementById('grid'), {
  data: [['A1', 'B1'], ['A2', 'B2']],
  rowHeaders: true,
  colHeaders: true,
});
```

Migrating from Handsontable 6.x (compatibility layer, available until FreeGrid 1.0):

```js
import Handsontable from '@freegrid/core/compat'; // the rest of your code stays the same
```

With a `<script>` tag: load `dist/freegrid.full.js`, then optionally `dist/compat.js` to get
`window.Handsontable`. Locales: `dist/languages/<code>.js` (or `all.js`) after the grid script; with a
bundler, `import '@freegrid/core/languages/de-DE';` (or `@freegrid/core/languages/all`).

## Development

Requires Node 24 and pnpm (`corepack enable`).

```bash
pnpm install
pnpm build
pnpm test
```

Browser tests use Playwright. If its system dependencies cannot be installed on your machine, run them
in Docker: `tools/in-playwright-docker.sh pnpm --dir packages/freegrid test:e2e`.

Tests are compared against the recorded upstream results in [docs/baseline](docs/baseline): every test
that passed in Handsontable 6.2.2 must pass in FreeGrid.

## License

MIT — see [LICENSE](LICENSE).
