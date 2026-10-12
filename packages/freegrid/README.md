# FreeGrid

> **Preview release.** This version reserves the package name. FreeGrid works and is tested, but its API is
> being reworked (TypeScript rewrite) before the first real release, `0.1.0`. Do not use it in production yet.

A free, MIT-licensed, spreadsheet-like data grid for the web: editing, copy and paste with Excel, fill handle,
undo and redo, sorting, merged cells, comments, validation, frozen rows and columns, and more.

FreeGrid is an independent project that started from the code of Handsontable 6.2.2, the last MIT-licensed
release. It is not affiliated with or endorsed by Handsoncode.

- **Documentation and live examples:** https://freegrid-web.github.io/freegrid/
- **Source and issues:** https://github.com/freegrid-web/freegrid

```js
import FreeGrid from 'freegrid';
import 'freegrid/dist/freegrid.full.css';

new FreeGrid(document.getElementById('grid'), {
  data: [['A1', 'B1'], ['A2', 'B2']],
  rowHeaders: true,
  colHeaders: true,
});
```

## License

MIT
