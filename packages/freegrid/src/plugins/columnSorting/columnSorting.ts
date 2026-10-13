import {
  addClass,
  removeClass,
} from '../../helpers/dom/element';
import { isUndefined, isDefined } from '../../helpers/mixed';
import { isObject } from '../../helpers/object';
import { rangeEach } from '../../helpers/number';
import BasePlugin from '../_base';
import type { PluginHost } from '../_base';
import type { CellCoords } from '../../3rdparty/walkontable/src';
import { registerPlugin } from './../../plugins';
import Hooks from '../../pluginHooks';
import { isPressedCtrlKey } from '../../utils/keyStateObserver';
import { ColumnStatesManager } from './columnStatesManager';
import {
  getNextSortOrder,
  areValidSortStates,
  getHeaderSpanElement,
  isFirstLevelColumnHeader,
  wasHeaderClickedProperly,
} from './utils';
import type { ColumnSortState, SortOrder, SortSettings } from './utils';
import { getClassedToRemove, getClassesToAdd } from './domHelpers';
import RowsMapper from './rowsMapper';
import { rootComparator } from './rootComparator';
import { registerRootComparator, sort } from './sortService';

const APPEND_COLUMN_CONFIG_STRATEGY = 'append';
const REPLACE_COLUMN_CONFIG_STRATEGY = 'replace';
const PLUGIN_KEY = 'columnSorting';

/** A sort configuration: a visual column and an order. */
type SortConfig = { column: number; sortOrder?: SortOrder };

/** All sort settings (the plugin's setting, or a saved state). */
type AllSortSettings = SortSettings & { initialConfig?: SortConfig | SortConfig[] };

/** A mouse event, with the element it happened on (set by EventManager). */
type GridMouseEvent = MouseEvent & { realTarget: HTMLElement };

registerRootComparator(PLUGIN_KEY, rootComparator);

Hooks.getSingleton().register('beforeColumnSort');
Hooks.getSingleton().register('afterColumnSort');

// DIFF - MultiColumnSorting & ColumnSorting: changed configuration documentation.
/**
 * @plugin ColumnSorting
 *
 * @description
 * This plugin sorts the view by columns (but does not sort the data source!). To enable the plugin, set the
 * {@link Options#columnSorting} property to the correct value (see the examples below).
 *
 * @example
 * ```js
 * // as boolean
 * columnSorting: true
 *
 * // as an object with initial sort config (sort ascending for column at index 1)
 * columnSorting: {
 *   initialConfig: {
 *     column: 1,
 *     sortOrder: 'asc'
 *   }
 * }
 *
 * // as an object which define specific sorting options for all columns
 * columnSorting: {
 *   sortEmptyCells: true, // true = the table sorts empty cells, false = the table moves all empty cells to the end of the table (by default)
 *   indicator: true, // true = shows indicator for all columns (by default), false = don't show indicator for columns
 *   headerAction: true, // true = allow to click on the headers to sort (by default), false = turn off possibility to click on the headers to sort
 *   compareFunctionFactory: function(sortOrder, columnMeta) {
 *     return function(value, nextValue) {
 *       // Some value comparisons which will return -1, 0 or 1...
 *     }
 *   }
 * }
 *
 * // as an object passed to the `column` property, allows specifying a custom options for the desired column.
 * columns: [{
 *   columnSorting: {
 *     indicator: false, // disable indicator for the first column,
 *     sortEmptyCells: true,
 *     headerAction: false, // clicks on the first column won't sort
 *     compareFunctionFactory: function(sortOrder, columnMeta) {
 *       return function(value, nextValue) {
 *         return 0; // Custom compare function for the first column (don't sort)
 *       }
 *     }
 *   }
 * }]
 * ```
 *
 * @dependencies ObserveChanges
 */
class ColumnSorting extends BasePlugin {
  /**
   * Instance of column state manager.
   *
   * @private
   */
  columnStatesManager = new ColumnStatesManager();

