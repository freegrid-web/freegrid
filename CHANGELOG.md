# FreeGrid changelog

## Unreleased

- Theming: every color, the font and the shadows come from CSS variables (`--fg-*`, all defined in
  `src/css/variables.css`). Override base variables such as `--fg-color-accent` on `:root`, or component variables on
  `.freegrid`. The default look is unchanged.
- Dark theme: class `fg-theme-dark` or `data-fg-theme="dark"` on the grid or any ancestor; `fg-theme-auto` /
  `data-fg-theme="auto"` follows the system setting. The context menu, the comment editor and the date picker follow
  the grid's theme.
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
