const EMPTY = '\0fg-empty';
const WINDOW = '\0fg-window';

/**
 * Drop `pikaday/css/*` imports, and FreeGrid's theme for them (`pikaday-theme.css`), in non-full builds and test
 * bundles: those builds leave Pikaday's styles to the user.
 */
export function ignorePikadayCss() {
  return {
    name: 'fg-ignore-pikaday-css',
    enforce: 'pre',
    resolveId: id => (id.startsWith('pikaday/css') || /(^|[\\/])pikaday-theme\.css$/.test(id) ? EMPTY : null),
    load: id => (id === EMPTY ? '' : null),
  };
}

/** `import window from 'window'` (a webpack external in upstream test helpers). */
export function windowModule() {
  return {
    name: 'fg-window-module',
    enforce: 'pre',
    resolveId: id => (id === 'window' ? WINDOW : null),
    load: id => (id === WINDOW ? 'export default window;' : null),
  };
}

/** Rewrites src/i18n/languages/<code>.js so its UMD build registers on the global FreeGrid. */
export function localeRegistration() {
  return {
    name: 'fg-locale-registration',
    transform(code, id) {
      if (!/[\\/]src[\\/]i18n[\\/]languages[\\/][a-z]{2}-[A-Z]{2}\.js$/.test(id)) return null;
      return code
        .replace(/import \* as C from '\.\.\/constants';/, "import FreeGrid from '@freegrid/core';\n\nconst C = FreeGrid.languages.dictionaryKeys;")
        .replace(/export default dictionary;/, 'FreeGrid.languages.registerLanguageDictionary(dictionary);\n\nexport default dictionary;');
    },
  };
}

/** The vendored runtime code in lib/ is CommonJS (guarded `exports` assignments), like node_modules. */
export const commonjsOptions = { include: [/node_modules/, /[\\/]freegrid[\\/]lib[\\/]/] };