  /**
   * Object containing visual row indexes mapped to data source indexes.
   *
   * @private
   */
  rowsMapper = new RowsMapper();

  /**
   * It blocks the plugin translation, this flag is checked inside `onModifyRow` callback.
   *
   * @private
   */
  blockPluginTranslation = true;

  /**
   * Cached column properties from plugin like i.e. `indicator`, `headerAction`.
   *
   * @private
   */
  columnMetaCache = new Map<number, SortSettings>();

  /**
   * Main settings key designed for the plugin.
   *
   * @private
   */
  pluginKey = PLUGIN_KEY;

  constructor(hotInstance: PluginHost) {
    super(hotInstance);
  }

  /**
   * Checks if the plugin is enabled in the FreeGrid settings. This method is executed in {@link Hooks#beforeInit}
   * hook and if it returns `true` than the {@link ColumnSorting#enablePlugin} method is called.
   *
   */
  isEnabled(): boolean {
    return !!(this.hot.getSettings()[this.pluginKey]);
  }

  /**
   * Enables the plugin functionality for this FreeGrid instance.
   */
  enablePlugin(): void {
    if (this.enabled) {
      return;
    }

    if (isUndefined(this.hot.getSettings().observeChanges)) {
      this.enableObserveChangesPlugin();
    }

    this.addHook('afterTrimRow', () => this.sortByPresetSortStates());
    this.addHook('afterUntrimRow', () => this.sortByPresetSortStates());
    this.addHook('modifyRow', (row: number, source?: string) => this.onModifyRow(row, source));
    this.addHook('unmodifyRow', (row: number, source?: string) => this.onUnmodifyRow(row, source));
    this.addHook('afterGetColHeader', (column: number, TH: HTMLTableCellElement) => this.onAfterGetColHeader(column, TH));
    this.addHook('beforeOnCellMouseDown', (event: GridMouseEvent, coords: CellCoords, TD: HTMLTableCellElement,
      controller: { column?: boolean }) => this.onBeforeOnCellMouseDown(event, coords, TD, controller));
    this.addHook('afterOnCellMouseDown', (event: GridMouseEvent, target: CellCoords) => this.onAfterOnCellMouseDown(event, target));
    this.addHook('afterCreateRow', (index: number, amount: number) => this.onAfterCreateRow(index, amount));
    this.addHook('afterRemoveRow', (index: number, amount: number) => this.onAfterRemoveRow(index, amount));
    this.addHook('afterInit', () => this.loadOrSortBySettings());
    this.addHook('afterLoadData', (initialLoad: boolean) => this.onAfterLoadData(initialLoad));
    this.addHook('afterCreateCol', () => this.onAfterCreateCol());
    this.addHook('afterRemoveCol', () => this.onAfterRemoveCol());

    // TODO: Workaround? It should be refactored / described.
    if (this.hot.view) {
      this.loadOrSortBySettings();
    }

    super.enablePlugin();
  }

  /**
   * Disables the plugin functionality for this FreeGrid instance.
   */
  disablePlugin(): void {
    const clearColHeader = (column: number, TH: HTMLTableCellElement) => {
      const headerSpanElement = getHeaderSpanElement(TH);

      if (isFirstLevelColumnHeader(column, TH) === false || headerSpanElement === null) {
        return;
      }

      this.updateHeaderClasses(headerSpanElement);
    };

    // Changing header width and removing indicator.
    this.hot.addHook('afterGetColHeader', clearColHeader);
    this.hot.addHookOnce('afterRender', () => {
      this.hot.removeHook('afterGetColHeader', clearColHeader);
    });

    this.rowsMapper.clearMap();

    super.disablePlugin();
  }

