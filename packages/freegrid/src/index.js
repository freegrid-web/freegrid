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

function FreeGrid(rootElement, userSettings) {
  const instance = new Core(rootElement, userSettings || {}, rootInstanceSymbol);

  instance.init();

  return instance;
}

jQueryWrapper(FreeGrid);

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
const HELPERS = [
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
];
const DOM = [
  domHelpers,
  domEventHelpers,
];

FreeGrid.helper = {};
FreeGrid.dom = {};

// Fill general helpers.
arrayHelpers.arrayEach(HELPERS, (helper) => {
  arrayHelpers.arrayEach(Object.getOwnPropertyNames(helper), (key) => {
    if (key.charAt(0) !== '_') {
      FreeGrid.helper[key] = helper[key];
    }
  });
});

// Fill DOM helpers.
arrayHelpers.arrayEach(DOM, (helper) => {
  arrayHelpers.arrayEach(Object.getOwnPropertyNames(helper), (key) => {
    if (key.charAt(0) !== '_') {
      FreeGrid.dom[key] = helper[key];
    }
  });
});

// Export cell types.
FreeGrid.cellTypes = {};

arrayHelpers.arrayEach(getRegisteredCellTypeNames(), (cellTypeName) => {
  FreeGrid.cellTypes[cellTypeName] = getCellType(cellTypeName);
});

FreeGrid.cellTypes.registerCellType = registerCellType;
FreeGrid.cellTypes.getCellType = getCellType;

// Export all registered editors from the FreeGrid.
FreeGrid.editors = {};

arrayHelpers.arrayEach(getRegisteredEditorNames(), (editorName) => {
  FreeGrid.editors[`Editor${stringHelpers.toUpperCaseFirst(editorName)}`] = getEditor(editorName);
});

FreeGrid.editors.registerEditor = registerEditor;
FreeGrid.editors.getEditor = getEditor;

// Export all registered renderers from the FreeGrid.
FreeGrid.renderers = {};

arrayHelpers.arrayEach(getRegisteredRendererNames(), (rendererName) => {
  FreeGrid.renderers[`Renderer${stringHelpers.toUpperCaseFirst(rendererName)}`] = getRenderer(rendererName);
});

FreeGrid.renderers.registerRenderer = registerRenderer;
FreeGrid.renderers.getRenderer = getRenderer;

// Export all registered validators from the FreeGrid.
FreeGrid.validators = {};

arrayHelpers.arrayEach(getRegisteredValidatorNames(), (validatorName) => {
  FreeGrid.validators[`Validator${stringHelpers.toUpperCaseFirst(validatorName)}`] = getValidator(validatorName);
});

FreeGrid.validators.registerValidator = registerValidator;
FreeGrid.validators.getValidator = getValidator;

// Export all registered plugins from the FreeGrid.
FreeGrid.plugins = {};

arrayHelpers.arrayEach(Object.getOwnPropertyNames(plugins), (pluginName) => {
  const plugin = plugins[pluginName];

  if (pluginName === 'Base') {
    FreeGrid.plugins[`${pluginName}Plugin`] = plugin;
  } else {
    FreeGrid.plugins[pluginName] = plugin;
  }
});

FreeGrid.plugins.registerPlugin = registerPlugin;

FreeGrid.languages = {};
FreeGrid.languages.dictionaryKeys = constants;
FreeGrid.languages.getLanguageDictionary = getLanguageDictionary;
FreeGrid.languages.getLanguagesDictionaries = getLanguagesDictionaries;
FreeGrid.languages.registerLanguageDictionary = registerLanguageDictionary;

// Alias to `getTranslatedPhrase` function, for more information check it API.
FreeGrid.languages.getTranslatedPhrase = (...args) => getTranslatedPhrase(...args);

export default FreeGrid;
