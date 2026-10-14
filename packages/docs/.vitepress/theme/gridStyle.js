// The grid style (Modern or Classic) of every live example in the docs, chosen in the nav bar and remembered in this
// browser. Modern by default.
import { ref, watch } from 'vue';

const KEY = 'freesheet-docs-grid-style';

export const GRID_STYLES = [
  { value: 'modern', label: 'Modern' },
  { value: 'classic', label: 'Classic' },
];

export const gridStyle = ref('modern');

let loaded = false;

// Called after mount: the built HTML is rendered with the default, and storage only exists in the browser.
export const loadGridStyle = () => {
  if (loaded) {
    return;
  }
  loaded = true;
  try {
    const saved = localStorage.getItem(KEY);

    if (GRID_STYLES.some(({ value }) => value === saved)) {
      gridStyle.value = saved;
    }
  } catch {
    // No storage (private mode, blocked site data): keep the default.
  }
  watch(gridStyle, (value) => {
    try {
      localStorage.setItem(KEY, value);
    } catch {
      // Not remembered; the choice still applies to this page.
    }
  });
};
