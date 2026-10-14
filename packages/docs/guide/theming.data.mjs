// Reads FreeSheet's theme variables from packages/sheet/src/css/variables.css at docs build time, so the Theming
// page always lists exactly what the stylesheet defines.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const file = fileURLToPath(new URL('../../sheet/src/css/variables.css', import.meta.url));

// "--fs-name: value; /* description */" declarations of a rule body, with the "/* == Group == */" they follow.
function declarations(body) {
  const result = [];
  let group = '';

  body.split('\n').forEach((line) => {
    const heading = line.match(/\/\* == (.+?) == \*\//);

    if (heading) {
      group = heading[1];
      return;
    }
    const match = line.match(/^\s*(--fs-[\w-]+):\s*(.+?);\s*(?:\/\*\s*(.+?)\s*\*\/)?\s*$/);

    if (match) {
      result.push({ group, name: match[1], value: match[2], description: match[3] || '' });
    }
  });

  return result;
}

// The colors and the font that differ between Classic and Modern are style defaults (--fs-style-*): they are shown
// as the value of the base or component variable they stand in for.
const STYLE_GROUPS = [
  [/^--fs-header-/, 'Headers'],
  [/^--fs-selection-/, 'Selection'],
  [/^--fs-editor-/, 'Editors'],
  [/^--fs-menu-/, 'Context menu'],
  [/^--fs-datepicker-/, 'Date picker'],
];

export default {
  watch: [file],
  load() {
    // Comments are kept (they hold the descriptions and the group headings), except those with braces, such as the
    // usage examples in the file header, which would look like rules.
    const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, comment => (/[{}]/.test(comment) ? '' : comment));
    const rules = [...css.matchAll(/([^{}]*)\{([^{}]*)\}/g)]
      .map(([, selector, body]) => ({ selector: selector.replace(/\/\*[\s\S]*?\*\//g, '').trim(), body }));
    const find = predicate => declarations(rules.find(predicate)?.body || '');
    const unstyle = declaration => ({ ...declaration, name: declaration.name.replace(/^--fs-style-/, '--fs-') });
    // :root has the base variables (before the first group heading) and the component variables with their own
    // value; the grid's parts have the component variables that follow a base variable.
    const root = find(({ selector }) => selector === ':where(:root)');
    const styleDefaults = find(({ selector }) => selector.startsWith(':where(:root,')).map(unstyle);
    const modern = new Map(find(({ selector }) => selector.startsWith(':where(.fs-style-modern'))
      .map(unstyle).map(({ name, value }) => [name, value]));
    const dark = new Map(find(({ selector }) => selector.includes('fs-theme-dark'))
      .map(({ name, value }) => [name, value]));
    // var(--fs-color-border, var(--fs-style-color-border)) is shown as var(--fs-color-border).
    const shown = value => value.replace(/var\((--fs-[\w-]+), var\(--fs-style-[\w-]+(?:, ([^()]+))?\)\)/g,
      (match, name, fallback) => (fallback ? `var(${name}, ${fallback})` : `var(${name})`));
    const row = ({ name, value, description }) => ({
      name,
      description,
      light: shown(value),
      modern: modern.get(name) && modern.get(name) !== value ? modern.get(name) : '',
      dark: dark.get(name) || '',
    });
    const isColor = ({ name }) => /^--fs-color-/.test(name);
    const rootBase = root.filter(({ group }) => !group);
    const lightBase = [...rootBase.filter(isColor), ...styleDefaults.filter(isColor), ...rootBase.filter(d => !isColor(d))];
    const unsetBase = [['--fs-color-text', 'Text color.'], ['--fs-font-family', 'Font family.'], ['--fs-font-size', 'Font size.']]
      .map(([name, description]) => ({ name, description, light: '(page)', modern: modern.get(name) || '', dark: dark.get(name) || '' }));
    const components = [
      ...root.filter(({ group }) => group),
      ...find(({ selector }) => selector.startsWith(':where(.freesheet')),
      ...styleDefaults.filter(declaration => !isColor(declaration))
        .map(declaration => ({ ...declaration, group: STYLE_GROUPS.find(([pattern]) => pattern.test(declaration.name))?.[1] || '' })),
    ];
    const groups = [];

    components.forEach((declaration) => {
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
