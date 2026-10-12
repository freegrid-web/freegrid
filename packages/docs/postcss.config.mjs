import { postcssIsolateStyles } from 'vitepress';

// Keeps VitePress' content styles (.vp-doc) out of `.vp-raw` blocks, so live grids keep FreeGrid's styles.
export default {
  plugins: [postcssIsolateStyles({ includeFiles: [/vp-doc\.css/, /base\.css/] })],
};
