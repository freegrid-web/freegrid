import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Paths from a string (not a URL object): under jsdom the global URL is not Node's.
const here = dirname(fileURLToPath(import.meta.url));

export const pkg = JSON.parse(readFileSync(resolve(here, '../package.json'), 'utf8'));
const license = readFileSync(resolve(here, '../../../LICENSE'), 'utf8');

const pad = n => String(n).padStart(2, '0');

export function formatBuildDate(d) {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Supported browsers: Vite 7's default "Baseline Widely Available" set. Used for both JS and CSS output.
export const browserTarget = ['chrome107', 'edge107', 'firefox104', 'safari16'];

export function defineConstants({ buildDate = new Date() } = {}) {
  return {
    __FG_VERSION__: JSON.stringify(pkg.version),
    __FG_BUILD_DATE__: JSON.stringify(formatBuildDate(buildDate)),
    __FG_PACKAGE_NAME__: JSON.stringify(pkg.name),
  };
}

export function banner(buildDate = new Date()) {
  const body = `${license.trim()}\n\nVersion: ${pkg.version}\nBuilt: ${formatBuildDate(buildDate)}`;

  return `/*!\n${body.split('\n').map(l => ` * ${l}`.trimEnd()).join('\n')}\n */`;
}
