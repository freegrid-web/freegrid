---
api: [Hyperlinks]
---

# Hyperlinks

A cell's `link` setting makes its text a link: underlined, in the link color.

```js
new FreeSheet(container, {
  data: [['FreeGrid', 'Write to us']],
  cell: [
    { row: 0, col: 0, link: 'https://github.com/freegrid-web/sheet' },
    { row: 0, col: 1, link: 'mailto:team@example.com' },
  ],
});
```

- **Selecting** a cell with a link shows a card under it: the address (it opens in a new tab), **Edit** and **Remove**.
- **Ctrl+click** (⌘+click on a Mac) opens the link.
- **Ctrl+K**, or the context menu's **Insert link** (add its key `'link'` to `contextMenu`), edits the selected cell's text and link. Enter applies, Escape
  cancels, and one undo step takes back both.
- **Addresses:** only web (`http`, `https`) and mail (`mailto`) links are kept. `example.com/page` becomes
  `https://example.com/page`; anything else, such as `javascript:`, is refused.
- **Saving:** `getDocument()` and Excel files keep the links.

From code:

```js
const links = grid.getPlugin('hyperlinks');

links.setLink(0, 0, 'https://example.com', 'Example'); // the text is optional
links.getLink(0, 0);                                   // 'https://example.com'
links.removeLink(0, 0);
```

Turn the feature off with `hyperlinks: false`. The CSS variable `--fs-link-color` colors the links.
