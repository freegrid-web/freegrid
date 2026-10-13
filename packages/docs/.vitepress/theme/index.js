import { h } from 'vue';
import { VPCarbon } from 'vitepress-carbon';
import LiveExample from './LiveExample.vue';
import RelatedApi from './RelatedApi.vue';
import StyleSwitch from './StyleSwitch.vue';
import ThemePlayground from './ThemePlayground.vue';
import './custom.css';

export default {
  extends: VPCarbon,
  Layout: () => h(VPCarbon.Layout, null, {
    'nav-bar-content-after': () => h(StyleSwitch),
    'aside-outline-after': () => h(RelatedApi, { place: 'aside' }),
    'doc-footer-before': () => h(RelatedApi, { place: 'bottom' }),
  }),
  enhanceApp({ app }) {
    app.component('LiveExample', LiveExample);
    app.component('ThemePlayground', ThemePlayground);
  },
};
