// Reads FreeGrid's theme variables from packages/freegrid/src/css/variables.css at docs build time, so the Theming
// page always lists exactly what the stylesheet defines.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const file = fileURLToPath(new URL('../../freegrid/src/css/variables.css', import.meta.url));

// "--fg-name: value; /* description */" declarations of a rule body, with the "/* == Group == */" they follow.
function declarations(body) {
  const result = [];
  let group = '';

  body.split('\n').forEach((line) => {
    const heading = line.match(/\/\* == (.+?) == \*\//);

    if (heading) {
      group = heading[1];
      return;
    }
    const match = line.match(/^\s*(--fg-[\w-]+):\s*(.+?);\s*(?:\/\*\s*(.+?)\s*\*\/)?\s*$/);

    if (match) {
      result.push({ group, name: match[1], value: match[2], description: match[3] || '' });
    }
  });

  return result;
}

export default {
  watch: [file],
  load() {
    // Comments are kept (they hold the descriptions and the group headings), except those with braces, such as the
    // usage examples in the file header, which would look like rules.
    const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, comment => (/[{}]/.test(comment) ? '' : comment));
    const rules = [...css.matchAll(/([^{}]*)\{([^{}]*)\}/g)]
      .map(([, selector, body]) => ({ selector: selector.replace(/\/\*[\s\S]*?\*\//g, '').trim(), body }));
    const find = predicate => declarations(rules.find(predicate)?.body || '');
    // :root has the base variables (before the first group heading) and the component variables with their own
    // value; the grid's parts have the component variables that follow a base variable.
    const root = find(({ selector }) => selector.includes(':where(:root)'));
    const lightBase = root.filter(({ group }) => !group);
    const lightComponents = [
      ...root.filter(({ group }) => group),
      ...find(({ selector }) => selector.startsWith(':where(.freegrid')),
    ];
    const dark = new Map(find(({ selector }) => selector.includes('fg-theme-dark'))
      .map(({ name, value }) => [name, value]));
    const row = ({ name, value, description }) => ({ name, description, light: value, dark: dark.get(name) || '' });
    const unsetBase = ['--fg-color-text', '--fg-font-family', '--fg-font-size']
      .filter(name => !lightBase.some(declaration => declaration.name === name))
      .map(name => ({
        name,
        description: name === '--fg-color-text' ? 'Text color.' : `Font ${name.endsWith('family') ? 'family' : 'size'}.`,
        light: '(page)',
        dark: dark.get(name) || '',
      }));
    const groups = [];

    lightComponents.forEach((declaration) => {
      let group = groups.find(({ name }) => name === declaration.group);

      if (!group) {
        group = { name: declaration.group, rows: [] };
        groups.push(group);
      }
      group.rows.push(row(declaration));
    });

    return { base: [...lightBase.map(row), ...unsetBase], groups };
  },
};
