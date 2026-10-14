const WINDOW = '\0fg-window';

/** `import window from 'window'` (a webpack external in upstream test helpers). */
export function windowModule() {
  return {
    name: 'fs-window-module',
    enforce: 'pre',
    resolveId: id => (id === 'window' ? WINDOW : null),
    load: id => (id === WINDOW ? 'export default window;' : null),
  };
}

/**
 * Rewrites src/i18n/languages/<code>.ts so its build registers on the imported or global FreeSheet. It runs before
 * TypeScript is compiled ('pre'), on the source text it matches.
 */
export function localeRegistration() {
  return {
    name: 'fs-locale-registration',
    enforce: 'pre',
    transform(code, id) {
      if (!/[\\/]src[\\/]i18n[\\/]languages[\\/][a-z]{2}-[A-Z]{2}\.(js|ts)$/.test(id)) return null;
      const rewritten = code
        .replace(/import \* as C from '\.\.\/constants';/, "import FreeSheet from '@freegrid/sheet';\n\nconst C = FreeSheet.languages.dictionaryKeys;")
        .replace(/export default dictionary;/, 'FreeSheet.languages.registerLanguageDictionary(dictionary);\n\nexport default dictionary;');

      // A language file whose text no longer matches must not build without registering itself.
      if (!rewritten.includes('registerLanguageDictionary') || !rewritten.includes('FreeSheet.languages.dictionaryKeys')) {
        throw new Error(`fs-locale-registration: ${id} does not match the expected import and export.`);
      }

      return rewritten;
    },
  };
}

/** The vendored runtime code in lib/ is CommonJS (guarded `exports` assignments), like node_modules. */
export const commonjsOptions = { include: [/node_modules/, /[\\/]sheet[\\/]lib[\\/]/] };
