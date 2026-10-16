// Topics of the API reference. Every method, event and setting belongs to the first topic whose `methods`, `events`
// or `settings` list names it, or whose `match` pattern fits its name. Guide pages name topics in their frontmatter
// (`api: [Data]`) to list them in the right-hand column.

// Settings and events of features FreeSheet does not have (yet): the code still knows their names, the reference does
// not list them. See the roadmap.
export const UNAVAILABLE = new Set([
  'licenseKey', 'collapsibleColumns', 'columnSummary', 'dropdownMenu', 'filters', 'ganttChart',
  'headerTooltips', 'hiddenColumns', 'hiddenRows', 'nestedHeaders', 'trimRows', 'nestedRows', 'multiColumnSorting',
  'afterDropdownMenuDefaultOptions', 'beforeDropdownMenuSetItems', 'beforeDropdownMenuShow', 'afterDropdownMenuShow',
  'afterDropdownMenuHide', 'beforeFilter', 'afterFilter', 'hiddenRow', 'hiddenColumn', 'afterTrimRow',
  'afterUntrimRow', 'beforeAddChild', 'afterAddChild', 'beforeDetachChild', 'afterDetachChild', 'skipLengthCache',
]);

export const TOPICS = [
  {
    name: 'Lifecycle',
    description: 'Creating, configuring and destroying a grid.',
    methods: ['updateSettings', 'getSettings', 'destroy', 'getInstance', 'getPlugin'],
    events: ['construct', 'init', 'beforeInit', 'afterInit', 'afterDestroy', 'afterUpdateSettings',
      'afterPluginsInitialized'],
    settings: ['debug'],
  },
  {
    name: 'Data',
    description: 'Reading, writing and loading data.',
    methods: ['populateFromArray', 'spliceCol', 'spliceRow', 'loadData', 'getCopyableText', 'getCopyableData',
      'getSchema', 'getValue', 'clear', 'colToProp', 'propToCol', 'isEmptyRow', 'isEmptyCol', 'countEmptyRows',
      'countEmptyCols', 'emptySelectedCells'],
    events: ['afterChange', 'beforeChange', 'afterLoadData', 'afterSetDataAtCell', 'afterSetDataAtRowProp',
      'modifyData', 'modifyRowData', 'afterChangesObserved'],
    settings: ['data', 'dataSchema', 'startRows', 'startCols', 'minRows', 'minCols', 'maxRows', 'maxCols',
      'minSpareRows', 'minSpareCols', 'observeChanges', 'trimWhitespace', 'isEmptyRow', 'isEmptyCol',
      'formulas', 'formulaBar'],
    match: /^(set|get)(Source)?Data|^getDataAt|^getDataType/,
  },
  {
    name: 'Selection',
    description: 'Selecting cells, rows and columns, and moving the selection with the keyboard.',
    methods: ['listen', 'unlisten', 'isListening'],
    events: ['afterListen', 'afterUnlisten', 'afterDeselect', 'afterDrawSelection', 'beforeDrawBorders'],
    settings: ['selectionMode', 'outsideClickDeselects', 'fragmentSelection', 'disableVisualSelection',
      'currentRowClassName', 'currentColClassName', 'currentHeaderClassName', 'activeHeaderClassName', 'enterMoves',
      'tabMoves', 'autoWrapRow', 'autoWrapCol'],
    match: /select|Selection|SetRange|Transform/i,
  },
  {
    name: 'Editing and validation',
    description: 'Cell editors and validators.',
    methods: ['getActiveEditor', 'destroyEditor', 'getCellEditor', 'getCellValidator'],
    events: ['beforeValidate', 'afterValidate', 'afterBeginEditing'],
    settings: ['editor', 'validator', 'allowInvalid', 'allowEmpty', 'invalidCellClassName', 'readOnly',
      'enterBeginsEditing'],
    match: /^validate/,
  },
  {
    name: 'Cell types and meta',
    description: 'Cell types, renderers, formats and per-cell settings (cell meta).',
    methods: ['getCellRenderer'],
    events: ['beforeRenderer', 'afterRenderer', 'beforeValueRender', 'beforeChangeRender', 'beforeCellAlignment',
      'beforeRemoveCellClassNames'],
    settings: ['type', 'renderer', 'cells', 'cell', 'columns', 'source', 'strict', 'filter', 'sortByRelevance',
      'filteringCaseSensitive', 'trimDropdown', 'visibleRows', 'allowHtml', 'checkedTemplate', 'uncheckedTemplate',
      'label', 'numericFormat', 'dateFormat', 'defaultDate', 'correctFormat', 'selectOptions', 'className',
      'readOnlyCellClassName', 'placeholder', 'placeholderCellClassName', 'noWordWrapClassName', 'wordWrap'],
    match: /CellMeta|CellsMeta|ColumnMeta/,
  },
  {
    name: 'Sheets',
    description: 'Several sheets in one document, with tabs, as in an Excel file.',
    methods: ['addSheet', 'getSheet', 'getSheets', 'getActiveSheet', 'activateSheet', 'renameSheet', 'removeSheet',
      'moveSheet', 'getSheetId', 'getSheetName', 'getDocument', 'loadDocument'],
    events: ['beforeSheetAdd', 'afterSheetAdd', 'beforeSheetActivate', 'afterSheetActivate', 'beforeSheetRename',
      'afterSheetRename', 'beforeSheetRemove', 'afterSheetRemove', 'afterSheetMove'],
    settings: ['sheetId', 'sheetName', 'sheets', 'sheetTabs', 'sheetTabsPosition'],
  },
  {
    name: 'Rows and columns',
    description: 'Counting, inserting, removing and sizing rows and columns; headers; visual and physical indexes.',
    methods: ['alter', 'rowOffset', 'colOffset', 'isColumnModificationAllowed', 'getColWidth', 'getRowHeight'],
    events: ['beforeStretchingColumnWidth', 'afterGetColumnHeaderRenderers', 'afterGetRowHeaderRenderers',
      'beforeHideRows', 'afterHideRows', 'beforeUnhideRows', 'afterUnhideRows', 'beforeHideColumns',
      'afterHideColumns', 'beforeUnhideColumns', 'afterUnhideColumns', 'hiddenRow', 'hiddenColumn'],
    settings: ['rowHeaders', 'colHeaders', 'colWidths', 'rowHeights', 'stretchH', 'allowInsertRow',
      'allowInsertColumn', 'allowRemoveRow', 'allowRemoveColumn', 'fixedRowsTop', 'fixedRowsBottom',
      'fixedColumnsLeft', 'rowHeaderWidth', 'columnHeaderHeight', 'bindRowsWithHeaders', 'title', 'hiddenRows',
      'hiddenColumns'],
    match: /^count|Header|^to(Visual|Physical)|^(un)?modify(Row|Col)|(Create|Remove)(Row|Col)$/,
  },
  {
    name: 'Rendering and scrolling',
    description: 'Size, rendering, scrolling and DOM access.',
    methods: ['render', 'getCell', 'getCoords', 'scrollViewportTo'],
    events: ['afterRender', 'beforeRender', 'afterScrollHorizontally', 'afterScrollVertically', 'afterMomentumScroll',
      'beforeTouchScroll', 'beforeInitWalkontable', 'modifyGetCellCoords'],
    settings: ['width', 'height', 'renderAllRows', 'viewportRowRenderingOffset', 'viewportColumnRenderingOffset',
      'observeDOMVisibility', 'preventOverflow', 'tableClassName'],
    match: /Viewport/,
  },
  {
    name: 'Mouse and keyboard',
    description: 'Mouse and keyboard events on cells and the document.',
    events: ['beforeKeyDown', 'afterDocumentKeyDown'],
    match: /OnCell/,
  },
  {
    name: 'Hooks API',
    description: 'Adding and removing event listeners (hooks).',
    methods: ['addHook', 'hasHook', 'addHookOnce', 'removeHook', 'runHooks'],
  },
  {
    name: 'Localization',
    description: 'Language of the grid\'s texts.',
    methods: ['getTranslatedPhrase'],
    events: ['beforeLanguageChange', 'afterLanguageChange'],
    settings: ['language'],
  },
  {
    name: 'Plugins',
    description: 'Built-in features you switch on with a setting: context menu, copy and paste, sorting, moving and '
      + 'resizing, merged cells, comments, search, undo and more.',
    settings: ['contextMenu', 'copyPaste', 'copyable', 'skipColumnOnPaste', 'undo', 'columnSorting',
      'manualColumnMove', 'manualColumnResize', 'manualRowMove', 'manualRowResize', 'mergeCells', 'manualColumnFreeze',
      'autoColumnSize', 'autoRowSize', 'search', 'comments', 'commentedCellClassName', 'customBorders',
      'persistentState', 'dragToScroll', 'fillHandle'],
    match: /ContextMenu|Cop(y|ied)|Cut|Paste|Sort|Move|Resize|Undo|Redo|[Mm]erge|Autofill|persistentState/,
  },
];

/**
 * The topic of an entry (`kind` is 'method', 'event' or 'setting'); `Other` when none fits.
 */
export const topicOf = (kind, name) => {
  const list = `${kind === 'method' ? 'methods' : kind === 'event' ? 'events' : 'settings'}`;
  const listed = TOPICS.find(topic => topic[list]?.includes(name));

  return (listed ?? TOPICS.find(topic => topic.match?.test(name)))?.name ?? 'Other';
};
