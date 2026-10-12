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
    expect(w.FreeGrid.packageName).toBe('freegrid');
    expect(w.Handsontable).toBeUndefined();
    PLUGINS_622.forEach(p => expect(typeof w.FreeGrid.plugins[p], p).toBe('function'));
  });

  it('full UMD bundles dependencies and exposes window.moment / window.numbro', () => {
    const w = windowWith(read('freegrid.full.js'));

    expect(typeof w.FreeGrid).toBe('function');
    expect(typeof w.moment).toBe('function');
    expect(typeof w.numbro).toBe('function');
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

  it('CSS keeps upstream class names; only the full CSS contains Pikaday styles', () => {
    expect(read('freegrid.css')).toMatch(/\.handsontable/);
    expect(read('freegrid.css')).not.toMatch(/\.pika-single/);
    expect(read('freegrid.full.css')).toMatch(/\.pika-single/);
  });
});
