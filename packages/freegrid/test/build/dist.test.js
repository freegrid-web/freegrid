import { readFileSync, existsSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const dist = f => new URL(`../../dist/${f}`, import.meta.url);
const read = f => readFileSync(dist(f), 'utf8');
const nm = f => readFileSync(new URL(`../../node_modules/${f}`, import.meta.url), 'utf8');

const PLUGINS_622 = ['AutoColumnSize', 'AutoRowSize', 'AutoFill', 'ColumnSorting', 'Comments', 'ContextMenu',
  'CopyPaste', 'CustomBorders', 'DragToScroll', 'ManualColumnFreeze', 'ManualColumnMove', 'ManualColumnResize',
  'ManualRowMove', 'ManualRowResize', 'MergeCells', 'MultipleSelectionHandles', 'ObserveChanges',
  'PersistentState', 'Search', 'TouchScroll', 'UndoRedo'];

function windowWith(...scripts) {
  const { window } = new JSDOM('<!doctype html><div id="root"></div>', { runScripts: 'outside-only', pretendToBeVisual: true });
  scripts.forEach(code => window.eval(code));
  return window;
}

describe('dist outputs', () => {

  it('FreeGrid.helper exposes exactly the public helper names', () => {
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

    expect(Object.keys(windowWith(read('freegrid.full.js')).FreeGrid.helper).sort()).toEqual(expected);
  });
  it('produces every expected file', () => {
    ['esm/index.js', 'esm/compat.js', 'freegrid.js', 'freegrid.min.js', 'freegrid.full.js', 'freegrid.full.min.js',
      'freegrid.css', 'freegrid.min.css', 'freegrid.full.css', 'freegrid.full.min.css', 'compat.js',
      'languages/all.js', 'languages/de-DE.js', 'languages/de-DE.min.js']
      .forEach(f => expect(existsSync(dist(f)), f).toBe(true));
  });

  it('plain UMD keeps moment/numbro/pikaday external and registers all 6.2.2 plugins', () => {
    const code = read('freegrid.js');
    expect(code).not.toMatch(/hooks\.version = ['"]2\.3/); // moment's version marker
    const w = windowWith(nm('moment/moment.js'), nm('numbro/dist/numbro.js'), nm('pikaday/pikaday.js'), code);

    expect(typeof w.FreeGrid).toBe('function');
    expect(w.FreeGrid.packageName).toBe('@freegrid/core');
    expect(w.Handsontable).toBeUndefined();
    PLUGINS_622.forEach(p => expect(typeof w.FreeGrid.plugins[p], p).toBe('function'));
  });

  it('full UMD bundles dependencies and exposes window.moment / window.numbro', () => {
    const w = windowWith(read('freegrid.full.js'));

    expect(typeof w.FreeGrid).toBe('function');
    expect(typeof w.moment).toBe('function');
    expect(typeof w.numbro).toBe('function');
  });

  it('UMD builds expose the number helpers on FreeGrid.helper', () => {
    ['freegrid.full.js', 'freegrid.full.min.js'].forEach((file) => {
      const { helper } = windowWith(read(file)).FreeGrid;
      const visited = [];

      expect(helper.isNumeric('0x1F'), file).toBe(true);
      expect(helper.isNumeric('.5'), file).toBe(false);
      expect(helper.valueAccordingPercent(200, '50%'), file).toBe(100);
      helper.rangeEach(1, 3, index => visited.push(index));
      helper.rangeEachReverse(2, index => visited.push(index));
      expect(visited, file).toEqual([1, 2, 3, 2, 1, 0]);
    });
  });

  it('IE and legacy Edge detection is gone from FreeGrid.helper', () => {
    const { helper } = windowWith(read('freegrid.full.js')).FreeGrid;

    ['isIE', 'isIE8', 'isIE9', 'isEdge', 'isMSBrowser'].forEach(name => expect(helper[name], name).toBeUndefined());
    ['isChrome', 'isSafari', 'isMobileBrowser', 'setBrowserMeta'].forEach(name => expect(typeof helper[name], name).toBe('function'));
  });

  it('polyfills and dead feature detections are gone from FreeGrid.helper', () => {
    const { helper } = windowWith(read('freegrid.full.js')).FreeGrid;

    ['requestAnimationFrame', 'cancelAnimationFrame', 'isWebComponentSupportedNatively', 'hasCaptionProblem']
      .forEach(name => expect(helper[name], name).toBeUndefined());
    ['isTouchSupported', 'getComparisonFunction'].forEach(name => expect(typeof helper[name], name).toBe('function'));
    expect(helper.getComparisonFunction()('a', 'b')).toBe(-1);
  });

  it('CSS has no IE hacks', () => {
    ['freegrid.css', 'freegrid.full.css'].forEach((file) => {
      const css = read(file);

      expect(css, file).not.toMatch(/-ms-/);
      expect(css, file).not.toMatch(/\\9\s*;/);
    });
  });

  it('compat.js aliases Handsontable and fails loudly without FreeGrid', () => {
    const w = windowWith(read('freegrid.full.js'), read('compat.js'));
    expect(w.Handsontable).toBe(w.FreeGrid);

    expect(() => windowWith(read('compat.js'))).toThrow(/load freegrid/i);
  });

  it('locale UMD registers on the global FreeGrid', () => {
    const w = windowWith(read('freegrid.full.js'), read('languages/de-DE.js'));
    expect(w.FreeGrid.languages.getLanguageDictionary('de-DE').languageCode).toBe('de-DE');
  });

  it('ESM entries export FreeGrid and the compat alias', () => {
    const esm = read('esm/index.js');
    const compat = read('esm/compat.js');
    expect(esm).toMatch(/export\s*\{[^}]*as default/);
    expect(compat).toMatch(/Handsontable/);
    expect(esm).toMatch(/from ["']moment["']/);
  });

  it('CSS keeps legacy class names; only the full CSS contains Pikaday styles', () => {
    expect(read('freegrid.css')).toMatch(/\.handsontable/);
    expect(read('freegrid.css')).not.toMatch(/\.pika-single/);
    expect(read('freegrid.full.css')).toMatch(/\.pika-single/);
  });

  it('does not depend on a global setImmediate (upstream got it from @babel/polyfill)', async() => {
    const w = windowWith(read('freegrid.full.js'));
    expect(w.setImmediate).toBeUndefined();
    const hot = new w.FreeGrid(w.document.getElementById('root'), { data: [[1]] });
    let ran = false;

    expect(() => hot._registerImmediate(() => { ran = true; })).not.toThrow();
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(ran).toBe(true);
    expect(() => hot.destroy()).not.toThrow();
  });

  it('no build keeps an import of the Pikaday CSS (upstream replaced it with an empty module)', () => {
    ['freegrid.js', 'freegrid.min.js', 'esm/index.js'].forEach(f => expect(read(f), f).not.toMatch(/pikaday\/css/));
  });

  it('minified CSS is built for the same browsers as the JS (it may use `inset`, Chrome 87+)', () => {
    // With a lower CSS target the minifier would keep `top/right/bottom/left` instead.
    ['freegrid.min.css', 'freegrid.full.min.css'].forEach(f => expect(read(f), f).toMatch(/[{;]inset:/));
  });

  it('plugins are registered in the plugin registry, not just exported', () => {
    const w = windowWith(read('freegrid.full.js'));
    const hot = new w.FreeGrid(w.document.getElementById('root'), { data: [[1]] });

    ['autoColumnSize', 'autoRowSize', 'autofill', 'columnSorting', 'comments', 'contextMenu', 'copyPaste',
      'customBorders', 'dragToScroll', 'manualColumnFreeze', 'manualColumnMove', 'manualColumnResize',
      'manualRowMove', 'manualRowResize', 'mergeCells', 'multipleSelectionHandles', 'observeChanges',
      'persistentState', 'search', 'touchScroll']
      .forEach(name => expect(typeof hot.getPlugin(name), name).toBe('object'));
    // UndoRedo is hook-based in 6.2.2: it adds undo()/redo() to every instance.
    expect(typeof hot.undo).toBe('function');
    hot.destroy();
  });

  it('ships ESM locale modules for bundlers, registering on the imported FreeGrid', () => {
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
    const code = read('esm/languages/de-DE.js');

    expect(pkg.exports['./languages/*']).toBeDefined();
    expect(code).toMatch(/from ["']@freegrid\/core["']/);
    expect(code).toMatch(/registerLanguageDictionary/);
    expect(existsSync(dist('esm/languages/all.js'))).toBe(true);
  });

  it('CSS uses FreeGrid class names and keeps legacy selectors during 0.x', () => {
    const css = read('freegrid.css');

    expect(css).toMatch(/\.fg-core\b/);
    expect(css).toMatch(/\.freegrid\b/);
    // A user-supplied legacy class (e.g. className: 'htCenter') must still be styled.
    expect(css).toMatch(/\.fg-center[^{]*,[^{]*\.htCenter|\.htCenter[^{]*,[^{]*\.fg-center/);
  });

  it('elements carry both the FreeGrid and the legacy class names', () => {
    const w = windowWith(read('freegrid.full.js'));
    const hot = new w.FreeGrid(w.document.getElementById('root'), { data: [[1, 2]], readOnly: true, colHeaders: true });
    const root = w.document.getElementById('root');

    ['freegrid', 'handsontable'].forEach(c => expect(root.classList.contains(c), c).toBe(true));
    ['fg-core', 'htCore'].forEach(c => expect(root.querySelector(`table.${c}`), c).not.toBeNull());
    ['fg-master', 'ht_master', 'fg-holder', 'wtHolder', 'fg-clone-top', 'ht_clone_top'].forEach(c => expect(root.querySelector(`.${c}`), c).not.toBeNull());
    ['fg-dimmed', 'htDimmed'].forEach(c => expect(root.querySelector(`td.${c}`), c).not.toBeNull());
    hot.destroy();
  });
});
