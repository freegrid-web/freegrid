<script setup>
// Renders packages/docs/examples/<name>.js in the browser only: FreeSheet needs `window` when imported.
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useData } from 'vitepress';
import { gridStyle, loadGridStyle } from './gridStyle';

const props = defineProps({
  name: { type: String, required: true },
  height: { type: String, default: '' },
});

const { isDark } = useData();
// Set after mount: the built HTML is rendered without knowing the reader's appearance, and hydration keeps classes.
const mounted = ref(false);
const examples = import.meta.glob('../../examples/*.js');
const container = ref(null);
const error = ref('');
let instance = null;
let create = null;

onMounted(async() => {
  loadGridStyle();
  mounted.value = true;
  const load = examples[`../../examples/${props.name}.js`];

  if (!load) {
    error.value = `Unknown example "${props.name}".`;
    return;
  }
  try {
    const module = await load();

    create = module.default;
    await nextTick();
    instance = create(container.value);
  } catch (e) {
    error.value = e.message;
    throw e;
  }
});

// A new grid for the new style, so the row height (--fg-row-height) and the column widths are measured again.
watch(gridStyle, async() => {
  await nextTick();
  if (create && container.value) {
    instance?.destroy();
    instance = create(container.value);
  }
});

onBeforeUnmount(() => {
  if (instance && !instance.isDestroyed) {
    instance.destroy();
  }
});
</script>

<template>
  <div class="live-example vp-raw" :class="{ 'fg-theme-dark': mounted && isDark }"
    :data-fg-style="mounted ? gridStyle : null">
    <div ref="container" class="live-example__grid" :style="height ? { height, overflow: 'hidden' } : null" />
    <p v-if="error" class="live-example__error">{{ error }}</p>
  </div>
</template>
