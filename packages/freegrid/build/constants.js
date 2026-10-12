import { readFileSync } from 'node:fs';

export const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const license = readFileSync(new URL('../../../LICENSE', import.meta.url), 'utf8');

const pad = n => String(n).padStart(2, '0');

export function formatBuildDate(d) {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

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
