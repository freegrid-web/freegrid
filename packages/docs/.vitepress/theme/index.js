import DefaultTheme from 'vitepress/theme';
import LiveExample from './LiveExample.vue';
import './custom.css';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('LiveExample', LiveExample);
  },
};
