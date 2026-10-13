<script setup>
// Live theme editor for the Theming page: a grid, a light/dark/auto switch, presets and editors for the base
// variables. Edits go into a <style> rule for the playground grid and FreeGrid's floating elements (menus, comment
// editor, date picker), so they apply in every theme; the panel shows the CSS to copy.
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useData } from 'vitepress';
import { GRID_STYLES as STYLES, gridStyle, loadGridStyle } from './gridStyle';

const props = defineProps({
  // Base variables from theming.data.mjs: [{ name, description, light, modern, dark }].
  variables: { type: Array, required: true },
});

// Icons: 16×16 SVG paths (sun, moon, half-filled circle for "follow the system").
const THEMES = [
  { value: 'light', label: 'Light', icon: 'M8 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7ZM8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3 3l1 1M12 12l1 1M3 13l1-1M12 4l1-1' },
  { value: 'dark', label: 'Dark', icon: 'M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7Z' },
  { value: 'auto', label: 'Auto', icon: 'M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM8 1.5v13' },
];
const LABELS = {
  '--fg-color-background': 'Background',
  '--fg-color-text': 'Text',
  '--fg-color-border': 'Grid lines',
  '--fg-color-header-background': 'Header',
  '--fg-color-header-text': 'Header text',
  '--fg-color-accent': 'Accent',
  '--fg-color-invalid': 'Invalid cell',
  '--fg-color-readonly-text': 'Read-only text',
  '--fg-color-muted-text': 'Muted text',
};
const FONTS = [
  { label: 'Page font', value: '' },
  { label: 'System', value: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
  { label: 'Serif', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Monospace', value: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' },
];
const PRESETS = [
  { name: 'Default', swatch: '#4b89ff', theme: null, values: {} },
  {
    name: 'Ocean', swatch: '#0284c7', theme: 'light',
    values: {
      '--fg-color-border': '#cfe0ea', '--fg-color-header-background': '#e8f2f8',
      '--fg-color-header-text': '#0b3a53', '--fg-color-accent': '#0284c7',
    },
  },
  {
    name: 'Forest', swatch: '#15803d', theme: 'light',
    values: {
      '--fg-color-border': '#d4e3d6', '--fg-color-header-background': '#edf5ee',
      '--fg-color-header-text': '#1f3d27', '--fg-color-accent': '#15803d',
    },
  },
  {
    name: 'Rose', swatch: '#e11d48', theme: 'light',
    values: {
      '--fg-color-border': '#f1d5dc', '--fg-color-header-background': '#fdf0f3',
      '--fg-color-header-text': '#5c1a2b', '--fg-color-accent': '#e11d48',
    },
  },
  {
    name: 'Slate', swatch: '#0f172a', theme: 'dark',
    values: {
      '--fg-color-background': '#0f172a', '--fg-color-text': '#e2e8f0', '--fg-color-border': '#1e293b',
      '--fg-color-header-background': '#1e293b', '--fg-color-header-text': '#cbd5e1', '--fg-color-accent': '#38bdf8',
    },
  },
];
const TARGETS = '.theme-playground__frame, .fg-context-menu, .fg-comments-container, .fg-datepicker-holder';

const container = ref(null);
const theme = ref('light');
const changed = reactive({});
const copied = ref(false);
const systemDark = ref(false);
let grid = null;
let createGrid = null;
let style = null;
let media = null;

const toHex = (value) => {
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(value || '');

  if (short) {
    return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase();
  }

  return /^#[0-9a-f]{6}$/i.test(value || '') ? value.toLowerCase() : '';
};
const isDark = computed(() => theme.value === 'dark' || (theme.value === 'auto' && systemDark.value));
const colors = computed(() => props.variables.filter(({ name }) => LABELS[name]));
const styleDefault = variable => (gridStyle.value === 'modern' && variable.modern) || variable.light;
const themeDefault = variable => toHex(isDark.value ? (variable.dark || styleDefault(variable)) : styleDefault(variable));
// The swatch and hex shown for a variable: the edited value, else the active theme's default ('' = from the page).
const valueOf = variable => changed[variable.name] ?? themeDefault(variable);
// Modern has its own font (14px); Classic uses the page's.
const fontSize = computed(() => parseInt(changed['--fg-font-size'], 10) || (gridStyle.value === 'modern' ? 14 : 13));
const unsetLabel = computed(() => (gridStyle.value === 'modern' ? 'Modern' : 'page'));
const css = computed(() => {
  const lines = Object.entries(changed).map(([name, value]) => `  ${name}: ${value};`);

  return lines.length ? `:root {\n${lines.join('\n')}\n}` : '/* Pick a preset or change a value. */';
});
const activePreset = computed(() => PRESETS.find(preset => JSON.stringify(preset.values) === JSON.stringify({ ...changed }))?.name);

const set = (name, value) => {
  if (value === '' || value === undefined || value === null) {
    delete changed[name];
  } else {
    changed[name] = value;
  }
};
const setHex = (name, value) => {
  const hex = toHex(value.trim().startsWith('#') ? value.trim() : `#${value.trim()}`);

  if (hex) {
    set(name, hex);
  }
};
const reset = () => Object.keys(changed).forEach(name => delete changed[name]);
const applyPreset = (preset) => {
  reset();
  Object.entries(preset.values).forEach(([name, value]) => set(name, value));
  if (preset.theme) {
    theme.value = preset.theme;
  }
};
const copy = async() => {
  await navigator.clipboard?.writeText(css.value);
  copied.value = true;
  setTimeout(() => { copied.value = false; }, 1500);
};
const onSystemChange = (event) => { systemDark.value = event.matches; };

// A new grid for the new style, so the row height (--fg-row-height) and the column widths are measured again.
watch(gridStyle, async() => {
  await nextTick();
  if (createGrid && container.value) {
    grid?.destroy();
    grid = createGrid(container.value);
  }
});

watch(changed, () => {
  if (style) {
    const lines = Object.entries(changed).map(([name, value]) => `${name}: ${value};`);

    style.textContent = lines.length ? `${TARGETS} { ${lines.join(' ')} }` : '';
  }
}, { deep: true });

const { isDark: docsDark } = useData();

onMounted(async() => {
  loadGridStyle();
  // Light in the built HTML; the docs' own mode after mount (hydration would keep a server-rendered value).
  theme.value = docsDark.value ? 'dark' : 'light';
  media = window.matchMedia('(prefers-color-scheme: dark)');
  systemDark.value = media.matches;
  media.addEventListener('change', onSystemChange);
  style = document.createElement('style');
  document.head.appendChild(style);
  const module = await import('../../examples/theming.js');

  createGrid = module.default;
  grid = createGrid(container.value);
});

onBeforeUnmount(() => {
  media?.removeEventListener('change', onSystemChange);
  style?.remove();
  if (grid && !grid.isDestroyed) {
    grid.destroy();
  }
});
</script>

<template>
  <div class="theme-playground vp-raw">
    <div class="tp-toolbar">
      <div class="tp-segmented" role="radiogroup" aria-label="Theme">
        <button v-for="option in THEMES" :key="option.value" type="button" role="radio"
          :aria-checked="theme === option.value" :class="{ active: theme === option.value }"
          @click="theme = option.value">
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path :d="option.icon" /></svg>{{ option.label }}
        </button>
      </div>
      <div class="tp-segmented" role="radiogroup" aria-label="Style">
        <button v-for="option in STYLES" :key="option.value" type="button" role="radio"
          :aria-checked="gridStyle === option.value" :class="{ active: gridStyle === option.value }"
          @click="gridStyle = option.value">{{ option.label }}</button>
      </div>
      <div class="tp-presets" aria-label="Presets">
        <span class="tp-label">Presets</span>
        <button v-for="preset in PRESETS" :key="preset.name" type="button" class="tp-preset"
          :class="{ active: activePreset === preset.name }" :title="preset.name" :aria-label="`${preset.name} preset`"
          :style="{ '--tp-swatch': preset.swatch }" @click="applyPreset(preset)" />
      </div>
    </div>

    <div class="tp-body">
      <div class="tp-panel">
        <div class="tp-section">Colors</div>
        <div v-for="variable in colors" :key="variable.name" class="tp-color" :title="`${variable.name}: ${variable.description}`">
          <label class="tp-swatch" :style="{ '--tp-swatch': valueOf(variable) || 'transparent' }"
            :class="{ empty: !valueOf(variable) }">
            <input type="color" :value="valueOf(variable) || '#000000'" :aria-label="LABELS[variable.name]"
              @input="set(variable.name, $event.target.value)">
          </label>
          <span class="tp-name">{{ LABELS[variable.name] }}</span>
          <input class="tp-hex" type="text" spellcheck="false" :value="valueOf(variable) || 'page'"
            :aria-label="`${LABELS[variable.name]} hex`" @change="setHex(variable.name, $event.target.value)">
        </div>

        <div class="tp-section">Typography</div>
        <label class="tp-field">
          <span class="tp-name">Font</span>
          <select :value="changed['--fg-font-family'] || ''" @change="set('--fg-font-family', $event.target.value)">
            <option v-for="font in FONTS" :key="font.label" :value="font.value">
              {{ font.value ? font.label : `${unsetLabel === 'page' ? 'Page' : 'Modern'} font` }}
            </option>
          </select>
        </label>
        <label class="tp-field">
          <span class="tp-name">Size</span>
          <input type="range" min="11" max="16" :value="fontSize"
            @input="set('--fg-font-size', `${$event.target.value}px`)">
          <span class="tp-size">{{ changed['--fg-font-size'] ? `${fontSize}px` : unsetLabel }}</span>
        </label>
      </div>

      <div class="theme-playground__frame" :data-fg-theme="theme === 'light' ? null : theme"
        :data-fg-style="gridStyle">
        <div ref="container" class="theme-playground__grid" />
      </div>
    </div>

    <div class="tp-output">
      <div class="tp-output-bar">
        <span class="tp-label">CSS</span>
        <div class="tp-actions">
          <button type="button" @click="copy">{{ copied ? 'Copied' : 'Copy' }}</button>
          <button type="button" @click="reset">Reset</button>
        </div>
      </div>
      <pre><code>{{ css }}</code></pre>
    </div>
  </div>
</template>

<style scoped>
.theme-playground {
  margin: 20px 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
  overflow: hidden;
  font-size: 14px;
}

.tp-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--vp-c-divider);
}

