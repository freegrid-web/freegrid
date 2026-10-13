# FreeGrid — theming with CSS variables and a dark theme

- **Status:** Draft for review
- **Date:** 2026-10-12
- **Comes before:** the first "proper" release after `0.1.0` (wrappers come later)

## 1. Goal

Let people adapt FreeGrid's look to their site with CSS custom properties, and ship a dark theme.

- **Customizable:** colors, font and shadow through `--fg-*` variables. Changing three or four base variables
  restyles the whole grid; every element can also be tuned on its own.
- **Dark theme:** switched on with one class (or attribute), or automatically from the system setting.
- **Unchanged by default:** without any theme class the grid looks exactly as it does now, pixel for pixel, so the
  existing E2E suite (which checks positions and sizes) stays green.

Success: a user changes `--fg-color-accent` and `--fg-font-family` and gets their brand; they add
`class="fg-theme-dark"` and get a dark grid whose context menu, comments and date picker are dark too; the docs
list every variable with a live example.

## 2. Scope

**In:** every FreeGrid stylesheet (`src/css/*`, `src/3rdparty/walkontable/css/*`, the plugin stylesheets under
`src/plugins/*/`), the colors of the bundled Pikaday date picker, a docs page, CHANGELOG.

**Out (later):** a Tailwind preset, size variables (row height, density, paddings — the JavaScript layout reads
them), a new default look, framework wrappers.

## 3. All variables in one file

`packages/freegrid/src/css/variables.css` is the only place where theme values live. Every other stylesheet uses
`var(--fg-…)` and contains no color literals. The file has four sections, in this order:

1. **Base variables** (light theme, the defaults).
2. **Component variables**, grouped by part: grid and cells, headers, selection and fill handle, editors,
   validation, context menu, comments, merged cells, manual row/column move, mobile selection handles, date picker.
   Each defaults to a base variable or to today's exact value.
3. **Dark theme** (`fg-theme-dark`): overrides base variables, and component variables only where the derived value
   does not work on a dark background.
4. **Automatic theme** (`fg-theme-auto`): the dark values inside `@media (prefers-color-scheme: dark)`.

The file is imported first by `src/index.js`, so it is part of `freegrid.css` / `freegrid.full.css`; there is no
separate stylesheet to load.

### 3.1 Where defaults are declared

Defaults are declared on `:where(:root)` (zero specificity). Variables inherit, so a user can override them on
`:root`, on any ancestor of the grid, or on the grid's root element, without fighting specificity:

```css
:root { --fg-color-accent: #0a7d55; --fg-font-family: Inter, sans-serif; }
```

Theme classes redefine the base variables on the element that carries them, so they apply to everything inside.

### 3.2 Base variables

| Variable | Meaning | Light default |
|---|---|---|
| `--fg-color-background` | cell and panel background | today's cell background |
| `--fg-color-text` | cell text | today's text color |
| `--fg-color-muted-text` | secondary text (placeholders, disabled menu items) | today's value |
| `--fg-color-border` | grid lines | `#ccc` |
| `--fg-color-header-background` | row/column header background | today's value |
| `--fg-color-header-text` | header text | today's value |
| `--fg-color-accent` | selection, active header, focus | today's selection blue |
| `--fg-color-invalid` | invalid-cell background | today's value |
| `--fg-color-readonly-text` | read-only cell text | today's value |
| `--fg-font-family` | font | `Helvetica, Arial, sans-serif` |
| `--fg-font-size` | font size | today's value |
| `--fg-shadow` | menu and popup shadow | today's value |

"Today's value" is filled in from the current CSS when the file is written; the light theme must reproduce the
current computed styles exactly (see §6).

### 3.3 Component variables (examples)

`--fg-selection-border-color: var(--fg-color-accent)`, `--fg-selection-area-background`,
`--fg-header-active-background`, `--fg-header-highlight-background`, `--fg-fill-handle-color`,
`--fg-invalid-background: var(--fg-color-invalid)`, `--fg-menu-background`, `--fg-menu-hover-background`,
`--fg-menu-separator-color`, `--fg-comment-indicator-color`, `--fg-comment-background`,
`--fg-move-guideline-color`, `--fg-move-backlight-background`, `--fg-datepicker-selected-background`. The complete
list is whatever the stylesheets need once every color literal is replaced; each gets a one-line comment in
`variables.css`.

Where today's CSS uses a slightly different shade of the same role (for example three similar blues for
selection), the component variable keeps the exact current value as its light default rather than collapsing it
into the base variable, so nothing changes visually; the dark theme then sets it explicitly.

## 4. Switching themes

- `class="fg-theme-dark"` or `data-fg-theme="dark"` on `<html>`, `<body>`, any ancestor or the grid's root element:
  dark theme.
