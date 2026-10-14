# FreeGrid changelog

## Unreleased

- **Breaking:** editors, renderers and validators have uniform names, the kind first: `FreeGrid.editors.EditorText`,
  `EditorAutocomplete`, `EditorDate`, …; `FreeGrid.renderers.RendererText`, `RendererNumeric`, …;
  `FreeGrid.validators.ValidatorDate`, `ValidatorTime`, … The old names (`TextEditor`, `TextRenderer`,
  `DateValidator`, `cellDecorator`, …) are removed. Names in settings (`type: 'date'`, `editor: 'text'`,
  `renderer: 'numeric'`) do not change. See [Migrating from Handsontable](https://freegrid-web.github.io/freegrid/guide/migrating-from-handsontable#editor-renderer-and-validator-names).
- Editors are ES classes now (TypeScript rewrite). Custom editors made with `FreeGrid.editors.EditorText.prototype.extend()`
  or `class MyEditor extends FreeGrid.editors.EditorText` keep working; one that calls a parent editor as a function
  (`EditorText.call(this, instance)`) must use `class … extends` instead.
- The TypeScript definitions have `FreeGrid.validators` (with `Validator`), and `getRenderer`/`registerRenderer`.
- Fixes:
  - The date editor dropped `closeEditor`'s callback: after an async validation, the next cell's editor did not open.
  - Case-sensitive autocomplete (`filteringCaseSensitive`) did not bold the typed text in the list.
- Plugins (TypeScript rewrite, part 1: the plugin base and registry, touchScroll, dragToScroll, persistentState,
  search). Fix: the `persistentStateReset` hook with a key cleared every saved value; it clears only that key now.
- Plugins, part 2: manualColumnFreeze, observeChanges, multipleSelectionHandles, manualColumnResize, manualRowResize.
  Fixes:
  - Touch screens: when one of two dragged selection handles was released, the other one stopped being dragged.
  - manualColumnResize: a column header with `colspan="1"` gets the resize handle too.
- Plugins, part 3: autoColumnSize, autoRowSize, autofill, undoRedo (a class now; `UndoRedo.ChangeAction` and the other
  actions stay available as static properties).
- Plugins, part 4: copyPaste. A paste event without clipboard data is ignored (it threw an error).
- **Security:** pasting HTML could run code from it (e.g. an image's `onerror`), because the pasted table was read through
  an element's `innerHTML`. Pasted HTML is now parsed into an inert document.
- Plugins, part 5: manualColumnMove, manualRowMove.
- Plugins, part 6: customBorders, comments.
- Plugins, part 7: columnSorting (with its sort functions and sort service).
- Plugins, part 8: contextMenu (the menu, its items, commands and positioning). A submenu's class name replaces every
  character other than a letter or a digit with `_` (the range `A-z` also kept ``[\]^_` ``).
- Plugins, part 9: mergeCells, the last plugin: every plugin is TypeScript now. Fix: clearing the merged cells
  (`clearCollections`, e.g. on `updateSettings`) left the cells a merged cell had covered invisible until the next render.
- Core, part 1 (TypeScript rewrite): EventManager, EditorManager (a class now), DataSource, MultiMap and the compat
  entry. Fix: a function in `enterMoves` got the browser's global `window.event` instead of the key event (the same
  event during a key press, so it worked by chance).
- Core, part 2 (TypeScript rewrite): DataMap and TableView are classes now. Fixes:
  - A dotted data property through `__proto__`, `constructor` or `prototype` (e.g. `setDataAtRowProp(0,
    '__proto__.x', 1)`) changed `Object.prototype`; such a property is ignored now.
  - A column header that had to be rebuilt ran `afterGetColHeader` twice.
- Docs, API reference:
  - Plugin methods show their TypeScript parameter and return types.
  - `isEnabled` is listed for every plugin, and four plugin methods lost descriptions that belonged to other code
    (e.g. ManualColumnResize's `isEnabled` showed the plugin's description).
  - The right-hand lists (Related API on guide pages, and an index on each reference page) are alphabetical, one
    entry per line, in the order settings, methods, events, with plugin methods grouped by plugin. A filter box
    narrows them while typing, and the group headings show a count.
  - Every method, event and setting has code in a collapsible block: the source's examples ("Example"), or a usage
    example written from its signature ("Usage").
  - Links to entries the reference does not have (internal classes) are plain text.

## 0.2.0 (2026-10-13)

FreeGrid has no runtime dependencies now: its own date and number formatting and its own date picker replace
moment, numbro and Pikaday. Theming with CSS variables, a dark theme, the Modern style and a complete API reference.

- Docs: a complete API reference, generated from the source code at every docs build:
  - [Methods](https://freegrid-web.github.io/freegrid/api/methods): every method, with parameters, return value and
    examples.
  - Events: every event, with its arguments.
  - Settings: every setting, with its type and default.
  - Plugins: each plugin's setting and methods.

  Entries are grouped by topic and searchable. Guide pages list every related method, event and setting in a
  "Related API" column: on the right on wide screens, at the end of the page on narrow ones. Settings and events of
  features FreeGrid does not have (filters, formulas, nested headers, hidden rows/columns, …) are not listed.
  Outdated links and wording in the source code's comments were fixed.
- Modern style has its own look, inspired by modern spreadsheet apps:
  - light grid lines, soft text and light headers in medium weight;
  - a blue accent and a round fill handle;
  - a 14px font (Roboto or the system's sans-serif).

  These colors and the font are *style defaults* (`--fg-style-*`). Base variables that you or a theme set still win
  in Modern, and the dark theme gives Modern its dark colors. New: `--fg-fill-handle-radius`. New:
  `fg-style-classic` / `data-fg-style="classic"`, for a Classic grid inside a Modern page (the closest style wins).
  The Classic look is unchanged.
- Docs:
  - The live examples use Modern; **Grid** in the top bar switches all of them to Classic and back, and the choice
    is remembered.
  - The Theming page's variable tables have a Modern column.
- Numbers without numbro: FreeGrid formats `numericFormat` itself. numbro patterns keep working and give the same
  text; the separators and the currency of `culture` come from the browser (`Intl`), so every locale works without
  language files. Without a `pattern`, `numericFormat` takes `Intl.NumberFormat` options (`style`, `currency`,
  `unit`, `notation`, …). numbro is no longer a dependency: FreeGrid has no runtime dependencies, `freegrid.js` works
  on its own, and `freegrid.full.js` is the same build (it no longer sets `window.numbro`); about 37 KB smaller
  minified. Differences from numbro: `a` uses `k`/`m`/`b`/`t` in every culture, ordinals other than English are
  `.`, and currency symbols are the browser's (`￥` for `ja-JP`).
- FreeGrid's own date picker replaces Pikaday: themed by the `--fg-*` variables (dark theme and Modern style
  included), usable from the keyboard (<kbd>Alt</kbd>+<kbd>↓</kbd> in the editor, then arrows, Page Up/Down,
  Home/End, Enter, Esc), with screen-reader labels. It follows a date typed in the cell. `datePickerConfig` keeps
  Pikaday's option names for `firstDay`, `minDate`, `maxDate`, `disableDayFn`, `disableWeekends`, `yearRange`,
  `i18n`, `onSelect`, `onOpen`, `onClose` and `onDraw`; other Pikaday options are ignored. Pikaday is no longer a
  dependency: the plain UMD build needs only numbro, and every CSS build styles the calendar. Its classes are
  `fg-datepicker*` instead of `pika-*`; the Pikaday-only theme variables are gone and `--fg-datepicker-radius` and
  `--fg-datepicker-focus-color` are new.
- Dates without moment.js: FreeGrid reads and writes `dateFormat` / `timeFormat` itself, with moment's tokens and
  parsing rules, so existing formats keep working. moment is no longer a dependency: the plain UMD build
  (`freegrid.js`) no longer needs it on the page, `freegrid.full.js` no longer bundles it or sets `window.moment`,
  and the ESM build no longer imports it (the full build is about 54 KB smaller minified). Week tokens and
  non-English month and day names are not supported.
- Theming: every color, the font and the shadows come from CSS variables (`--fg-*`, all defined in
  `src/css/variables.css`). Override base variables such as `--fg-color-accent` on `:root`, or component variables on
  `.freegrid`. The default look is unchanged.
- Dark theme: class `fg-theme-dark` or `data-fg-theme="dark"` on the grid or any ancestor; `fg-theme-auto` /
  `data-fg-theme="auto"` follows the system setting; `fg-theme-light` keeps a grid light inside a dark page (the
  closest theme wins). The context menu, the comment editor and the date picker follow the grid's theme.
- Removed the unused styles of the mobile text editor (`.htMobileEditorContainer`); no FreeGrid code creates it.
- The selection border, fill border and fill handle colors are CSS variables instead of fixed colors in JavaScript.
- Borders added from the context menu (Borders > Top/Right/Bottom/Left) use `--fg-custom-border-color` (black in the
  light theme); `getBorders()` reports their color as `var(--fg-custom-border-color)` instead of `#000`.

## 0.1.0 (2026-10-12)

First release on npm, as `@freegrid/core`.

- The npm package is `@freegrid/core` (npm blocks the unscoped `freegrid` as too similar to an existing package).
- FreeGrid is an independent project; versions start at `0.1.0`. The Handsontable compatibility layer is
  a migration aid during `0.x` and will be removed in `1.0.0`.
- Forked from Handsontable 6.2.2 (MIT). Renamed to FreeGrid; a `Handsontable` alias is available via
  `freegrid/compat` (ESM) or `dist/compat.js` (script tag).
- Vite build (ESM + UMD), ES2020 target, Node 24, pnpm. CommonJS output and IE support dropped.
- `@babel/polyfill` removed. `setImmediate`, which 6.2.2 took from that polyfill, is now provided
  internally.
- moment upgraded from 2.20.1 to 2.31 (security fixes CVE-2022-24785 and CVE-2022-31129). Note:
  moment ≥ 2.25 parses some malformed date formats differently (for example `mm/dd/yy`, which means
  minutes/weekday/year); valid formats such as `MM/DD/YYYY` behave as before.
- Removed the unused Handsontable Pro license-key check.
- FreeGrid CSS class names (`fg-` prefix, `freegrid` root class). The legacy Handsontable names stay on every
  element and in the CSS during `0.x` and are removed in `1.0`. Alignment set from the context menu is stored
  as `fg-left`, `fg-center`, … in the cell's `className`.
- Deferred editor focus runs before later timers in Firefox and Safari (fixes focus lost to the editor after
  clicking an input next to the grid, and with several grids on a page).
- Code comments and runtime messages name FreeGrid (e.g. "this FreeGrid instance has been destroyed").
- jQuery plugin available as `$.fn.freegrid`; `$.fn.handsontable` remains as a compatibility name.
- Source code is moving to TypeScript (strict). The first converted module is `helpers/number`; there is no change
  in behavior.
- Removed IE and legacy-browser code. Removed helpers, with what to use instead:
  - `FreeGrid.helper.isIE`, `isIE8`, `isIE9`, `isEdge`, `isMSBrowser`: no replacement; IE and EdgeHTML are not
    supported.
  - `FreeGrid.helper.requestAnimationFrame`, `cancelAnimationFrame`: use `window.requestAnimationFrame` and
    `window.cancelAnimationFrame`.
  - `FreeGrid.helper.isWebComponentSupportedNatively` (Shadow DOM v0), `FreeGrid.helper.hasCaptionProblem`: no
    replacement; no supported browser needs them.
  - IE-only CSS (`-ms-` properties, IE9–11 selection-area fixes) removed from `freegrid.css`.
- Supported browsers are now Chrome/Edge 107+, Firefox 104+ and Safari 16+ (Vite's "Baseline Widely Available"
  set; previously Chrome 80, Firefox 74, Safari 14). On iPhone and iPad this needs iOS 16 or later.

---

# Upstream Handsontable changelog (up to 6.2.2)

All upstream releases are described at https://github.com/handsontable/handsontable/releases
