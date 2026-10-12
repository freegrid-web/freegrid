<script setup>
// Renders packages/docs/examples/<name>.js in the browser only: FreeGrid needs `window` when imported.
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useData } from 'vitepress';

const props = defineProps({
  name: { type: String, required: true },
  height: { type: String, default: '' },
});

const { isDark } = useData();
const examples = import.meta.glob('../../examples/*.js');
const container = ref(null);
const error = ref('');
let instance = null;

onMounted(async() => {
  const load = examples[`../../examples/${props.name}.js`];

  if (!load) {
    error.value = `Unknown example "${props.name}".`;
    return;
  }
  try {
    const module = await load();

    instance = module.default(container.value);
  } catch (e) {
    error.value = e.message;
    throw e;
  }
});

onBeforeUnmount(() => {
  if (instance && !instance.isDestroyed) {
    instance.destroy();
  }
});
</script>

<template>
  <div class="live-example vp-raw" :class="{ 'fg-theme-dark': isDark }">
    <div ref="container" class="live-example__grid" :style="height ? { height, overflow: 'hidden' } : null" />
    <p v-if="error" class="live-example__error">{{ error }}</p>
  </div>
</template>
