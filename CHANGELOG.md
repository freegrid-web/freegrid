# FreeGrid changelog

## Unreleased (Stage 0)
- Forked from Handsontable 6.2.2 (MIT). Renamed to FreeGrid; a `Handsontable` alias is available via
  `freegrid/compat` (ESM) or `dist/compat.js` (script tag).
- Vite build (ESM + UMD), ES2020 target, Node 24, pnpm. CommonJS output and IE support dropped.
- `@babel/polyfill` removed. `setImmediate`, which 6.2.2 took from that polyfill, is now provided
  internally.
- moment upgraded from 2.20.1 to 2.31 (security fixes CVE-2022-24785 and CVE-2022-31129). Note:
  moment ≥ 2.25 parses some malformed date formats differently (for example `mm/dd/yy`, which means
  minutes/weekday/year); valid formats such as `MM/DD/YYYY` behave as before.
- Removed the unused Handsontable Pro license-key check.
- Code comments and runtime messages name FreeGrid (e.g. "this FreeGrid instance has been destroyed").
- jQuery plugin available as `$.fn.freegrid`; `$.fn.handsontable` remains as a compatibility name.

---

# Upstream Handsontable changelog (up to 6.2.2)

All upstream releases are described at https://github.com/handsontable/handsontable/releases
