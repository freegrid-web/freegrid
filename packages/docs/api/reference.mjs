// The API reference model: FreeSheet's methods, events, settings and plugins read from the source code's JSDoc,
// each with its topic and its page and anchor in the docs.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { anchor, parseBlocks, readPlugin, readSettings } from './jsdoc.mjs';
import { TOPICS, UNAVAILABLE, topicOf } from './topics.mjs';

export const SOURCE = new URL('../../freegrid/src/', import.meta.url).pathname;

const read = file => readFileSync(join(SOURCE, file), 'utf8');

/** `name.ts`, or `name.js` while the module is not converted yet. */
const moduleFile = name => [`${name}.ts`, `${name}.js`].find(file => existsSync(join(SOURCE, file)));

/** The source files the reference is read from (for watching). */
export const sourceFiles = () => [moduleFile('core'), moduleFile('pluginHooks'), moduleFile('defaultSettings'),
  ...pluginFiles()].map(file => join(SOURCE, file));

function pluginFiles() {
  return readdirSync(join(SOURCE, 'plugins'), { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .flatMap(({ name }) => ['js', 'ts'].map(extension => `plugins/${name}/${name}.${extension}`))
    .filter(file => existsSync(join(SOURCE, file)));
}

const withTopic = page => entry => ({ ...entry, topic: topicOf(entry.kind, entry.name), page, anchor: anchor(entry.name) });

export const buildReference = () => {
  const methods = parseBlocks(read(moduleFile('core')))
    .filter(block => block.kind === 'method' && block.owner === 'Core' && !block.private)
    .map(withTopic('methods'));
  const events = parseBlocks(read(moduleFile('pluginHooks')))
    .filter(block => block.kind === 'event' && !block.private && !UNAVAILABLE.has(block.name))
    .map(withTopic('events'));
  const settings = readSettings(read(moduleFile('defaultSettings')))
    .filter(setting => !UNAVAILABLE.has(setting.name))
    .map(withTopic('settings'));
  const plugins = pluginFiles()
    .map((file) => {
      const source = read(file);
      const plugin = readPlugin(source);

      if (!plugin) {
        return null;
      }
      // Older plugins document their methods with @memberof (e.g. UndoRedo#undo).
      const members = plugin.methods.length ? plugin.methods : parseBlocks(source)
        .filter(block => block.kind === 'method' && block.owner === plugin.name && !block.private);

      return {
        ...plugin,
        anchor: anchor(plugin.name),
        methods: members.map(method => ({ ...method, page: 'plugins', anchor: anchor(`${plugin.name}-${method.name}`) })),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));

  if (!methods.length || !events.length || !settings.length || !plugins.length) {
    throw new Error(`API reference: nothing read from ${SOURCE} (methods ${methods.length}, events ${events.length}, `
      + `settings ${settings.length}, plugins ${plugins.length}).`);
  }
  const unsorted = [...methods, ...events, ...settings].filter(entry => entry.topic === 'Other');

  if (unsorted.length) {
    console.warn(`API reference: no topic for ${unsorted.map(({ kind, name }) => `${kind} ${name}`).join(', ')} `
      + '(add them to packages/docs/api/topics.mjs).');
  }

  return { topics: [...TOPICS.map(({ name, description }) => ({ name, description })), { name: 'Other', description: '' }],
    methods, events, settings, plugins };
};
