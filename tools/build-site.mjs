// Assembles the GitHub Pages site: demo/ plus the built packages/freegrid/dist into _site/.
// Usage: node tools/build-site.mjs  (run `pnpm build` first)
import { cpSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const r = p => fileURLToPath(new URL(`../${p}`, import.meta.url));

if (!existsSync(r('packages/freegrid/dist/freegrid.full.min.js'))) {
  throw new Error('packages/freegrid/dist is missing; run `pnpm build` first.');
}
rmSync(r('_site'), { recursive: true, force: true });
cpSync(r('demo'), r('_site'), { recursive: true });
cpSync(r('packages/freegrid/dist'), r('_site/dist'), {
  recursive: true,
  filter: src => !src.endsWith('.map') && !src.includes('/esm'),
});
console.log('Site assembled in _site/.');
