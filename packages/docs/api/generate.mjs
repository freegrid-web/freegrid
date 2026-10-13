// Writes the API reference pages (methods.md, events.md, settings.md, plugins.md in this folder) from the source
// code's JSDoc, before every docs build and dev start. The pages are not committed: the code is their source.
import { writeFileSync } from 'node:fs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { anchor } from './jsdoc.mjs';
import { buildReference } from './reference.mjs';

const HERE = new URL('.', import.meta.url);

/**
 * Text that markdown and Vue must show as written: HTML tags and `{{ }}` outside code spans are escaped.
 */
export const safe = (text = '') => text.split(/(`[^`]*`)/).map((part, index) => (index % 2 ? part : part
  .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\{/g, '&#123;').replace(/\}/g, '&#125;'))).join('');

// A table cell: backslashes first, so that an escaped pipe in the text stays one character.
const cell = text => safe(text).replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const type = (value, inTable = false) => (value ? `\`${value.replace(/\|/g, inTable ? ' \\| ' : ' | ')}\`` : '');
// A fenced code block; a closing fence written at the end of the last code line gets its own line.
const example = code => (code.startsWith('```') ? code.replace(/([^\n])```$/, '$1\n```') : `\`\`\`js\n${code}\n\`\`\``);

const paramsTable = (params, heading) => (params.length ? [
  `| ${heading} | Type | Description |`,
  '| --- | --- | --- |',
  ...params.map(({ name, type: paramType, optional, default: value, description }) => {
    const note = optional ? `Optional${value !== undefined ? `, default \`${value}\`` : ''}. ` : '';

    return `| \`${name}\` | ${type(paramType, true)} | ${note}${cell(description)} |`;
  }),
  '',
] : []);

const common = entry => [
  ...(entry.deprecated ? [`**Deprecated.** ${entry.deprecated === true ? '' : safe(entry.deprecated)}`, ''] : []),
  safe(entry.description),
  '',
];
// Code in a collapsible block: the source code's examples, or a usage example written from the signature.
const collapsible = (summary, blocks) => [`::: details ${summary}`, ...blocks.map(example), ':::', ''];
const examples = (entry, usage) => {
  if (entry.examples.length) {
    return collapsible('Example', entry.examples);
  }

  return usage ? collapsible('Usage', [usage]) : [];
};

const camel = name => name[0].toLowerCase() + name.slice(1);
const args = params => params.filter(({ optional }) => !optional).map(({ name }) => name.replace(/\W/g, '')).join(', ');

const methodUsage = (entry) => {
  const target = entry.owner && entry.owner !== 'Core' ? `grid.getPlugin('${camel(entry.owner)}')` : 'grid';

  return `${entry.returns ? 'const result = ' : ''}${target}.${entry.name}(${args(entry.params)});`;
};

const eventUsage = (entry) => {
  const list = entry.params.map(({ name }) => name.replace(/\W/g, '')).join(', ');

  return [
    'new FreeGrid(element, {',
    `  ${entry.name}(${list}) {`,
    '    // …',
    '  },',
    '});',
    '',
    '// or later',
    `grid.addHook('${entry.name}', (${list}) => {`,
    '  // …',
    '});',
  ].join('\n');
};

// A value of the setting's type for the usage example: the other boolean, the default, or a plain value.
const sampleValue = (types = '', fallback = '') => {
  const first = types.split('|')[0].trim();

  if (/^(true|false)$/.test(fallback)) {
    return fallback === 'true' ? 'false' : 'true';
  }
  if (first === 'Number') {
    return /^[1-9][\d.]*$/.test(fallback) ? fallback : '100';
  }
  if (first === 'String') {
    return /^'.*'$/.test(fallback) ? fallback : "'value'";
  }

  return { Boolean: 'true', Function: '() => {}', Object: '{}' }[first] ?? (first.endsWith('[]') || first === 'Array' ? '[]' : 'true');
};

const settingUsage = (entry) => {
  const value = sampleValue(entry.type, entry.default);

  return [
    'new FreeGrid(element, {',
    `  ${entry.name}: ${value},`,
    '});',
    '',
    '// or later',
    `grid.updateSettings({ ${entry.name}: ${value} });`,
  ].join('\n');
};

export const methodSection = (entry, title = entry.name) => [
  `### ${title}(${entry.params.map(({ name, optional }) => (optional ? `[${name}]` : name)).join(', ')}) {#${entry.anchor}}`,
  '',
  ...common(entry),
  ...paramsTable(entry.params, 'Parameter'),
  ...(entry.returns ? [`**Returns** ${type(entry.returns.type)}${entry.returns.description ? ` — ${safe(entry.returns.description)}` : ''}`, ''] : []),
  ...examples(entry, methodUsage(entry)),
].join('\n');

export const eventSection = entry => [
  `### ${entry.name} {#${entry.anchor}}`,
  '',
  ...common(entry),
  ...paramsTable(entry.params, 'Argument'),
  ...examples(entry, eventUsage(entry)),
].join('\n');

export const settingSection = entry => [
  `### ${entry.name} {#${entry.anchor}}`,
  '',
  `Type: ${type(entry.type) || 'any'} · Default: \`${entry.default}\``,
  '',
  ...common(entry),
  ...examples(entry, settingUsage(entry)),
].join('\n');

const byTopic = (topics, entries, section) => topics
  .map(topic => ({ topic, entries: entries.filter(entry => entry.topic === topic.name) }))
  .filter(({ entries: list }) => list.length)
  .flatMap(({ topic, entries: list }) => [
    `## ${topic.name} {#topic-${anchor(topic.name)}}`,
    '',
    ...(topic.description ? [topic.description, ''] : []),
    ...list.map(section),
  ]);

const page = (title, intro, body, index) => [
  '---',
  'outline: [2, 2]',
  `apiIndex: ${index}`,
  'editLink: false',
  '---',
  '',
  '<!-- Generated by api/generate.mjs from FreeGrid\'s source code. Do not edit. -->',
  '',
  `# ${title}`,
  '',
  intro,
  '',
  '::::: v-pre',
  '',
  ...body,
  ':::::',
  '',
].join('\n');

/**
 * Links into the reference whose anchor does not exist (e.g. to an internal class) become plain text.
 * `anchors` maps a page (`methods`) to the anchors on it.
 */
export const unlinkMissing = (text, anchors) => text.replace(/\[([^\]]+)\]\(\.\/(\w+)#([\w-]+)\)/g,
  (link, label, page, id) => (anchors[page] && !anchors[page].has(id) ? label : link));

export const generate = () => {
  const reference = buildReference();
  const settingNames = new Set(reference.settings.map(({ name }) => name));
  const pages = {
    'methods.md': page('Methods', 'Every method of a grid (`const grid = new FreeGrid(element, settings)`, then '
      + '`grid.getData()`), by topic. Row and column numbers are visual indexes unless a description says otherwise.',
    byTopic(reference.topics, reference.methods, entry => methodSection(entry)), 'method'),
    'events.md': page('Events', 'Every event (hook), by topic. Listen to an event with a setting of the same name '
      + '(`new FreeGrid(element, { afterChange(changes, source) { … } })`) or with `grid.addHook(\'afterChange\', '
      + 'callback)`; see [Data and events](../guide/data-and-events#events-hooks). Events whose name starts with '
      + '`before` can cancel the action by returning `false` where their description says so.',
    byTopic(reference.topics, reference.events, eventSection), 'event'),
    'settings.md': page('Settings', 'Every setting, by topic. Settings go to the constructor '
      + '(`new FreeGrid(element, { colHeaders: true })`), to `grid.updateSettings({ … })`, and most of them also to '
      + '`columns`, `cells` and `cell` for some cells only; see [Configuration](../guide/configuration).',
    byTopic(reference.topics, reference.settings, settingSection), 'setting'),
    'plugins.md': page('Plugins', 'The built-in plugins. Each is switched on by its setting; its methods are '
      + 'called on the plugin object: `grid.getPlugin(\'columnSorting\').sort({ column: 0, sortOrder: \'asc\' })`.',
    reference.plugins.flatMap((plugin) => {
      const setting = plugin.name[0].toLowerCase() + plugin.name.slice(1);

      return [
        `## ${plugin.name} {#${plugin.anchor}}`,
        '',
        ...(settingNames.has(setting) ? [`Setting: [\`${setting}\`](./settings#${setting.toLowerCase()}) · `
          + `\`grid.getPlugin('${setting}')\``, ''] : [`\`grid.getPlugin('${setting}')\``, '']),
        safe(plugin.description),
        '',
        ...examples(plugin),
        ...plugin.methods.map(method => methodSection(method, `${plugin.name}.${method.name}`)),
      ];
    }), 'plugin-method'),
  };

  const ids = text => new Set([...text.matchAll(/\{#([\w-]+)\}/g)].map(([, id]) => id));
  const anchors = Object.fromEntries(Object.entries(pages).map(([file, text]) => [file.replace('.md', ''), ids(text)]));

  Object.entries(pages).forEach(([file, text]) => writeFileSync(fileURLToPath(new URL(file, HERE)), unlinkMissing(text, anchors)));

  return Object.keys(pages);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(`API reference: wrote ${generate().join(', ')}.`);
}
