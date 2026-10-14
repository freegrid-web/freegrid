/**
 * FreeSheet's CSS class names and the legacy names inherited from Handsontable 6.
 *
 * FreeSheet uses `fs-` names (`htCore` → `fs-core`, `ht_master` → `fs-master`, `wtHolder` → `fs-holder`,
 * `handsontable` → `freesheet`). During FreeSheet 0.x every element carries both names, so stylesheets and
 * code written for the old names keep working; the DOM class helpers (`addClass`, `removeClass`,
 * `hasClass`) add, remove and match the counterpart automatically. The legacy names are removed in 1.0.
 */

/** Every legacy class name FreeSheet knows. Names not listed here (e.g. `current`, `area`) are not branded. */
export const LEGACY_CLASS_NAMES: readonly string[] = [
  'handsontable', 'handsontableEditor', 'handsontableInput', 'handsontableInputHolder', 'htAutoSize',
  'htAutocomplete', 'htAutocompleteArrow', 'htAutocompleteWrapper', 'htBadValue', 'htBorder', 'htBordered',
  'htBorders', 'htBottom', 'htBottomBorderSolid', 'htCenter', 'htCheckboxRendererInput',
  'htCheckboxRendererLabel', 'htCollapseButton', 'htCommentCell', 'htCommentTextArea', 'htComments',
  'htCommentsContainer', 'htContextMenu', 'htCore', 'htCustomMenuRenderer', 'htDatepickerHolder', 'htDimmed',
  'htDisabled', 'htExpandButton', 'htFillBorder', 'htGhostTable', 'htGroupIndicatorContainer', 'htHidden',
  'htInvalid', 'htItemWrapper', 'htJustify', 'htLeft', 'htLeftBorderSolid', 'htMacScroll', 'htMenu',
  'htMiddle', 'htMobileEditorContainer', 'htNoFrame', 'htNoWrap', 'htNumeric', 'htPlaceholder', 'htRight',
  'htRightBorderSolid', 'htRowHeaders', 'htSearchResult', 'htSelectEditor', 'htSelectionDisabled',
  'htSeparator', 'htSubmenu', 'htTop', 'htTopBorderSolid', 'ht__active_highlight', 'ht__highlight',
  'ht__manualColumnMove', 'ht__manualColumnMove--backlight', 'ht__manualColumnMove--guideline',
  'ht__manualRowMove', 'ht__manualRowMove--backlight', 'ht__manualRowMove--guideline',
  'ht__selection--columns', 'ht__selection--rows', 'ht_clone_bottom', 'ht_clone_bottom_left_corner',
  'ht_clone_corner', 'ht_clone_debug', 'ht_clone_left', 'ht_clone_top', 'ht_clone_top_left_corner',
  'ht_master', 'wtBorder', 'wtDebugVisible', 'wtHider', 'wtHolder', 'wtSpreader',
];

// Where the general rule would produce a clash or a misleading name.
const EXCEPTIONS: Readonly<Record<string, string | undefined>> = {
  handsontable: 'freesheet',
  handsontableEditor: 'fs-editor-grid',
  handsontableInput: 'fs-editor-input',
  handsontableInputHolder: 'fs-editor-holder',
  wtBorder: 'fs-selection-border',
};

const kebab = (value: string): string => value
  .replace(/_/g, '-')
  .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
  .toLowerCase();

const convert = (legacy: string): string => {
  if (EXCEPTIONS[legacy]) {
    return EXCEPTIONS[legacy];
  }
  // BEM: ht__block--modifier → fs-block--modifier
  const bem = /^ht__([A-Za-z_]+)(--[a-z-]+)?$/.exec(legacy);

  if (bem) {
    return `fs-${kebab(bem[1])}${bem[2] || ''}`;
  }
  const prefixed = /^(?:ht_|ht|wt)([A-Za-z][A-Za-z_]*)$/.exec(legacy);

  return prefixed ? `fs-${kebab(prefixed[1])}` : legacy;
};

const LEGACY_TO_FREESHEET = new Map(LEGACY_CLASS_NAMES.map(legacy => [legacy, convert(legacy)]));
const FREEGRID_TO_LEGACY = new Map(Array.from(LEGACY_TO_FREESHEET, ([legacy, name]) => [name, legacy]));

/**
 * The FreeSheet name for a legacy name; any other name unchanged.
 */
export const toFreeSheetClassName = (className: string): string => LEGACY_TO_FREESHEET.get(className) || className;

/**
 * The legacy name for a FreeSheet name; any other name unchanged.
 */
export const toLegacyClassName = (className: string): string => FREEGRID_TO_LEGACY.get(className) || className;

/**
 * Adds the counterpart (legacy or FreeSheet) after every known class name.
 */
export const withCounterpartClassNames = (classNames: readonly string[]): string[] => {
  const result: string[] = [];

  classNames.forEach((className) => {
    result.push(className);
    const counterpart = LEGACY_TO_FREESHEET.get(className) || FREEGRID_TO_LEGACY.get(className);

    if (counterpart && classNames.indexOf(counterpart) === -1) {
      result.push(counterpart);
    }
  });

  return result;
};

/**
 * For code that writes `element.className` directly: a FreeSheet class name followed by its legacy name.
 */
export const withLegacyClassNames = (...classNames: string[]): string => withCounterpartClassNames(classNames).join(' ');

/**
 * Whether a space-separated class string (such as a cell's `className` setting) contains a FreeSheet
 * class name or its legacy counterpart.
 */
export const classNameIncludes = (classNames: string | null | undefined, className: string): boolean => {
  const tokens = String(classNames || '').split(/\s+/);

  return tokens.indexOf(className) !== -1 || tokens.indexOf(toLegacyClassName(className)) !== -1;
};
