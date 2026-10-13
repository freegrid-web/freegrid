<script setup>
// "Related API": every method, event and setting of the topics a guide page names in its frontmatter
// (`api: [Data, Hooks API]`), linked into the API reference. In the right-hand column on wide screens, at the end of
// the page on narrow ones (where VitePress has no right-hand column).
import { computed } from 'vue';
import { useData, withBase } from 'vitepress';
import { data } from '../../api/related.data.mjs';

defineProps({
  place: { type: String, default: 'aside' }, // 'aside' or 'bottom'
});

const KINDS = [['method', 'Methods'], ['event', 'Events'], ['setting', 'Settings']];
const { frontmatter } = useData();
const topics = computed(() => (frontmatter.value.api || [])
  .filter(name => data.topics.includes(name))
  .map(name => ({
    name,
    groups: KINDS
      .map(([kind, label]) => ({ label, items: data.entries.filter(entry => entry.topic === name && entry.kind === kind) }))
      .filter(group => group.items.length),
  })));
</script>

<template>
  <nav v-if="topics.length" class="related-api" :class="`related-api--${place}`" aria-label="Related API">
    <div class="related-api__title">Related API</div>
    <details v-for="topic in topics" :key="topic.name" class="related-api__topic" open>
      <summary>{{ topic.name }}</summary>
      <div v-for="group in topic.groups" :key="group.label" class="related-api__group">
        <div class="related-api__label">{{ group.label }}</div>
        <ul>
          <li v-for="item in group.items" :key="item.link">
            <a :href="withBase(item.link)"><code>{{ item.name }}{{ item.kind === 'method' ? '()' : '' }}</code></a>
          </li>
        </ul>
      </div>
    </details>
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

.related-api__topic summary {
  padding: 4px 0;
  font-weight: 500;
  color: var(--vp-c-text-1);
  cursor: pointer;
}

.related-api__group {
  margin: 4px 0 8px 12px;
}

.related-api__label {
  color: var(--vp-c-text-2);
}

.related-api ul {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 8px;
  margin: 2px 0 0;
  padding: 0;
  list-style: none;
}

.related-api a {
  color: var(--vp-c-brand-1);
  text-decoration: none;
}

.related-api a:hover code {
  text-decoration: underline;
}

.related-api code {
  font-size: 12px;
  background: none;
  padding: 0;
  color: inherit;
}
</style>
