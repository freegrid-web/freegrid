<script setup>
// Live theme editor for the Theming page: a grid, a light/dark/auto switch and editors for the base variables. The
// edits go into a <style> rule for the playground and FreeGrid's floating elements (menus, comment editor, date
// picker), so they apply in every theme; the panel shows the CSS to copy.
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useData } from 'vitepress';

const props = defineProps({
  // Base variables from theming.data.mjs: [{ name, description, light, dark }].
  variables: { type: Array, required: true },
});

const THEMES = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'auto', label: 'Auto (system)' },
];
const TARGETS = '.theme-playground, .fg-context-menu, .fg-comments-container, .fg-datepicker-holder';

const container = ref(null);
const { isDark: docsDark } = useData();
// Light in the built HTML; switched to the docs' own mode after mount (hydration would keep a server value).
const theme = ref('light');
const changed = reactive({});
let grid = null;
let style = null;

const toHex = (value) => {
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(value);

  if (short) {
    return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  }

  return /^#[0-9a-f]{6}$/i.test(value) ? value : '';
};
const isDark = () => theme.value === 'dark' ||
  (theme.value === 'auto' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
const colors = computed(() => props.variables.filter(({ name }) => name.startsWith('--fg-color-')));
const current = (variable) => {
  if (changed[variable.name] !== undefined) {
    return changed[variable.name];
  }
  const value = isDark() ? (variable.dark || variable.light) : variable.light;

  return toHex(value) || (isDark() ? '#e6e6e6' : '#000000');
};
const css = computed(() => {
  const lines = Object.entries(changed).map(([name, value]) => `  ${name}: ${value};`);

  return lines.length ? `:root {\n${lines.join('\n')}\n}` : '/* Change a value to see the CSS. */';
});

const set = (name, value) => {
  if (value === '' || value === undefined) {
    delete changed[name];
  } else {
    changed[name] = value;
  }
};
const reset = () => Object.keys(changed).forEach(name => delete changed[name]);
const copy = () => navigator.clipboard?.writeText(css.value);

watch(changed, () => {
  if (style) {
    const lines = Object.entries(changed).map(([name, value]) => `${name}: ${value};`);

    style.textContent = lines.length ? `${TARGETS} { ${lines.join(' ')} }` : '';
  }
}, { deep: true });

onMounted(async() => {
  theme.value = docsDark.value ? 'dark' : 'light';
  style = document.createElement('style');
  document.head.appendChild(style);
  const module = await import('../../examples/theming.js');

  grid = module.default(container.value);
});

onBeforeUnmount(() => {
  style?.remove();
  if (grid && !grid.isDestroyed) {
    grid.destroy();
  }
});
</script>

<template>
  <div class="theme-playground vp-raw" :data-fg-theme="theme === 'light' ? null : theme">
    <div class="theme-playground__controls">
      <div class="theme-playground__themes" role="radiogroup" aria-label="Theme">
        <button v-for="option in THEMES" :key="option.value" type="button" role="radio"
          :aria-checked="theme === option.value" :class="{ active: theme === option.value }"
          @click="theme = option.value">{{ option.label }}</button>
      </div>
      <div class="theme-playground__fields">
        <label v-for="variable in colors" :key="variable.name" :title="variable.description">
          <input type="color" :value="current(variable)" @input="set(variable.name, $event.target.value)">
          <code>{{ variable.name }}</code>
        </label>
        <label title="Font family">
          <input type="text" placeholder="page font" :value="changed['--fg-font-family'] || ''"
            @input="set('--fg-font-family', $event.target.value)">
          <code>--fg-font-family</code>
        </label>
        <label title="Font size">
          <input type="number" min="8" max="24" placeholder="page" :value="parseInt(changed['--fg-font-size'], 10) || ''"
            @input="set('--fg-font-size', $event.target.value ? `${$event.target.value}px` : '')">
          <code>--fg-font-size</code>
        </label>
      </div>
    </div>
    <div ref="container" class="theme-playground__grid" />
    <div class="theme-playground__output">
      <pre><code>{{ css }}</code></pre>
      <div class="theme-playground__actions">
        <button type="button" @click="copy">Copy CSS</button>
        <button type="button" @click="reset">Reset</button>
      </div>
    </div>
  </div>
</template>
