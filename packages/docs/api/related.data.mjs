// The API reference's entries for the "Related API" column of guide pages (RelatedApi.vue).
import { buildReference, sourceFiles } from './reference.mjs';

export default {
  watch: sourceFiles(),
  load() {
    const { topics, methods, events, settings } = buildReference();

    return {
      topics: topics.map(({ name }) => name),
      entries: [...methods, ...events, ...settings]
        .map(({ kind, name, topic, page, anchor }) => ({ kind, name, topic, link: `/api/${page}#${anchor}` })),
    };
  },
};
