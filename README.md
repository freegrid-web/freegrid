# FreeGrid

A free, MIT-licensed, spreadsheet-like data grid for the web — and it stays that way.

FreeGrid is a fork of **Handsontable 6.2.2**, the last MIT-licensed release. It keeps the 6.x API so
existing projects can move over by changing an import, and is being modernized step by step
(TypeScript, signals-based reactivity, CSS-variable theming).

> FreeGrid is not affiliated with or endorsed by Handsoncode. "Handsontable" is a trademark of its owner
> and is used here only to describe compatibility.

## Status

Stage 0 — repository, modern toolchain, upstream test suite passing. Not yet published to npm.
See the [roadmap](docs/specs/2026-10-12-stage-0-fork-design.md#10-roadmap).

## Usage (after the first release)

```js
import FreeGrid from 'freegrid';
import 'freegrid/dist/freegrid.full.css';

new FreeGrid(document.getElementById('grid'), {
  data: [['A1', 'B1'], ['A2', 'B2']],
  rowHeaders: true,
  colHeaders: true,
});
```

Migrating from Handsontable 6.x:

```js
import Handsontable from 'freegrid/compat'; // the rest of your code stays the same
```

With a `<script>` tag: load `dist/freegrid.full.js`, then optionally `dist/compat.js` to get
`window.Handsontable`. Locales: `dist/languages/<code>.js` (or `all.js`) after the grid script.

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