.tp-segmented {
  display: inline-flex;
  padding: 3px;
  border-radius: 8px;
  background: var(--vp-c-default-soft);
}

.tp-segmented button {
  border: 0;
  background: transparent;
  display: inline-flex;
  gap: 6px;
  align-items: center;
  padding: 4px 12px;
  border-radius: 6px;
  color: var(--vp-c-text-2);
  font-weight: 500;
  transition: background-color 0.2s, color 0.2s;
}

.tp-segmented svg {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.tp-segmented button[aria-checked="true"]:last-child svg path {
  fill: none;
}

.tp-segmented button:hover {
  color: var(--vp-c-text-1);
}

.tp-segmented button.active {
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
}

.tp-presets {
  display: flex;
  gap: 8px;
  align-items: center;
}

.tp-label,
.tp-section {
  color: var(--vp-c-text-2);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.tp-preset {
  width: 22px;
  height: 22px;
  border: 2px solid var(--vp-c-bg);
  border-radius: 50%;
  background: var(--tp-swatch);
  box-shadow: 0 0 0 1px var(--vp-c-divider);
  transition: transform 0.15s, box-shadow 0.15s;
}

.tp-preset:hover {
  transform: scale(1.12);
}

.tp-preset.active {
  box-shadow: 0 0 0 2px var(--vp-c-brand-1);
}

.tp-body {
  display: grid;
  grid-template-columns: 260px 1fr;
  min-height: 300px;
}

.tp-panel {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px 16px 16px;
  border-right: 1px solid var(--vp-c-divider);
}

.tp-section {
  margin: 10px 0 6px;
}

.tp-section:first-child {
  margin-top: 0;
}

.tp-color,
.tp-field {
  display: flex;
  gap: 10px;
  align-items: center;
  min-height: 30px;
}

.tp-name {
  flex: 1;
  color: var(--vp-c-text-1);
}

.tp-swatch {
  position: relative;
  flex: none;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: var(--tp-swatch);
  box-shadow: inset 0 0 0 1px rgba(128, 128, 128, 0.35);
  cursor: pointer;
}

.tp-swatch.empty {
  background: repeating-conic-gradient(var(--vp-c-divider) 0% 25%, transparent 0% 50%) 50% / 10px 10px;
}

.tp-swatch input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.tp-hex {
  width: 78px;
  padding: 2px 6px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--vp-c-text-2);
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  text-align: right;
}

.tp-hex:hover,
.tp-hex:focus {
  border-color: var(--vp-c-divider);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  outline: none;
}

.tp-field select {
  flex: none;
  width: 130px;
  padding: 3px 8px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
}

.tp-field input[type="range"] {
  flex: none;
  width: 90px;
  accent-color: var(--vp-c-brand-1);
}

.tp-size {
  width: 36px;
  color: var(--vp-c-text-2);
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  text-align: right;
}

.theme-playground__frame {
  /* The page around the grid keeps the docs' background: the variables style the grid only, as on a real page. */
  padding: 16px;
  background: var(--vp-c-bg);
  color: var(--fg-color-text, #222);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  font-size: 13px;
  line-height: normal;
}

.theme-playground__grid {
  height: 240px;
  overflow: hidden;
}

.tp-output {
  border-top: 1px solid var(--vp-c-divider);
}

.tp-output-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
}

.tp-actions {
  display: flex;
  gap: 8px;
}

.tp-actions button {
  padding: 3px 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 13px;
  font-weight: 500;
  transition: border-color 0.2s;
}

.tp-actions button:hover {
  border-color: var(--vp-c-brand-1);
}

.tp-output pre {
  margin: 0;
  padding: 0 16px 14px;
  background: transparent;
  color: var(--vp-c-text-1);
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  white-space: pre-wrap;
}

@media (max-width: 768px) {
  .tp-body {
    grid-template-columns: 1fr;
  }

  .tp-panel {
    border-right: 0;
    border-bottom: 1px solid var(--vp-c-divider);
  }
}
</style>
