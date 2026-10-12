# FreeGrid changelog

## Unreleased (Stage 0)
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

---

# Upstream Handsontable changelog (up to 6.2.2)

All upstream releases are described at https://github.com/handsontable/handsontable/releases
