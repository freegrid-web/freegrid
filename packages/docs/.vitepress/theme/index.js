import { VPCarbon } from 'vitepress-carbon';
import LiveExample from './LiveExample.vue';
import ThemePlayground from './ThemePlayground.vue';
import './custom.css';

export default {
  extends: VPCarbon,
  enhanceApp({ app }) {
    app.component('LiveExample', LiveExample);
    app.component('ThemePlayground', ThemePlayground);
  },
};
