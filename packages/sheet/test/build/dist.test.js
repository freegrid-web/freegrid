import { readFileSync, existsSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const dist = f => new URL(`../../dist/${f}`, import.meta.url);
const read = f => readFileSync(dist(f), 'utf8');

const PLUGINS_622 = ['AutoColumnSize', 'AutoRowSize', 'AutoFill', 'CollapsibleColumns', 'ColumnSorting', 'Comments',
  'ConditionalFormatting', 'ContextMenu', 'CopyPaste', 'CustomBorders', 'DataValidation', 'DragToScroll', 'DropdownMenu', 'Filters', 'FindAndReplace',
  'FormattingBar', 'FormulaBar', 'Formulas', 'HiddenColumns', 'HiddenRows', 'ManualColumnFreeze', 'ManualColumnMove',
  'ManualColumnResize', 'ManualRowMove', 'ManualRowResize', 'MergeCells', 'MultipleSelectionHandles', 'NestedHeaders',
  'NestedRows', 'ObserveChanges', 'PersistentState', 'RowGroups', 'Search', 'StatusBar', 'TouchScroll', 'UndoRedo'];

function windowWith(...scripts) {
  const { window } = new JSDOM('<!doctype html><div id="root"></div>', { runScripts: 'outside-only', pretendToBeVisual: true });
  scripts.forEach(code => window.eval(code));
  return window;
}

describe('dist outputs', () => {

  it('FreeSheet.dom exposes exactly the public DOM helper names', () => {
    // A change here is a public API change: list it in the CHANGELOG.
    const expected = [
      'HTML_CHARACTERS', 'addClass', 'addEvent', 'closest', 'closestDown', 'empty', 'fastInnerHTML', 'fastInnerText',
      'getCaretPosition', 'getComputedStyle', 'getCssTransform', 'getParent', 'getScrollLeft', 'getScrollTop',
      'getScrollableElement', 'getScrollbarWidth', 'getSelectionEndPosition', 'getSelectionText', 'getStyle',
      'getTrimmingContainer', 'getWindowScrollLeft', 'getWindowScrollTop', 'hasClass', 'hasHorizontalScrollbar',
      'hasVerticalScrollbar', 'index', 'innerHeight', 'innerWidth', 'isChildOf', 'isChildOfWebComponentTable',
      'isImmediatePropagationStopped', 'isInput', 'isLeftClick', 'isOutsideInput', 'isRightClick', 'isVisible',
      'offset', 'outerHeight', 'outerWidth', 'overlayContainsElement', 'pageX', 'pageY', 'polymerUnwrap',
      'polymerWrap', 'removeClass', 'removeEvent', 'removeTextNodes', 'resetCssTransform', 'setCaretPosition',
      'setOverlayPosition', 'stopImmediatePropagation', 'stopPropagation',
    ];

    expect(Object.keys(windowWith(read('freesheet.full.js')).FreeSheet.dom).sort()).toEqual(expected);
  });

  it('FreeSheet.helper exposes exactly the public helper names', () => {
    // A change here is a public API change: list it in the CHANGELOG.
    const expected = [
      'KEY_CODES', 'arrayAvg', 'arrayEach', 'arrayFilter', 'arrayFlatten', 'arrayMap', 'arrayMax', 'arrayMin',
      'arrayReduce', 'arraySum', 'arrayUnique', 'cellMethodLookupFactory', 'clone', 'columnFactory',
      'createEmptySpreadsheetData', 'createObjectPropListener', 'createSpreadsheetData',
      'createSpreadsheetObjectData', 'curry', 'curryRight', 'debounce', 'deepClone', 'deepExtend', 'deepObjectSize',
      'defineGetter', 'duckSchema', 'equalsIgnoreCase', 'extend', 'extendArray', 'getComparisonFunction',
      'getNormalizedDate', 'getProperty', 'hasOwnProperty', 'inherit', 'isChrome', 'isCtrlKey', 'isCtrlMetaKey',
      'isDefined', 'isEmpty', 'isFunction', 'isKey', 'isMetaKey', 'isMobileBrowser', 'isNumeric', 'isObject',
      'isObjectEqual', 'isPercentValue', 'isPrintableChar', 'isRegExp', 'isSafari', 'isTouchSupported',
      'isUndefined', 'mixin', 'objectEach', 'partial', 'pipe', 'pivot', 'randomString', 'rangeEach',
      'rangeEachReverse', 'setBrowserMeta', 'spreadsheetColumnIndex', 'spreadsheetColumnLabel', 'stringify',
      'stripTags', 'substitute', 'throttle', 'throttleAfterHits', 'to2dArray', 'toUpperCaseFirst',
      'translateRowsToColumns', 'valueAccordingPercent',
    ];

    expect(Object.keys(windowWith(read('freesheet.full.js')).FreeSheet.helper).sort()).toEqual(expected);
  });
  it('FreeSheet exposes exactly the public names (top level, editors, renderers, validators, cell types, plugins, languages)', () => {
    // A change here is a public API change: list it in the CHANGELOG.
    const { FreeSheet } = windowWith(read('freesheet.full.js'));
    const names = object => Object.keys(object).sort();

    expect(names(FreeSheet)).toEqual(['Core', 'DefaultSettings', 'EventManager', '__GhostTable', '_getListenersCounter',
      'buildDate', 'cellTypes', 'dom', 'editors', 'filters', 'helper', 'hooks', 'languages', 'packageName', 'plugins',
      'renderers', 'validators', 'version']);
    expect(names(FreeSheet.filters)).toEqual(['getCondition', 'getConditionNames', 'registerCondition']);
    expect(names(FreeSheet.editors)).toEqual(['EditorAutocomplete', 'EditorBase', 'EditorCheckbox', 'EditorDate',
      'EditorDropdown', 'EditorHandsontable', 'EditorNumeric', 'EditorPassword', 'EditorSelect', 'EditorText',
      'EditorTime', 'getEditor', 'registerEditor']);
    expect(names(FreeSheet.renderers)).toEqual(['RendererAutocomplete', 'RendererBase', 'RendererCheckbox',
      'RendererDate', 'RendererDropdown', 'RendererHandsontable', 'RendererHtml', 'RendererNumeric', 'RendererPassword',
      'RendererText', 'RendererTime', 'getRenderer', 'registerRenderer']);
    expect(names(FreeSheet.validators)).toEqual(['ValidatorAutocomplete', 'ValidatorDate', 'ValidatorDropdown',
      'ValidatorNumeric', 'ValidatorTime', 'getValidator', 'registerValidator']);
    expect(names(FreeSheet.cellTypes)).toEqual(['autocomplete', 'checkbox', 'date', 'dropdown', 'getCellType',
      'handsontable', 'numeric', 'password', 'registerCellType', 'text', 'time']);
    expect(names(FreeSheet.plugins)).toEqual([...PLUGINS_622, 'BasePlugin', 'registerPlugin'].sort());
    expect(names(FreeSheet.languages)).toEqual(['dictionaryKeys', 'getLanguageDictionary', 'getLanguagesDictionaries',
      'getTranslatedPhrase', 'registerLanguageDictionary']);
    expect(FreeSheet.languages.getTranslatedPhrase).not.toBe(undefined);
    expect(typeof FreeSheet.hooks.add).toBe('function');
    expect(FreeSheet.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('produces every expected file', () => {
    ['esm/index.js', 'esm/compat.js', 'freesheet.js', 'freesheet.min.js', 'freesheet.full.js', 'freesheet.full.min.js',
      'freesheet.css', 'freesheet.min.css', 'freesheet.full.css', 'freesheet.full.min.css', 'compat.js',
      'languages/all.js', 'languages/de-DE.js', 'languages/de-DE.min.js']
      .forEach(f => expect(existsSync(dist(f)), f).toBe(true));
  });

  it('no bundle contains or needs moment', () => {
    ['freesheet.js', 'freesheet.min.js', 'freesheet.full.js', 'freesheet.full.min.js', 'esm/index.js']
      .forEach(f => expect(read(f), f).not.toMatch(/moment construction falls back|from ["']moment["']/));
    expect(windowWith(read('freesheet.full.js')).moment).toBeUndefined();
  });

  it('plain UMD works on its own and registers all 6.2.2 plugins', () => {
    const code = read('freesheet.js');
    const w = windowWith(code);

    expect(typeof w.FreeSheet).toBe('function');
    expect(w.FreeSheet.packageName).toBe('@freegrid/sheet');
    expect(w.Handsontable).toBeUndefined();
    PLUGINS_622.forEach(p => expect(typeof w.FreeSheet.plugins[p], p).toBe('function'));
  });

  it('no bundle contains or needs numbro', () => {
    ['freesheet.js', 'freesheet.min.js', 'freesheet.full.js', 'freesheet.full.min.js', 'esm/index.js']
      .forEach(f => expect(read(f), f).not.toMatch(/BigNumber|from ["']numbro["']|require\(["']numbro["']\)/));
    const w = windowWith(read('freesheet.full.js'));

    expect(typeof w.FreeSheet).toBe('function');
    expect(w.numbro).toBeUndefined();
  });

  it('UMD builds expose the number helpers on FreeSheet.helper', () => {
    ['freesheet.full.js', 'freesheet.full.min.js'].forEach((file) => {
      const { helper } = windowWith(read(file)).FreeSheet;
      const visited = [];

      expect(helper.isNumeric('0x1F'), file).toBe(true);
      expect(helper.isNumeric('.5'), file).toBe(false);
      expect(helper.valueAccordingPercent(200, '50%'), file).toBe(100);
      helper.rangeEach(1, 3, index => visited.push(index));
      helper.rangeEachReverse(2, index => visited.push(index));
      expect(visited, file).toEqual([1, 2, 3, 2, 1, 0]);
    });
  });

  it('IE and legacy Edge detection is gone from FreeSheet.helper', () => {
    const { helper } = windowWith(read('freesheet.full.js')).FreeSheet;

    ['isIE', 'isIE8', 'isIE9', 'isEdge', 'isMSBrowser'].forEach(name => expect(helper[name], name).toBeUndefined());
    ['isChrome', 'isSafari', 'isMobileBrowser', 'setBrowserMeta'].forEach(name => expect(typeof helper[name], name).toBe('function'));
  });

  it('polyfills and dead feature detections are gone from FreeSheet.helper', () => {
    const { helper } = windowWith(read('freesheet.full.js')).FreeSheet;

    ['requestAnimationFrame', 'cancelAnimationFrame', 'isWebComponentSupportedNatively', 'hasCaptionProblem']
      .forEach(name => expect(helper[name], name).toBeUndefined());
    ['isTouchSupported', 'getComparisonFunction'].forEach(name => expect(typeof helper[name], name).toBe('function'));
    expect(helper.getComparisonFunction()('a', 'b')).toBe(-1);
  });

  it('CSS has a dark theme and an automatic theme with the same values', () => {
    const css = read('freesheet.css').replace(/\/\*[\s\S]*?\*\//g, '');
    const media = css.match(/@media\s*\(prefers-color-scheme:\s*dark\)\s*\{([\s\S]*?\})\s*\}/)?.[1] ?? '';
    const outside = css.replace(/@media[^{]*\{[\s\S]*?\}\s*\}/g, '');
    const themeRules = (text, theme) => [...text.matchAll(/([^{}]+)\{([^}]*)\}/g)]
      .filter(([, selector]) => selector.includes(`fs-theme-${theme}`))
      .map(([, , body]) => body.replace(/\s+/g, ' ').trim());
    const dark = themeRules(outside, 'dark');

    expect(dark.join(' ')).toContain('--fs-color-background');
    expect(themeRules(media, 'auto')).toEqual(dark);
    expect(css).toMatch(/\[data-fs-theme=["']?dark["']?\]/);
    expect(css).toMatch(/\[data-fs-theme=["']?auto["']?\]/);
  });

  it('every CSS build has the date picker, colored by variables', () => {
    ['freesheet.css', 'freesheet.min.css', 'freesheet.full.css', 'esm/freesheet.css'].forEach((f) => {
      expect(read(f), f).toMatch(/\.fs-datepicker\{|\.fs-datepicker \{/);
      expect(read(f), f).toMatch(/\.fs-datepicker-day[^{]*\{[^}]*var\(--fs-datepicker-/);
    });
  });

  it('CSS has no IE hacks', () => {
    ['freesheet.css', 'freesheet.full.css'].forEach((file) => {
      const css = read(file);

      expect(css, file).not.toMatch(/-ms-/);
      expect(css, file).not.toMatch(/\\9\s*;/);
    });
  });

  it('compat.js aliases Handsontable and fails loudly without FreeSheet', () => {
    const w = windowWith(read('freesheet.full.js'), read('compat.js'));
    expect(w.Handsontable).toBe(w.FreeSheet);

    expect(() => windowWith(read('compat.js'))).toThrow(/load freesheet/i);
  });

  it('locale UMD registers on the global FreeSheet', () => {
    const w = windowWith(read('freesheet.full.js'), read('languages/de-DE.js'));
    expect(w.FreeSheet.languages.getLanguageDictionary('de-DE').languageCode).toBe('de-DE');
  });

  it('ESM entries export FreeSheet and the compat alias', () => {
    const esm = read('esm/index.js');
    const compat = read('esm/compat.js');
    expect(esm).toMatch(/export\s*\{[^}]*as default/);
    expect(compat).toMatch(/Handsontable/);
  });

  it('CSS keeps legacy class names', () => {
    expect(read('freesheet.css')).toMatch(/\.handsontable/);
  });

  it('does not depend on a global setImmediate (upstream got it from @babel/polyfill)', async() => {
    const w = windowWith(read('freesheet.full.js'));
    expect(w.setImmediate).toBeUndefined();
    const hot = new w.FreeSheet(w.document.getElementById('root'), { data: [[1]] });
    let ran = false;

    expect(() => hot._registerImmediate(() => { ran = true; })).not.toThrow();
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(ran).toBe(true);
    expect(() => hot.destroy()).not.toThrow();
  });

  it('no build contains or needs Pikaday', () => {
    ['freesheet.js', 'freesheet.min.js', 'freesheet.full.js', 'freesheet.full.min.js', 'esm/index.js', 'freesheet.full.css']
      .forEach(f => expect(read(f), f).not.toMatch(/pikaday|pika-single/i));
  });

  it('minified CSS is built for the same browsers as the JS (it may use `inset`, Chrome 87+)', () => {
    // With a lower CSS target the minifier would keep `top/right/bottom/left` instead.
    ['freesheet.min.css', 'freesheet.full.min.css'].forEach(f => expect(read(f), f).toMatch(/[{;]inset:/));
  });

  it('plugins are registered in the plugin registry, not just exported', () => {
    const w = windowWith(read('freesheet.full.js'));
    const hot = new w.FreeSheet(w.document.getElementById('root'), { data: [[1]] });

    ['autoColumnSize', 'autoRowSize', 'autofill', 'columnSorting', 'comments', 'contextMenu', 'copyPaste',
      'customBorders', 'dragToScroll', 'manualColumnFreeze', 'manualColumnMove', 'manualColumnResize',
      'manualRowMove', 'manualRowResize', 'mergeCells', 'multipleSelectionHandles', 'observeChanges',
      'persistentState', 'search', 'touchScroll']
      .forEach(name => expect(typeof hot.getPlugin(name), name).toBe('object'));
    // UndoRedo is hook-based in 6.2.2: it adds undo()/redo() to every instance.
    expect(typeof hot.undo).toBe('function');
    hot.destroy();
  });

  it('ships ESM locale modules for bundlers, registering on the imported FreeSheet', () => {
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
    const code = read('esm/languages/de-DE.js');

    expect(pkg.exports['./languages/*']).toBeDefined();
    expect(code).toMatch(/from ["']@freegrid\/sheet["']/);
    expect(code).toMatch(/registerLanguageDictionary/);
    expect(existsSync(dist('esm/languages/all.js'))).toBe(true);
  });

  it('CSS uses FreeSheet class names and keeps legacy selectors during 0.x', () => {
    const css = read('freesheet.css');

    expect(css).toMatch(/\.fs-core\b/);
    expect(css).toMatch(/\.freesheet\b/);
    // A user-supplied legacy class (e.g. className: 'htCenter') must still be styled.
    expect(css).toMatch(/\.fs-center[^{]*,[^{]*\.htCenter|\.htCenter[^{]*,[^{]*\.fs-center/);
  });

  it('elements carry both the FreeSheet and the legacy class names', () => {
    const w = windowWith(read('freesheet.full.js'));
    const hot = new w.FreeSheet(w.document.getElementById('root'), { data: [[1, 2]], readOnly: true, colHeaders: true });
    const root = w.document.getElementById('root');

    ['freesheet', 'handsontable'].forEach(c => expect(root.classList.contains(c), c).toBe(true));
    ['fs-core', 'htCore'].forEach(c => expect(root.querySelector(`table.${c}`), c).not.toBeNull());
    ['fs-master', 'ht_master', 'fs-holder', 'wtHolder', 'fs-clone-top', 'ht_clone_top'].forEach(c => expect(root.querySelector(`.${c}`), c).not.toBeNull());
    ['fs-dimmed', 'htDimmed'].forEach(c => expect(root.querySelector(`td.${c}`), c).not.toBeNull());
    hot.destroy();
  });
});