- `class="fg-theme-auto"` or `data-fg-theme="auto"`: dark when the system is dark, light otherwise.
- No class: light (today's look).

## 5. Floating elements

Three parts are appended to `<body>`, outside the grid, so they would not inherit a theme set on the grid or its
ancestors: the context menu container (`plugins/contextMenu/menu.js`), the comment editor container
(`plugins/comments/commentEditor.js`) and the date picker holder (`editors/dateEditor.js`).

When FreeGrid creates or shows one of them, it looks for the grid's theme — the closest `fg-theme-*` class or
`data-fg-theme` attribute, starting at the grid's root element and walking up — and puts the same class on the
floating element. One small helper (`getThemeClassName(rootElement)`) is shared by the three call sites.

Variables a user overrides on an ancestor of the grid do not reach floating elements; the docs recommend
overriding on `:root` or on a theme class.

## 6. Testing

1. **Light theme unchanged (written first).** A new E2E spec renders a grid that shows every styled part — headers,
   a selection range, the active header, an invalid cell, a read-only cell, a comment indicator, a merged cell, the
   fill handle, an open context menu with a separator and a disabled item, an open date picker — and records the
   computed `color`, `background-color`, `border-*-color`, `font-family`, `font-size` and `box-shadow` of each.
   The expected values are captured from the current CSS before any change, stored in the spec, and must match after
   the change in Chromium, Firefox and WebKit.
2. **Dark theme applies:** with `fg-theme-dark` on an ancestor, cell background and text change, and the context
   menu, comment editor and date picker carry the theme class and render dark.
3. **Automatic theme:** with `fg-theme-auto`, Playwright's `prefers-color-scheme` emulation gives dark and light.
4. **No color literals outside `variables.css`:** a unit test scans the stylesheets and fails on a color literal
   (hex, `rgb()`, `rgba()`, named colors) outside `variables.css`.
5. The existing unit, dist and E2E suites stay green in all three browsers.

## 7. Documentation

A "Theming" page in the docs site:

- how to override variables, and how to switch to the dark or automatic theme;
- **a theme playground**: a live grid (with headers, a selection, an invalid cell, a comment, a context menu and a
  date column) next to a panel with a light / dark / auto switch and editors for the base variables (color pickers,
  font family, font size). Changes apply to the grid at once, and the panel shows the CSS to copy
  (`:root { --fg-…: …; }`) with only the changed variables, plus a reset button;
- **the table of all variables** (name, what it styles, light and dark value), generated at docs build time from
  `variables.css` and its comments, so it cannot go out of date.

CHANGELOG entry.

Also on the docs site (independent of theming, same PR): the "About this page" block (Markdown, edit on GitHub, last
updated) moves below the page outline in the right column, so "On this page" comes first.

## 8. Compatibility

The legacy class names stay styled: the CSS build already emits each FreeGrid selector with its legacy counterpart,
and the variables apply to both. No public JavaScript API changes.

## 9. Styles: Classic and Modern (added 2026-10-13)

A second axis next to the color theme. **Classic** (the default) is today's look, unchanged. **Modern** is a roomier,
flatter look: `class="fg-style-modern"` or `data-fg-style="modern"` on the grid or any ancestor, combinable with any
color theme (light, dark, auto).

- **Size variables** in `variables.css`: `--fg-row-height` (Classic `23px`, the row's total height including its
  bottom border), `--fg-cell-padding-x` (Classic `4px`), plus `--fg-radius` (editor and menu corners) and
  `--fg-header-font-weight`. The cell CSS uses them (`height: calc(var(--fg-row-height) - 1px)`, line height and
  horizontal padding).
- **JavaScript reads the row height**: when the grid is created, FreeGrid reads `--fg-row-height` from its root
  element and gives it to Walkontable as the default row height. Every hard-coded `23` (context menu rows, autocomplete
  list, row move) uses that value. A style switched after the grid was created takes effect after
  `updateSettings({})`.
- **Modern** sets: row height `32px`, cell padding `8px`, `system-ui` font at `13px`, headers on the cell background
  with muted text, lighter grid lines, rounded editor and menu (`--fg-radius: 6px`) with a soft shadow. It changes
  only sizes, fonts, radii and which base color a component uses — never a color literal — so it works with every color
  theme.
- Floating elements get the grid's style class too (`applyTheme` copies `fg-style-*` as well as `fg-theme-*`).
- Tests: Classic snapshots unchanged; Modern: rendered row height 32px, Walkontable's default row height 32, scrolling
  to the last row shows it, the editor and the context menu line up with their cell; works with the dark theme.
- Docs: a Classic / Modern switch in the playground and a "Styles" section on the Theming page.
