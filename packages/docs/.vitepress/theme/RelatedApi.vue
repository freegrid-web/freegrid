<script setup>
// A searchable, alphabetical list of API entries in the right-hand column (on narrow screens, at the end of the page):
// - on guide pages, "Related API": every method, event and setting of the topics in the frontmatter
//   (`api: [Data, Hooks API]`);
// - on the reference pages, the index of the page (`apiIndex: setting`, written by api/generate.mjs).
import { computed, ref } from 'vue';
import { useData, withBase } from 'vitepress';
import { data } from '../../api/related.data.mjs';

const props = defineProps({
  place: { type: String, default: 'aside' }, // 'aside' or 'bottom'
});

const KINDS = [['setting', 'Settings'], ['method', 'Methods'], ['event', 'Events'], ['plugin-method', 'Plugin methods']];
const { frontmatter } = useData();
const query = ref('');

const index = computed(() => frontmatter.value.apiIndex);
const topics = computed(() => (frontmatter.value.api || []).filter(name => data.topics.includes(name)));
const title = computed(() => (index.value ? `All ${KINDS.find(([kind]) => kind === index.value)?.[1].toLowerCase()}` : 'Related API'));
// The reference pages are the list themselves on narrow screens: their index is shown in the right-hand column only.
const shown = computed(() => (index.value ? props.place === 'aside' : topics.value.length > 0));

// Plugin methods are listed under their plugin, without its name.
const label = entry => `${entry.kind === 'plugin-method' ? entry.name.split('.')[1] : entry.name}${entry.kind.endsWith('method') ? '()' : ''}`;
const groups = computed(() => {
  const words = query.value.trim().toLowerCase();
  const entries = data.entries
    .filter(entry => (index.value ? entry.kind === index.value : topics.value.includes(entry.topic)))
    .filter(entry => !words || entry.name.toLowerCase().includes(words))
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));

  const plugins = [...new Set(entries.filter(entry => entry.kind === 'plugin-method').map(entry => entry.name.split('.')[0]))];

  return [
    ...KINDS.filter(([kind]) => kind !== 'plugin-method')
      .map(([kind, name]) => ({ name, items: entries.filter(entry => entry.kind === kind) })),
    // One group per plugin, in alphabetical order.
    ...plugins.sort().map(plugin => ({
      name: plugin,
      plugin: true,
      items: entries.filter(entry => entry.kind === 'plugin-method' && entry.name.startsWith(`${plugin}.`)),
    })),
  ].filter(group => group.items.length);
});
const total = computed(() => groups.value.reduce((sum, group) => sum + group.items.length, 0));
</script>

<template>
  <nav v-if="shown" class="related-api" :class="`related-api--${place}`" :aria-label="title">
    <div class="related-api__title">{{ title }}</div>
    <input v-model="query" class="related-api__search" type="search" placeholder="Filter…"
      :aria-label="`Filter ${title.toLowerCase()}`">
    <p v-if="!total" class="related-api__empty">Nothing matches “{{ query }}”.</p>
    <div v-for="group in groups" :key="group.name" class="related-api__group">
      <div v-if="!index || group.plugin" class="related-api__label">
        {{ group.name }} <span>{{ group.items.length }}</span>
      </div>
      <ul>
        <li v-for="item in group.items" :key="item.link">
          <a :href="withBase(item.link)" :title="item.topic"><code>{{ label(item) }}</code></a>
        </li>
      </ul>
    </div>
  </nav>
</template>

<style scoped>
.related-api {
  font-size: 13px;
}

.related-api--aside {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--vp-c-divider);
}

.related-api--bottom {
  margin: 32px 0;
  padding: 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
}

/* VitePress shows the right-hand column from 1280px: the bottom copy is for narrower screens only. */
@media (min-width: 1280px) {
  .related-api--bottom {
    display: none;
  }
}

.related-api__title {
  margin-bottom: 8px;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.related-api__search {
  box-sizing: border-box;
  width: 100%;
  margin-bottom: 8px;
  padding: 4px 8px;
  font: inherit;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
}

.related-api__search:focus {
  border-color: var(--vp-c-brand-1);
  outline: none;
}

.related-api__empty {
  margin: 4px 0;
  color: var(--vp-c-text-2);
}

.related-api__group {
  margin: 8px 0 12px;
}

.related-api__label {
  margin-bottom: 2px;
  font-weight: 500;
  color: var(--vp-c-text-2);
}

.related-api__label span {
  font-weight: normal;
  color: var(--vp-c-text-3);
}

.related-api ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.related-api li {
  margin: 0;
  line-height: 22px;
}

.related-api a {
  display: block;
  overflow: hidden;
  color: var(--vp-c-text-2);
  text-decoration: none;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.related-api a:hover {
  color: var(--vp-c-brand-1);
}

.related-api code {
  font-size: 12px;
  background: none;
  padding: 0;
  color: inherit;
}
</style>
