# FreeSheet

> **0.x release.** FreeSheet works and is tested in Chrome, Edge, Firefox and Safari. Until `1.0.0` its API may
> still change between minor versions; every change is listed in the changelog.

A free, MIT-licensed, spreadsheet-like data grid for the web: editing, copy and paste with Excel, fill handle,
undo and redo, sorting, merged cells, comments, validation, frozen rows and columns, and more.

FreeSheet is an independent project that started from the code of Handsontable 6.2.2, the last MIT-licensed
release. It is not affiliated with or endorsed by Handsoncode.

- **Documentation and live examples:** https://freegrid-web.github.io/freegrid/
- **Source and issues:** https://github.com/freegrid-web/freegrid

```js
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

new FreeSheet(document.getElementById('grid'), {
  data: [['A1', 'B1'], ['A2', 'B2']],
  rowHeaders: true,
  colHeaders: true,
});
```

## License

MIT
