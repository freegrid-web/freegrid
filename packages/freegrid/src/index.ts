import './css/variables.css';
import './css/bootstrap.css';
import './css/handsontable.css';
import './css/mobile.handsontable.css';

import { getRegisteredEditorNames, registerEditor, getEditor } from './editors';
import { getRegisteredRendererNames, getRenderer, registerRenderer } from './renderers';
import { getRegisteredValidatorNames, getValidator, registerValidator } from './validators';
import { getRegisteredCellTypeNames, getCellType, registerCellType } from './cellTypes';

import Core from './core';
import jQueryWrapper from './helpers/wrappers/jquery';
import EventManager, { getListenersCounter } from './eventManager';
import Hooks from './pluginHooks';
import GhostTable from './utils/ghostTable';
import * as arrayHelpers from './helpers/array';
import * as browserHelpers from './helpers/browser';
import * as dataHelpers from './helpers/data';
import * as dateHelpers from './helpers/date';
import * as featureHelpers from './helpers/feature';
import * as functionHelpers from './helpers/function';
import * as mixedHelpers from './helpers/mixed';
import * as numberHelpers from './helpers/number';
import * as objectHelpers from './helpers/object';
import * as settingHelpers from './helpers/setting';
import * as stringHelpers from './helpers/string';
import * as unicodeHelpers from './helpers/unicode';
import * as domHelpers from './helpers/dom/element';
import * as domEventHelpers from './helpers/dom/event';
import * as plugins from './plugins/index';
import { registerPlugin } from './plugins';
import DefaultSettings from './defaultSettings';
import { rootInstanceSymbol } from './utils/rootInstance';
import { getTranslatedPhrase } from './i18n';
import * as constants from './i18n/constants';
import { registerLanguageDictionary, getLanguagesDictionaries, getLanguageDictionary } from './i18n/dictionariesManager';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- core.js is not typed yet
type GridInstance = any;
type CoreConstructor = new (rootElement: Element, userSettings: object, rootInstance?: symbol) => GridInstance;

/**
 * Creates a grid in `rootElement` and initializes it.
 *
 * @param {HTMLElement} rootElement
 * @param {Object} [userSettings]
 * @returns {Core}
 */
function FreeGrid(rootElement: Element, userSettings?: object): GridInstance {
  const instance = new (Core as unknown as CoreConstructor)(rootElement, userSettings || {}, rootInstanceSymbol);

  instance.init();

  return instance;
}

/** The public members of `modules` (names starting with `_` are internal). */
const publicMembers = (modules: object[]): Record<string, unknown> => Object.fromEntries(modules.flatMap(module =>
  Object.entries(module).filter(([key]) => key.charAt(0) !== '_')));

/** `names` mapped to `{prefix}{Name}`, with the values `get` returns. */
const byPrefixedName = (prefix: string, names: string[], get: (name: string) => unknown): Record<string, unknown> =>
  Object.fromEntries(names.map(name => [`${prefix}${stringHelpers.toUpperCaseFirst(name)}`, get(name)]));

jQueryWrapper(FreeGrid as unknown as Parameters<typeof jQueryWrapper>[0]);

FreeGrid.Core = Core;
FreeGrid.DefaultSettings = DefaultSettings;
FreeGrid.EventManager = EventManager;
FreeGrid._getListenersCounter = getListenersCounter; // For MemoryLeak tests

FreeGrid.buildDate = __FG_BUILD_DATE__;
FreeGrid.packageName = __FG_PACKAGE_NAME__;
FreeGrid.version = __FG_VERSION__;

// Export Hooks singleton
FreeGrid.hooks = Hooks.getSingleton();

// TODO: Remove this exports after rewrite tests about this module
FreeGrid.__GhostTable = GhostTable;
//

// Export all helpers to the FreeGrid object
FreeGrid.helper = publicMembers([
  arrayHelpers,
  browserHelpers,
  dataHelpers,
  dateHelpers,
  featureHelpers,
  functionHelpers,
  mixedHelpers,
  numberHelpers,
  objectHelpers,
  settingHelpers,
  stringHelpers,
  unicodeHelpers,
]);
FreeGrid.dom = publicMembers([
  domHelpers,
  domEventHelpers,
]);

// Export cell types.
FreeGrid.cellTypes = {
  ...Object.fromEntries(getRegisteredCellTypeNames().map(name => [name, getCellType(name)])),
  registerCellType,
  getCellType,
};

// Export all registered editors from the FreeGrid.
FreeGrid.editors = {
  ...byPrefixedName('Editor', getRegisteredEditorNames(), getEditor),
  registerEditor,
  getEditor,
};

// Export all registered renderers from the FreeGrid.
FreeGrid.renderers = {
  ...byPrefixedName('Renderer', getRegisteredRendererNames(), getRenderer),
  registerRenderer,
  getRenderer,
};

// Export all registered validators from the FreeGrid.
FreeGrid.validators = {
  ...byPrefixedName('Validator', getRegisteredValidatorNames(), getValidator),
  registerValidator,
  getValidator,
};

// Export all registered plugins from the FreeGrid (`Base` as `BasePlugin`).
FreeGrid.plugins = {
  ...Object.fromEntries(Object.entries(plugins).map(([name, plugin]) => [name === 'Base' ? 'BasePlugin' : name, plugin])),
  registerPlugin,
};

FreeGrid.languages = {
  dictionaryKeys: constants,
  getLanguageDictionary,
  getLanguagesDictionaries,
  registerLanguageDictionary,
  // Alias to `getTranslatedPhrase` function, for more information check it API.
  getTranslatedPhrase: (...args: Parameters<typeof getTranslatedPhrase>) => getTranslatedPhrase(...args),
};

export default FreeGrid;
