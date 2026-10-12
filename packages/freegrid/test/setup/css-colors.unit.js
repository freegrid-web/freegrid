import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Theme values live only in src/css/variables.css; other stylesheets use var(--fg-…). Walkontable's own CSS is only
// used by its test page, so it is not checked.
const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(|(?<![\w-])(?:white|black|red|green|blue|gray|grey|silver|yellow|orange|purple|navy)(?![\w-])/;

describe('stylesheets', () => {
  it('have no color literals outside variables.css', () => {
    const src = resolve(import.meta.dirname, '../../src');
    const found = readdirSync(src, { recursive: true }).map(String)
      .filter(f => f.endsWith('.css') && !f.endsWith('variables.css') && !/(^|[\\/])(test|dist)[\\/]/.test(f) &&
        !/3rdparty[\\/]walkontable[\\/]css/.test(f))
      .flatMap(f => readFileSync(resolve(src, f), 'utf8').split('\n')
        .map((line, i) => [line.replace(/\/\*.*?\*\//g, ''), i + 1])
        .filter(([line]) => COLOR_LITERAL.test(line))
        .map(([line, n]) => `${f}:${n}: ${line.trim()}`));

    expect(found).toEqual([]);
  });
});
