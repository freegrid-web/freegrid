<script setup>
// "Grid style" switch in the nav bar: Modern or Classic for every live example.
import { onMounted } from 'vue';
import { GRID_STYLES, gridStyle, loadGridStyle } from './gridStyle';

onMounted(loadGridStyle);
</script>

<template>
  <div class="style-switch" role="radiogroup" aria-label="Grid style" title="Grid style of the examples">
    <span class="style-switch__label">Grid</span>
    <button v-for="option in GRID_STYLES" :key="option.value" type="button" role="radio"
      :aria-checked="gridStyle === option.value" :class="{ active: gridStyle === option.value }"
      @click="gridStyle = option.value">{{ option.label }}</button>
  </div>
</template>

<style scoped>
.style-switch {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-left: 12px;
  padding: 2px;
  font-size: 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
}

.style-switch__label {
  padding: 0 6px;
  color: var(--vp-c-text-2);
}

.style-switch button {
  padding: 2px 8px;
  color: var(--vp-c-text-2);
  border-radius: 6px;
}

.style-switch button:hover {
  color: var(--vp-c-text-1);
}

.style-switch button.active {
  color: var(--vp-c-text-1);
  background: var(--vp-c-default-soft);
}

@media (max-width: 767px) {
  .style-switch__label {
    display: none;
  }
}
</style>