  // DIFF - MultiColumnSorting & ColumnSorting: changed function documentation.
  /**
   * Sorts the table by chosen columns and orders.
   *
   * @param [sortConfig] Single column sort configuration. The configuration object contains `column` and `sortOrder` properties.
   * First of them contains visual column index, the second one contains sort order (`asc` for ascending, `desc` for descending).
   *
   * **Note**: Please keep in mind that every call of `sort` function set an entirely new sort order. Previous sort configs aren't preserved.
   *
   * @example
   * ```js
   * // sort ascending first visual column
   * hot.getPlugin('columnSorting').sort({ column: 0, sortOrder: 'asc' });
   * ```
   *
   * @fires Hooks#beforeColumnSort
   * @fires Hooks#afterColumnSort
   */
  sort(sortConfig?: SortConfig | SortConfig[]): void {
    const currentSortConfig = this.getSortConfig() as SortConfig[];

    // We always pass configs defined as an array to `beforeColumnSort` and `afterColumnSort` hooks.
    const destinationSortConfigs = this.getNormalizedSortConfigs(sortConfig);

    const sortPossible = this.areValidSortConfigs(destinationSortConfigs);
    const allowSort = this.hot.runHooks('beforeColumnSort', currentSortConfig, destinationSortConfigs, sortPossible);

    if (allowSort === false) {
      return;
    }

    if (sortPossible) {
      this.columnStatesManager.setSortStates(this.#toPhysical(destinationSortConfigs));
      this.sortByPresetSortStates();
      this.saveAllSortSettings();

      this.hot.render();
      this.hot.view.wt.draw(true); // TODO: Workaround? One test won't pass after removal. It should be refactored / described.
    }

    this.hot.runHooks('afterColumnSort', currentSortConfig, this.getSortConfig(), sortPossible);
  }

  /**
   * Clear the sort performed on the table.
   */
  clearSort(): void {
    this.sort([]);
  }

  /**
   * Checks if the table is sorted (any column have to be sorted).
   *
   */
  isSorted(): boolean {
    return this.enabled && !this.columnStatesManager.isListOfSortedColumnsEmpty();
  }

  /**
   * Get sort configuration for particular column or for all sorted columns. Objects contain `column` and `sortOrder` properties.
   *
   * **Note**: Please keep in mind that returned objects expose **visual** column index under the `column` key. They are handled by the `sort` function.
   *
   * @param [column] Visual column index.
   */
  getSortConfig(column?: number): SortConfig | SortConfig[] | undefined {
    if (isDefined(column)) {
      const columnSortState = this.columnStatesManager.getColumnSortState(this.hot.toPhysicalColumn(column));

      return isDefined(columnSortState) ? this.#toVisual(columnSortState!) : undefined;
    }

    return this.columnStatesManager.getSortStates().map(columnState => this.#toVisual(columnState));
  }

  /**
   * @description
   * Warn: Useful mainly for providing server side sort implementation (see in the example below). It doesn't sort the data set. It just sets sort configuration for all sorted columns.
   *
   * @example
   * ```js
   * beforeColumnSort: function(currentSortConfig, destinationSortConfigs) {
   *   const columnSortPlugin = this.getPlugin('columnSorting');
   *
   *   columnSortPlugin.setSortConfig(destinationSortConfigs);
   *
   *   // const newData = ... // Calculated data set, ie. from an AJAX call.
   *
   *   // this.loadData(newData); // Load new data set.
   *
   *   return false; // The blockade for the default sort action.
   * }
   * ```
   *
   * @param [sortConfig] Single column sort configuration or full sort configuration (for all sorted columns).
   * The configuration object contains `column` and `sortOrder` properties. First of them contains visual column index, the second one contains
   * sort order (`asc` for ascending, `desc` for descending).
   */
  setSortConfig(sortConfig?: SortConfig | SortConfig[]): void {
    // We always set configs defined as an array.
    const destinationSortConfigs = this.getNormalizedSortConfigs(sortConfig);

    if (this.areValidSortConfigs(destinationSortConfigs)) {
      this.columnStatesManager.setSortStates(this.#toPhysical(destinationSortConfigs));
    }
  }

  /**
   * Get normalized sort configs.
   *
   * @private
   * @param [sortConfig=[]] Single column sort configuration or full sort configuration (for all sorted columns).
   * The configuration object contains `column` and `sortOrder` properties. First of them contains visual column index, the second one contains
   * sort order (`asc` for ascending, `desc` for descending).
   */
  getNormalizedSortConfigs(sortConfig: SortConfig | SortConfig[] = []): SortConfig[] {
    if (Array.isArray(sortConfig)) {
      return sortConfig.slice(0, 1);
    }

    return [sortConfig].slice(0, 1);
  }

  /**
   * Get if sort configs are valid.
   *
   * @private
   * @param sortConfigs Sort configuration for all sorted columns. Objects contain `column` and `sortOrder` properties.
   */
  areValidSortConfigs(sortConfigs: unknown): sortConfigs is ColumnSortState[] {
    if (Array.isArray(sortConfigs) === false) {
      return false;
    }

    const sortedColumns = (sortConfigs as SortConfig[]).map(({ column }) => column);
    const numberOfColumns = this.hot.countCols();
    const onlyExistingVisualIndexes = sortedColumns.every(visualColumn =>
      visualColumn <= numberOfColumns && visualColumn >= 0);

    return areValidSortStates(sortConfigs) && onlyExistingVisualIndexes; // We don't translate visual indexes to physical indexes.
  }

  /**
   * Saves all sorting settings. Saving works only when {@link Options#persistentState} option is enabled.
   *
   * @private
   * @fires Hooks#persistentStateSave
   */
  saveAllSortSettings(): void {
    const allSortSettings: AllSortSettings = this.columnStatesManager.getAllColumnsProperties();

    allSortSettings.initialConfig = this.columnStatesManager.getSortStates();

    this.hot.runHooks('persistentStateSave', 'columnSorting', allSortSettings);
  }

  /**
   * Get all saved sorting settings. Loading works only when {@link Options#persistentState} option is enabled.
   *
   * @private
   * @returns Previously saved sort settings.
   *
   * @fires Hooks#persistentStateLoad
   */
  getAllSavedSortSettings(): AllSortSettings | undefined {
    const storedAllSortSettings: { value?: AllSortSettings } = {};

    this.hot.runHooks('persistentStateLoad', 'columnSorting', storedAllSortSettings);

    const allSortSettings = storedAllSortSettings.value;

    if (isDefined(allSortSettings) && Array.isArray(allSortSettings!.initialConfig)) {
      allSortSettings!.initialConfig = allSortSettings!.initialConfig.map(state => this.#toVisual(state as ColumnSortState));
    }

    return allSortSettings;
  }

  /**
   * Get next sort configuration for particular column. Object contain `column` and `sortOrder` properties.
   *
   * **Note**: Please keep in mind that returned object expose **visual** column index under the `column` key.
   *
   * @private
   * @param column Visual column index.
   */
  getColumnNextConfig(column: number): SortConfig | undefined {
    const physicalColumn = this.hot.toPhysicalColumn(column);

    if (this.columnStatesManager.isColumnSorted(physicalColumn)) {
      const columnSortConfig = this.getSortConfig(column) as SortConfig;
      const sortOrder = getNextSortOrder(columnSortConfig.sortOrder);

      if (isDefined(sortOrder)) {
        columnSortConfig.sortOrder = sortOrder;

        return columnSortConfig;
      }

      return undefined;
    }

    const nrOfColumns = this.hot.countCols();

    if (Number.isInteger(column) && column >= 0 && column < nrOfColumns) {
      return {
        column,
        sortOrder: getNextSortOrder(),
      };
    }

    return undefined;
  }

  /**
   * Get sort configuration with "next order" for particular column.
   *
   * @private
   * @param columnToChange Visual column index of column which order will be changed.
   * @param strategyId ID of strategy. Possible values: 'append' and 'replace'. The first one
   * change order of particular column and change it's position in the sort queue to the last one. The second one
   * just change order of particular column.
   *
   * **Note**: Please keep in mind that returned objects expose **visual** column index under the `column` key.
   *
   */
  getNextSortConfig(columnToChange: number, strategyId = APPEND_COLUMN_CONFIG_STRATEGY): SortConfig[] {
    const physicalColumn = this.hot.toPhysicalColumn(columnToChange);
    const indexOfColumnToChange = this.columnStatesManager.getIndexOfColumnInSortQueue(physicalColumn);
    const isColumnSorted = this.columnStatesManager.isColumnSorted(physicalColumn);
    const currentSortConfig = this.getSortConfig() as SortConfig[];
    const nextColumnConfig = this.getColumnNextConfig(columnToChange);

    if (isColumnSorted) {
      if (isUndefined(nextColumnConfig)) {
        return [...currentSortConfig.slice(0, indexOfColumnToChange), ...currentSortConfig.slice(indexOfColumnToChange + 1)];
      }

      if (strategyId === APPEND_COLUMN_CONFIG_STRATEGY) {
        return [...currentSortConfig.slice(0, indexOfColumnToChange), ...currentSortConfig.slice(indexOfColumnToChange + 1), nextColumnConfig!];

      } else if (strategyId === REPLACE_COLUMN_CONFIG_STRATEGY) {
        return [...currentSortConfig.slice(0, indexOfColumnToChange), nextColumnConfig!, ...currentSortConfig.slice(indexOfColumnToChange + 1)];
      }
    }

    if (isDefined(nextColumnConfig)) {
      return currentSortConfig.concat(nextColumnConfig!);
    }

    return currentSortConfig;
  }

  /**
   * Saves to cache part of plugins related properties, properly merged from cascade settings.
   *
   * @private
   * @param column Visual column index.
   */
  // TODO: Workaround. Inheriting of non-primitive cell meta values doesn't work. Using this function we don't count
  // merged properties few times.
  setMergedPluginSettings(column: number): void {
    const physicalColumnIndex = this.hot.toPhysicalColumn(column);
    const pluginMainSettings = this.hot.getSettings()[this.pluginKey];
    const storedColumnProperties = this.columnStatesManager.getAllColumnsProperties();
    const cellMeta = this.hot.getCellMeta(0, column);
    const columnMeta = Object.getPrototypeOf(cellMeta);
    const columnMetaHasPluginSettings = Object.hasOwnProperty.call(columnMeta, this.pluginKey);
    const pluginColumnConfig = columnMetaHasPluginSettings ? columnMeta[this.pluginKey] : {};

    this.columnMetaCache.set(physicalColumnIndex, Object.assign(storedColumnProperties, pluginMainSettings, pluginColumnConfig));
  }

  /**
   * Get copy of settings for first cell in the column.
   *
   * @private
   * @param column Visual column index.
   */
  // TODO: Workaround. Inheriting of non-primitive cell meta values doesn't work. Instead of getting properties from
  // column meta we call this function.
  getFirstCellSettings(column: number): Record<string, unknown> {
    // TODO: Remove test named: "should not break the dataset when inserted new row" (#5431).
    const actualBlockTranslationFlag = this.blockPluginTranslation;

    this.blockPluginTranslation = true;

    if (this.columnMetaCache.size === 0 || this.columnMetaCache.size < this.hot.countCols()) {
      this.rebuildColumnMetaCache();
    }

    const cellMeta = this.hot.getCellMeta(0, column);

    this.blockPluginTranslation = actualBlockTranslationFlag;

    const cellMetaCopy = Object.create(cellMeta);
    cellMetaCopy[this.pluginKey] = this.columnMetaCache.get(this.hot.toPhysicalColumn(column));

    return cellMetaCopy;
  }

  /**
   * Rebuild the column meta cache for all the columns.
   *
   * @private
   */
  rebuildColumnMetaCache(): void {
    const numberOfColumns = this.hot.countCols();

    if (numberOfColumns === 0) {
      this.columnMetaCache.clear();

    } else {
      rangeEach(numberOfColumns - 1, visualColumnIndex => this.setMergedPluginSettings(visualColumnIndex));
    }
  }

  /**
   * Get number of rows which should be sorted.
   *
   * @private
   * @param numberOfRows Total number of displayed rows.
   */
  getNumberOfRowsToSort(numberOfRows: number): number {
    const settings = this.hot.getSettings();

    // `maxRows` option doesn't take into account `minSpareRows` option in this case.
    if (settings.maxRows <= numberOfRows) {
      return settings.maxRows;
    }

    return numberOfRows - settings.minSpareRows;
  }

  /**
   * Performs the sorting using a stable sort function basing on internal state of sorting.
   *
   * @private
   */
  sortByPresetSortStates(): void {
    if (this.columnStatesManager.isListOfSortedColumnsEmpty()) {
      this.rowsMapper.clearMap();

      return;
    }

    const indexesWithData: [number, ...unknown[]][] = [];
    const sortedColumnsList = this.columnStatesManager.getSortedColumns();
    const numberOfRows = this.hot.countRows();

    // Function `getDataAtCell` won't call the indices translation inside `onModifyRow` callback - we check the `blockPluginTranslation`
    // flag inside it (we just want to get data not already modified by `columnSorting` plugin translation).
    this.blockPluginTranslation = true;

    const getDataForSortedColumns = (visualRowIndex: number): unknown[] =>
      sortedColumnsList.map(physicalColumn => this.hot.getDataAtCell(visualRowIndex, this.hot.toVisualColumn(physicalColumn)));

    for (let visualRowIndex = 0; visualRowIndex < this.getNumberOfRowsToSort(numberOfRows); visualRowIndex += 1) {
      indexesWithData.push([visualRowIndex, ...getDataForSortedColumns(visualRowIndex)]);
    }

    sort(
      indexesWithData,
      this.pluginKey,
      sortedColumnsList.map(physicalColumn => this.columnStatesManager.getSortOrderOfColumn(physicalColumn)),
      sortedColumnsList.map(physicalColumn => this.getFirstCellSettings(this.hot.toVisualColumn(physicalColumn)))
    );

    // Append spareRows
    for (let visualRowIndex = indexesWithData.length; visualRowIndex < numberOfRows; visualRowIndex += 1) {
      indexesWithData.push([visualRowIndex, ...getDataForSortedColumns(visualRowIndex)]);
    }

    // The blockade of the indices translation is released.
    this.blockPluginTranslation = false;

    // Save all indexes to arrayMapper, a completely new sequence is set by the plugin
    this.rowsMapper._arrayMap = indexesWithData.map(indexWithData => indexWithData[0]);
  }

  /**
   * Load saved settings or sort by predefined plugin configuration.
   *
   * @private
   */
  loadOrSortBySettings(): void {
    this.columnMetaCache.clear();

    const storedAllSortSettings = this.getAllSavedSortSettings();

    if (isObject(storedAllSortSettings)) {
      this.sortBySettings(storedAllSortSettings);

    } else {
      const allSortSettings = this.hot.getSettings()[this.pluginKey];

      this.sortBySettings(allSortSettings);
    }
  }

  /**
   * Sort the table by provided configuration.
   *
   * @private
   * @param allSortSettings All sort config settings. Object may contain `initialConfig`, `indicator`,
   * `sortEmptyCells`, `headerAction` and `compareFunctionFactory` properties.
   */
  sortBySettings(allSortSettings: unknown): void {
    if (isObject(allSortSettings)) {
      this.columnStatesManager.updateAllColumnsProperties(allSortSettings);

      const { initialConfig } = allSortSettings as AllSortSettings;

      if (Array.isArray(initialConfig) || isObject(initialConfig)) {
        this.sort(initialConfig);
      }

    } else {
      // Extra render for headers. Their width may change.
      this.hot.render();
    }
  }

  /**
   * Enables the ObserveChanges plugin.
   *
   * @private
   */
  enableObserveChangesPlugin(): void {
    this.hot._registerTimeout(
      setTimeout(() => {
        this.hot.updateSettings({
          observeChanges: true
        });
      }, 0));
  }

  /**
   * Callback for `modifyRow` hook. Translates visual row index to the sorted row index.
   *
   * @private
   * @param row Visual row index.
   * @returns Physical row index.
   */
  onModifyRow(row: number, source?: string): number {
    if (this.blockPluginTranslation === false && source !== this.pluginName && this.isSorted()) {
      const rowInMapper = this.rowsMapper.getValueByIndex(row);

      return rowInMapper === null ? row : rowInMapper;
    }

    return row;
  }

  /**
   * Callback for `unmodifyRow` hook. Translates sorted row index to visual row index.
   *
   * @private
   * @param row Physical row index.
   * @returns Visual row index.
   */
  onUnmodifyRow(row: number, source?: string): number | null {
    if (this.blockPluginTranslation === false && source !== this.pluginName && this.isSorted()) {
      return this.rowsMapper.getIndexByValue(row);
    }

    return row;
  }

  /**
   * Callback for the `onAfterGetColHeader` hook. Adds column sorting CSS classes.
   *
   * @private
   * @param column Visual column index.
   * @param TH TH HTML element.
   */
  onAfterGetColHeader(column: number, TH: HTMLTableCellElement): void {
    const headerSpanElement = getHeaderSpanElement(TH);

    if (isFirstLevelColumnHeader(column, TH) === false || headerSpanElement === null) {
      return;
    }

    const physicalColumn = this.hot.toPhysicalColumn(column);
    const pluginSettingsForColumn = this.getFirstCellSettings(column)[this.pluginKey] as SortSettings;
    const showSortIndicator = pluginSettingsForColumn.indicator;
    const headerActionEnabled = pluginSettingsForColumn.headerAction;

    this.updateHeaderClasses(headerSpanElement, this.columnStatesManager, physicalColumn, showSortIndicator, headerActionEnabled);
  }

  /**
   * Update header classes.
   *
   * @private
   * @param headerSpanElement Header span element.
   * @param args Extra arguments for helpers.
   */
  updateHeaderClasses(headerSpanElement: Element, ...args: Parameters<typeof getClassesToAdd> | []): void {
    removeClass(headerSpanElement, getClassedToRemove());

    if (this.enabled !== false) {
      addClass(headerSpanElement, getClassesToAdd(...(args as Parameters<typeof getClassesToAdd>)));
    }
  }

  /**
   * Overwriting base plugin's `onUpdateSettings` method. Please keep in mind that `onAfterUpdateSettings` isn't called
   * for `updateSettings` in specific situations.
   *
   * @private
   * @param newSettings New settings object.
   */
  onUpdateSettings(newSettings: Record<string, unknown>): void {
    super.onUpdateSettings();

    this.columnMetaCache.clear();

    if (isDefined(newSettings[this.pluginKey])) {
      this.sortBySettings(newSettings[this.pluginKey]);
    }
  }

  /**
   * Callback for the `afterLoadData` hook.
   *
   * @private
   * @param initialLoad flag that determines whether the data has been loaded during the initialization.
   */
  onAfterLoadData(initialLoad: boolean): void {
    this.rowsMapper.clearMap();
    this.columnMetaCache.clear();

    if (initialLoad === true) {
      // TODO: Workaround? It should be refactored / described.
      if (this.hot.view) {
        this.loadOrSortBySettings();
      }
    }
  }

  /**
   * Callback for the `afterCreateRow` hook.
   *
   * @private
   * @param index Visual index of the created row.
   * @param amount Amount of created rows.
   */
  onAfterCreateRow(index: number, amount: number): void {
    this.rowsMapper.shiftItems(index, amount);
  }

  /**
   * Callback for the `afterRemoveRow` hook.
   *
   * @private
   * @param removedRows Visual indexes of the removed row.
   * @param amount  Amount of removed rows.
   */
  onAfterRemoveRow(removedRows: number, amount: number): void {
    this.rowsMapper.unshiftItems(removedRows, amount);
  }

  // TODO: Workaround. Inheriting of non-primitive cell meta values doesn't work. We clear the cache after action which reorganize sequence of columns.
  // TODO: Remove test named: "should add new columns properly when the `columnSorting` plugin is enabled (inheriting of non-primitive cell meta values)".
  /**
   * Callback for the `afterCreateCol` hook.
   *
   * @private
   */
  onAfterCreateCol(): void {
    this.columnMetaCache.clear();
  }

  // TODO: Workaround. Inheriting of non-primitive cell meta values doesn't work. We clear the cache after action which reorganize sequence of columns.
  // TODO: Remove test named: "should add new columns properly when the `columnSorting` plugin is enabled (inheriting of non-primitive cell meta values)".
  /**
   * Callback for the `afterRemoveCol` hook.
   *
   * @private
   */
  onAfterRemoveCol(): void {
    this.columnMetaCache.clear();
  }

  /**
   * Indicates if clickable header was clicked.
   *
   * @private
   * @param event The `mousedown` event.
   * @param column Visual column index.
   */
  wasClickableHeaderClicked(event: GridMouseEvent, column: number): boolean {
    const pluginSettingsForColumn = this.getFirstCellSettings(column)[this.pluginKey] as SortSettings;

    return !!pluginSettingsForColumn.headerAction && event.realTarget.nodeName === 'SPAN';
  }

  /**
   * Changes the behavior of selection / dragging.
   *
   * @private
   * @param event The `mousedown` event.
   * @param coords Visual coordinates.
   * @param TD
   * @param blockCalculations
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onBeforeOnCellMouseDown(event: GridMouseEvent, coords: CellCoords, TD: HTMLTableCellElement,
    blockCalculations: { column?: boolean }): void {
    if (wasHeaderClickedProperly(coords.row, coords.col, event) === false) {
      return;
    }

    if (this.wasClickableHeaderClicked(event, coords.col) && isPressedCtrlKey()) {
      blockCalculations.column = true;
    }
  }

  /**
   * Callback for the `onAfterOnCellMouseDown` hook.
   *
   * @private
   * @param event Event which are provided by hook.
   * @param coords Visual coords of the selected cell.
   */
  onAfterOnCellMouseDown(event: GridMouseEvent, coords: CellCoords): void {
    if (wasHeaderClickedProperly(coords.row, coords.col, event) === false) {
      return;
    }

    if (this.wasClickableHeaderClicked(event, coords.col)) {
      if (isPressedCtrlKey()) {
        this.hot.deselectCell();
        this.hot.selectColumns(coords.col);
      }

      this.sort(this.getColumnNextConfig(coords.col));
    }
  }

  /**
   * Destroys the plugin instance.
   */
  destroy(): void {
    this.rowsMapper.destroy();
    this.columnStatesManager.destroy();

    super.destroy();
  }

  /** The sort states with physical columns (the plugin's state). */
  #toPhysical(sortConfigs: SortConfig[]): ColumnSortState[] {
    return sortConfigs.map(({ column: visualColumn, ...restOfProperties }) => (
      { column: this.hot.toPhysicalColumn(visualColumn), ...restOfProperties } as ColumnSortState));
  }

  /** A sort state with a visual column (as the API gives it). */
  #toVisual({ column: physicalColumn, ...restOfProperties }: ColumnSortState): SortConfig {
    return { column: this.hot.toVisualColumn(physicalColumn), ...restOfProperties };
  }
}

registerPlugin(PLUGIN_KEY, ColumnSorting);

export default ColumnSorting;
