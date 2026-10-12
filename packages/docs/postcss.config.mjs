import { postcssIsolateStyles } from 'vitepress';

// Keeps VitePress' content styles (.vp-doc) out of `.vp-raw` blocks, so live grids keep FreeGrid's styles.
export default {
  // Carbon bundles its component styles through its own index.css, so match every Carbon stylesheet.
  plugins: [postcssIsolateStyles({ includeFiles: [/vp-doc\.css/, /base\.css/, /vitepress-carbon[\\/].*\.css$/] })],
};
