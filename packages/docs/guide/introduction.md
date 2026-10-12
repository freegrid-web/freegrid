# Introduction

FreeGrid is a JavaScript data grid that looks and feels like a spreadsheet. It turns a `<div>` into an editable
table with keyboard navigation, copy and paste, sorting, merged cells, comments, validation and more.

It is **free and open source under the MIT license**, with no paid tier and no license key.

## Where it comes from

FreeGrid started from the code of Handsontable 6.2.2, the last release of Handsontable published under the MIT
license, together with its history and tests. From that point on, FreeGrid is an independent project with its own
API, releases and roadmap.

While FreeGrid is in `0.x`, a small compatibility layer helps projects move over from Handsontable 6
(see [Migrating from Handsontable 6](./migrating-from-handsontable)).

## What you get

- Editing that feels like a spreadsheet: typing, <kbd>Enter</kbd>, <kbd>Tab</kbd>, arrow keys, fill handle,
  undo and redo.
- Copy and paste with Excel, Google Sheets and LibreOffice.
- [Cell types](./cell-types): text, numeric, date, time, checkbox, dropdown, autocomplete, password.
- [Plugins](./plugins): sorting, context menu, merged cells, comments, custom borders, search, frozen rows and
  columns, resizing and moving rows and columns.
- [Localization](./localization) for the built-in UI in 16 languages.
- Fast rendering of large data: only the visible cells are in the DOM.

## Browser support

Chrome and Edge 107+, Firefox 104+ and Safari 16+ (the browsers that Vite calls "Baseline Widely
Available"). On iPhone and iPad this means iOS 16 or later.

## Status

FreeGrid is young. The [roadmap](../project/roadmap) describes what comes next: a TypeScript rewrite,
signals-based reactivity, theming with CSS variables, framework wrappers, and features such as filters
and formulas.
