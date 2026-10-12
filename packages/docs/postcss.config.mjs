import { postcssIsolateStyles } from 'vitepress';

// Keeps the theme's content styles (.vp-doc) out of `.vp-raw` blocks, so live grids keep FreeGrid's styles.
// Only plain stylesheets are isolated: Carbon bundles its component styles through dist/theme/styles/*.css.
// Vue component styles (`*.vue?…lang.css`) must not be touched, or scoped selectors such as
// `.VPHomeContent .vp-doc` get an extra descendant step and stop matching.
const carbonStylesheet = /vitepress-carbon[\\/]dist[\\/]theme[\\/]styles[\\/][^?]*\.css$/;

export default {
  plugins: [postcssIsolateStyles({ includeFiles: [/vp-doc\.css$/, /base\.css$/, carbonStylesheet] })],
};
