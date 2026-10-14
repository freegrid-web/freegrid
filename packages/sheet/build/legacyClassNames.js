// Node runs this build script directly; it strips the TypeScript types of classNames.ts (Node 23.6+).
import { LEGACY_CLASS_NAMES, toFreeSheetClassName } from '../src/helpers/classNames.ts';

// FreeSheet name → legacy name, e.g. fs-center → htCenter.
const LEGACY_BY_NAME = new Map(LEGACY_CLASS_NAMES.map(legacy => [toFreeSheetClassName(legacy), legacy]));
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const CLASS_PATTERN = new RegExp(
  `\\.(${Array.from(LEGACY_BY_NAME.keys()).sort((a, b) => b.length - a.length).map(escape).join('|')})(?![\\w-])`,
  'g',
);
const processed = new WeakSet();

/**
 * PostCSS plugin: for every selector that uses FreeSheet class names, also emit the same selector with the
 * legacy (Handsontable 6) names, so `className: 'htCenter'` and stylesheets written for the old names keep
 * working during FreeSheet 0.x. Removed in 1.0.
 */
export function legacyClassNames() {
  return {
    postcssPlugin: 'freesheet-legacy-class-names',
    Rule(rule) {
      if (processed.has(rule)) {
        return;
      }
      processed.add(rule);
      const legacySelectors = rule.selectors
        .filter(selector => selector.search(CLASS_PATTERN) !== -1)
        .map(selector => selector.replace(CLASS_PATTERN, (match, name) => `.${LEGACY_BY_NAME.get(name)}`))
        .filter(selector => !rule.selectors.includes(selector));

      if (legacySelectors.length) {
        rule.selectors = [...rule.selectors, ...legacySelectors];
      }
    },
  };
}
legacyClassNames.postcss = true;
