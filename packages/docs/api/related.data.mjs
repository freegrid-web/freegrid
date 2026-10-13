// The API reference's entries for the right-hand lists (RelatedApi.vue): "Related API" on guide pages and the index
// of each reference page.
import { buildReference, sourceFiles } from './reference.mjs';

export default {
  watch: sourceFiles(),
  load() {
    const { topics, methods, events, settings, plugins } = buildReference();
    const pluginMethods = plugins.flatMap(plugin => plugin.methods
      .map(method => ({ ...method, kind: 'plugin-method', name: `${plugin.name}.${method.name}`, topic: 'Plugins' })));

    return {
      topics: topics.map(({ name }) => name),
      entries: [...methods, ...events, ...settings, ...pluginMethods]
        .map(({ kind, name, topic, page, anchor }) => ({ kind, name, topic, link: `/api/${page}#${anchor}` })),
    };
  },
};
