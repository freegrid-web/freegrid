describe('Core methods', () => {
  const id = 'testContainer';

  beforeEach(function() {
    this.$container = $(`<div id="${id}"></div>`).appendTo('body');
  });

  afterEach(function() {
    if (this.$container) {
      destroy();
      this.$container.remove();
    }
  });

  /** Every function the grid has, own or inherited (except `constructor`). */
  const methodNames = (hot) => {
    const names = new Set();

    for (let object = hot; object && object !== Object.prototype; object = Object.getPrototypeOf(object)) {
      Object.getOwnPropertyNames(object)
        .filter(name => name !== 'constructor' && typeof hot[name] === 'function')
        .forEach(name => names.add(name));
    }

    return [...names].sort();
  };

  it('should have exactly the public methods (a change here is a public API change)', () => {
    const hot = handsontable({ data: [[1]] });

    expect(methodNames(hot)).toEqual([
      '_clearImmediates', '_clearTimeouts', '_getColWidthFromSettings', '_getRowHeightFromSettings', '_refreshBorders',
      '_registerImmediate', '_registerTimeout', '_validateCells', 'activateSheet', 'addHook', 'addHookOnce', 'addSheet',
      'alter', 'clear', 'clearUndo', 'closePanel', 'colOffset', 'colToProp', 'countCols', 'countEmptyCols',
      'countEmptyRows', 'countRenderedCols', 'countRenderedRows', 'countRows', 'countSourceCols', 'countSourceRows',
      'countVisibleCols', 'countVisibleRows', 'deselectCell', 'destroy', 'destroyEditor', 'emptySelectedCells',
      'getActiveEditor', 'getActiveSheet', 'getCell', 'getCellEditor', 'getCellMeta', 'getCellMetaAtRow',
      'getCellRenderer', 'getCellValidator', 'getCellsMeta', 'getColHeader', 'getColWidth', 'getColumnMeta',
      'getCoords', 'getCopyableData', 'getCopyableText', 'getData', 'getDataAtCell', 'getDataAtCol', 'getDataAtProp',
      'getDataAtRow', 'getDataAtRowProp', 'getDataType', 'getDocument', 'getInstance', 'getOpenPanel', 'getPlugin',
      'getRowHeader', 'getRowHeight', 'getSchema', 'getSelected', 'getSelectedLast', 'getSelectedRange',
      'getSelectedRangeLast', 'getSettings', 'getSheet', 'getSheetId', 'getSheetName', 'getSheets', 'getSourceData',
      'getSourceDataArray', 'getSourceDataAtCell', 'getSourceDataAtCol', 'getSourceDataAtRow', 'getTranslatedPhrase',
      'getValue', 'hasColHeaders', 'hasHook', 'hasRowHeaders', 'init', 'isColumnModificationAllowed', 'isEmptyCol',
      'isEmptyRow', 'isListening', 'isRedoAvailable', 'isUndoAvailable', 'listen', 'loadData', 'loadDocument',
      'moveSheet', 'openPanel', 'populateFromArray', 'propToCol', 'redo', 'removeCellMeta', 'removeHook', 'removeSheet',
      'renameSheet', 'render', 'rowOffset', 'runHooks', 'scrollViewportTo', 'selectAll', 'selectCell',
      'selectCellByProp', 'selectCells', 'selectColumns', 'selectRows', 'setCellMeta', 'setCellMetaObject',
      'setDataAtCell', 'setDataAtRowProp', 'spliceCellsMeta', 'spliceCol', 'spliceRow', 'toPhysicalColumn',
      'toPhysicalRow', 'toVisualColumn', 'toVisualRow', 'undo', 'unlisten', 'updateSettings', 'validateCell',
      'validateCells', 'validateColumns', 'validateRows'
    ]);
  });

  it('should work when a method is called without the grid as `this`', () => {
    const hot = handsontable({ data: [[1, 2], [3, 4]] });
    const { getDataAtCell, countRows, getRowHeight, selectCell, getSelectedLast } = hot;

    expect(getDataAtCell(1, 1)).toBe(4);
    expect(countRows()).toBe(2);
    expect(getRowHeight(0)).toBe(hot.getRowHeight(0));

    selectCell(1, 0);

    expect(getSelectedLast()).toEqual([1, 0, 1, 0]);
  });

  it('should let a test or plugin replace a method on one grid only', () => {
    const hot1 = handsontable({ data: [[1]] });
    const hot2 = new Handsontable(document.createElement('div'), { data: [[2]] });

    spyOn(hot1, 'getDataAtCell').and.returnValue('spied');

    expect(hot1.getDataAtCell(0, 0)).toBe('spied');
    expect(hot2.getDataAtCell(0, 0)).toBe(2);
    hot2.destroy();
  });
});
