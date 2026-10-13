const WINDOW = '\0fg-window';

/** `import window from 'window'` (a webpack external in upstream test helpers). */
export function windowModule() {
  return {
    name: 'fg-window-module',
    enforce: 'pre',
    resolveId: id => (id === 'window' ? WINDOW : null),
    load: id => (id === WINDOW ? 'export default window;' : null),
  };
}

/**
 * Rewrites src/i18n/languages/<code>.ts so its build registers on the imported or global FreeGrid. It runs before
 * TypeScript is compiled ('pre'), on the source text it matches.
 */
export function localeRegistration() {
  return {
    name: 'fg-locale-registration',
    enforce: 'pre',
    transform(code, id) {
      if (!/[\\/]src[\\/]i18n[\\/]languages[\\/][a-z]{2}-[A-Z]{2}\.(js|ts)$/.test(id)) return null;
      const rewritten = code
        .replace(/import \* as C from '\.\.\/constants';/, "import FreeGrid from '@freegrid/core';\n\nconst C = FreeGrid.languages.dictionaryKeys;")
        .replace(/export default dictionary;/, 'FreeGrid.languages.registerLanguageDictionary(dictionary);\n\nexport default dictionary;');

      // A language file whose text no longer matches must not build without registering itself.
      if (!rewritten.includes('registerLanguageDictionary') || !rewritten.includes('FreeGrid.languages.dictionaryKeys')) {
        throw new Error(`fg-locale-registration: ${id} does not match the expected import and export.`);
      }

      return rewritten;
    },
  };
}

/** The vendored runtime code in lib/ is CommonJS (guarded `exports` assignments), like node_modules. */
export const commonjsOptions = { include: [/node_modules/, /[\\/]freegrid[\\/]lib[\\/]/] };
