import SheetClip from './../lib/SheetClip/SheetClip';
import { cellMethodLookupFactory } from './helpers/data';
import { columnFactory } from './helpers/setting';
import {
  createObjectPropListener,
  deepClone,
  deepExtend,
  deepObjectSize,
  duckSchema,
  hasOwnProperty,
  isObject,
  objectEach
} from './helpers/object';
import { extendArray, to2dArray } from './helpers/array';
import Interval from './utils/interval';
import { rangeEach } from './helpers/number';
import MultiMap from './multiMap';
import type { SourceRow } from './dataSource';
import type Core from './core';

type Grid = Core;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- core.js is not typed yet
type GridPrivate = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the settings constructor of core.js
type GridSettingsConstructor = any;

/** A column's data property: an index, an object key (dots go into nested objects) or a getter/setter function. */
export type Prop = number | string | ((row: SourceRow, value?: unknown) => unknown);

/** A cell position (visual indexes). */
type Coords = { row: number; col: number };

/** Path segments that would reach `Object.prototype` through a dotted property. */
const UNSAFE_KEYS = ['__proto__', 'constructor', 'prototype'];

const isUnsafeProp = (prop: Prop): boolean => typeof prop === 'string' && prop.split('.').some(key => UNSAFE_KEYS.includes(key));

const copyableLookup = cellMethodLookupFactory('copyable', false);

/**
 * Gets and saves data from/to the data source, mapping column numbers to object property names.
 *
 * @util
 * @class DataMap
 */
class DataMap {
  /** `getRange` destination: the cell value. */
  readonly DESTINATION_RENDERER = 1;

  /** `getRange` destination: the cell value, or '' for cells with `copyable: false`. */
  readonly DESTINATION_CLIPBOARD_GENERATOR = 2;

  instance: Grid;
  priv: GridPrivate;
  GridSettings: GridSettingsConstructor;
  dataSource: SourceRow[];
  cachedLength: number | null = null;
  skipCache = false;
  latestSourceRowsCount = 0;
  duckSchema: object | unknown[] | null;
  interval: Interval | null;
  colToPropCache: Prop[] = [];
  propToColCache = new MultiMap<number>();

  /**
   * @param {Object} instance Instance of FreeGrid.
   * @param {Object} priv The grid's private state.
   * @param {Function} GridSettings Grid settings constructor.
   */
  constructor(instance: Grid, priv: GridPrivate, GridSettings: GridSettingsConstructor) {
    this.instance = instance;
    this.priv = priv;
    this.GridSettings = GridSettings;
    this.dataSource = this.instance.getSettings().data;

    if (this.dataSource && this.dataSource[0]) {
      this.duckSchema = this.recursiveDuckSchema(this.dataSource[0]);
    } else {
      this.duckSchema = {};
    }
    this.createMap();
    this.interval = Interval.create(() => this.clearLengthCache(), '15fps');

    this.instance.addHook('skipLengthCache', (delay: number) => this.onSkipLengthCache(delay));
    this.onSkipLengthCache(500);
  }

  /**
   * @param {Object|Array} object
   * @returns {Object|Array}
   */
  recursiveDuckSchema(object: unknown) {
    return duckSchema(object);
  }

  /**
   * @param {Object} schema
   * @param {Number} lastCol
   * @param {Number} parent
   * @returns {Number}
   */
  recursiveDuckColumns(schema: unknown, lastCol?: number, parent?: string): number {
    let lastColumn = lastCol;
    let propertyParent = parent;

    if (typeof lastColumn === 'undefined') {
      lastColumn = 0;
      propertyParent = '';
    }
    if (typeof schema === 'object' && !Array.isArray(schema)) {
      objectEach(schema as object, (value: unknown, key: string) => {
        if (value === null) {
          const prop = propertyParent + key;

          this.colToPropCache.push(prop);
          this.propToColCache.set(prop, lastColumn as number);

          lastColumn = (lastColumn as number) + 1;
        } else {
          lastColumn = this.recursiveDuckColumns(value, lastColumn, `${key}.`);
        }
      });
    }

    return lastColumn;
  }

  createMap(): void {
    const schema = this.getSchema();

    if (typeof schema === 'undefined') {
      throw new Error('trying to create `columns` definition but you didn\'t provide `schema` nor `data`');
    }

    this.colToPropCache = [];
    this.propToColCache = new MultiMap<number>();

    const columns = this.instance.getSettings().columns;

    if (columns) {
      const maxCols = this.instance.getSettings().maxCols;
      let columnsLen = Math.min(maxCols, columns.length);
      let filteredIndex = 0;
      let columnsAsFunc = false;
      const schemaLen = deepObjectSize(schema);

      if (typeof columns === 'function') {
        columnsLen = schemaLen > 0 ? schemaLen : this.instance.countSourceCols();
        columnsAsFunc = true;
      }

      for (let i = 0; i < columnsLen; i++) {
        const column = columnsAsFunc ? columns(i) : columns[i];

        if (isObject(column)) {
          if (typeof column.data !== 'undefined') {
            const index = columnsAsFunc ? filteredIndex : i;
            this.colToPropCache[index] = column.data as Prop;
            this.propToColCache.set(column.data, index);
          }

          filteredIndex += 1;
        }
      }

    } else {
      this.recursiveDuckColumns(schema);
    }
  }

  /**
   * Returns property name that corresponds with the given column index.
   *
   * @param {Number} col Visual column index.
   * @returns {Number} Physical column index.
   */
  colToProp(col: number): Prop {
    const physicalColumn = this.instance.runHooks('modifyCol', col);

    if (!isNaN(physicalColumn) && this.colToPropCache && typeof this.colToPropCache[physicalColumn] !== 'undefined') {
      return this.colToPropCache[physicalColumn];
    }

    return physicalColumn;
  }

  /**
   * @param {Object} prop
   * @fires Hooks#modifyCol
   * @returns {*}
   */
  propToCol(prop: Prop) {
    const cached = this.propToColCache.get(prop);
    const col = typeof cached === 'undefined' ? prop : cached;

    return this.instance.runHooks('unmodifyCol', col);
  }

  /**
   * @returns {Object}
   */
  getSchema() {
    const schema = this.instance.getSettings().dataSchema;

    if (schema) {
      if (typeof schema === 'function') {
        return schema();
      }
      return schema;
    }

    return this.duckSchema;
  }

  /**
   * Creates row at the bottom of the data array.
   *
   * @param {Number} [index] Physical index of the row before which the new row will be inserted.
   * @param {Number} [amount=1] An amount of rows to add.
   * @param {String} [source] Source of method call.
   * @fires Hooks#afterCreateRow
   * @returns {Number} Returns number of created rows.
   */
  createRow(index?: number, amount = 1, source?: string): number {
    let numberOfCreatedRows = 0;
    let rowIndex = index;

    if (typeof rowIndex !== 'number' || rowIndex >= this.instance.countSourceRows()) {
      rowIndex = this.instance.countSourceRows() as number;
    }

    const continueProcess = this.instance.runHooks('beforeCreateRow', rowIndex, amount, source);

    if (continueProcess === false) {
      return 0;
    }

    const maxRows = this.instance.getSettings().maxRows;
    const columnCount = this.instance.countCols();

    while (numberOfCreatedRows < amount && this.instance.countSourceRows() < maxRows) {
      let row: SourceRow = null;

      if (this.instance.dataType === 'array') {
        if (this.instance.getSettings().dataSchema) {
          // Clone template array
          row = deepClone(this.getSchema());

        } else {
          const cells: null[] = [];

          rangeEach(columnCount - 1, () => cells.push(null));
          row = cells;
        }

      } else if (this.instance.dataType === 'function') {
        row = this.instance.getSettings().dataSchema(rowIndex);

      } else {
        row = {};
        deepExtend(row, this.getSchema());
      }

      if (rowIndex === this.instance.countSourceRows()) {
        this.dataSource.push(row);

      } else {
        this.spliceData(rowIndex, 0, row);
      }

      numberOfCreatedRows += 1;
    }

    this.instance.runHooks('afterCreateRow', rowIndex, numberOfCreatedRows, source);
    this.instance.forceFullRender = true; // used when data was changed

    return numberOfCreatedRows;
  }

  /**
   * Creates col at the right of the data array.
   *
   * @param {Number} [index] Visual index of the column before which the new column will be inserted
   * @param {Number} [amount=1] An amount of columns to add.
   * @param {String} [source] Source of method call.
   * @fires Hooks#afterCreateCol
   * @returns {Number} Returns number of created columns
   */
  createCol(index?: number, amount = 1, source?: string): number {
    if (!this.instance.isColumnModificationAllowed()) {
      throw new Error('Cannot create new column. When data source in an object, ' +
        'you can only have as much columns as defined in first data row, data schema or in the \'columns\' setting.' +
        'If you want to be able to add new columns, you have to use array datasource.');
    }
    const rlen = this.instance.countSourceRows();
    const data = this.dataSource;
    const countColumns = this.instance.countCols();
    const columnIndex = typeof index !== 'number' || index >= countColumns ? countColumns : index;
    let numberOfCreatedCols = 0;

    this.instance.runHooks('beforeCreateCol', columnIndex, amount, source);

    let currentIndex = columnIndex;

    const maxCols = this.instance.getSettings().maxCols;
    while (numberOfCreatedCols < amount && this.instance.countCols() < maxCols) {
      const constructor = columnFactory(this.GridSettings, this.priv.columnsSettingConflicts);

      if (typeof columnIndex !== 'number' || columnIndex >= this.instance.countCols()) {
        if (rlen > 0) {
          for (let r = 0; r < rlen; r++) {
            if (typeof data[r] === 'undefined') {
              data[r] = [];
            }
            data[r].push(null);
          }
        } else {
          data.push([null]);
        }
        // Add new column constructor
        this.priv.columnSettings.push(constructor);

      } else {
        for (let row = 0; row < rlen; row++) {
          data[row].splice(currentIndex, 0, null);
        }
        // Add new column constructor at given index
        this.priv.columnSettings.splice(currentIndex, 0, constructor);
      }

      numberOfCreatedCols += 1;
      currentIndex += 1;
    }

    this.instance.runHooks('afterCreateCol', columnIndex, numberOfCreatedCols, source);
    this.instance.forceFullRender = true; // used when data was changed

    return numberOfCreatedCols;
  }

  /**
   * Removes row from the data array.
   *
   * @param {Number} [index] Visual index of the row to be removed. If not provided, the last row will be removed
   * @param {Number} [amount=1] Amount of the rows to be removed. If not provided, one row will be removed
   * @param {String} [source] Source of method call.
   * @fires Hooks#beforeRemoveRow
   * @fires Hooks#afterRemoveRow
   */
  removeRow(index?: number, amount = 1, source?: string): void {
    let rowIndex = typeof index !== 'number' ? -amount : index;
    const rowsAmount = this.instance.runHooks('modifyRemovedAmount', amount, rowIndex);

    rowIndex = (this.instance.countSourceRows() + rowIndex) % this.instance.countSourceRows();

    const logicRows = this.visualRowsToPhysical(rowIndex, rowsAmount);
    const actionWasNotCancelled = this.instance.runHooks('beforeRemoveRow', rowIndex, rowsAmount, logicRows, source);

    if (actionWasNotCancelled === false) {
      return;
    }

    const data = this.dataSource;
    const newData = this.filterData(rowIndex, rowsAmount);

    if (newData) {
      data.length = 0;
      Array.prototype.push.apply(data, newData);
    }

    this.instance.runHooks('afterRemoveRow', rowIndex, rowsAmount, logicRows, source);

    this.instance.forceFullRender = true; // used when data was changed
  }

  /**
   * Removes column from the data array.
   *
   * @param {Number} [index] Visual index of the column to be removed. If not provided, the last column will be removed
   * @param {Number} [amount=1] Amount of the columns to be removed. If not provided, one column will be removed
   * @param {String} [source] Source of method call.
   * @fires Hooks#beforeRemoveCol
   * @fires Hooks#afterRemoveCol
   */
  removeCol(index?: number, amount = 1, source?: string): void {
    if (this.instance.dataType === 'object' || this.instance.getSettings().columns) {
      throw new Error('cannot remove column with object data source or columns option specified');
    }
    let columnIndex = typeof index !== 'number' ? -amount : index;

    columnIndex = (this.instance.countCols() + columnIndex) % this.instance.countCols();

    const logicColumns = this.visualColumnsToPhysical(columnIndex, amount);
    const descendingLogicColumns = logicColumns.slice(0).sort((a, b) => b - a);
    const actionWasNotCancelled = this.instance.runHooks('beforeRemoveCol', columnIndex, amount, logicColumns, source);

    if (actionWasNotCancelled === false) {
      return;
    }

    let isTableUniform = true;
    const removedColumnsCount = descendingLogicColumns.length;
    const data = this.dataSource;

    for (let c = 0; c < removedColumnsCount; c++) {
      if (isTableUniform && logicColumns[0] !== logicColumns[c] - c) {
        isTableUniform = false;
      }
    }

    if (isTableUniform) {
      for (let r = 0, rlen = this.instance.countSourceRows(); r < rlen; r++) {
        data[r].splice(logicColumns[0], amount);
      }

    } else {
      for (let r = 0, rlen = this.instance.countSourceRows(); r < rlen; r++) {
        for (let c = 0; c < removedColumnsCount; c++) {
          data[r].splice(descendingLogicColumns[c], 1);
        }
      }

      for (let c = 0; c < removedColumnsCount; c++) {
        this.priv.columnSettings.splice(logicColumns[c], 1);
      }
    }

    this.instance.runHooks('afterRemoveCol', columnIndex, amount, logicColumns, source);

    this.instance.forceFullRender = true; // used when data was changed
  }

  /**
   * Add/Removes data from the column.
   *
   * @param {Number} col Physical index of column in which do you want to do splice
   * @param {Number} index Index at which to start changing the array. If negative, will begin that many elements from the end
   * @param {Number} amount An integer indicating the number of old array elements to remove. If amount is 0, no elements are removed
   * @param {Array} [elements]
   * @returns {Array} Returns removed portion of columns
   */
  spliceCol(col: number, index: number, amount: number, ...elements: unknown[]): unknown[] {
    const colData = this.instance.getDataAtCol(col);
    const removed = colData.slice(index, index + amount);
    const after = colData.slice(index + amount);

    extendArray(elements, after);
    for (let i = 0; i < amount; i++) {
      elements.push(null); // add null in place of removed elements
    }
    to2dArray(elements);
    this.instance.populateFromArray(index, col, elements, null, null, 'spliceCol');

    return removed;
  }

  /**
   * Add/Removes data from the row.
   *
   * @param {Number} row Physical index of row in which do you want to do splice
   * @param {Number} index Index at which to start changing the array. If negative, will begin that many elements from the end.
   * @param {Number} amount An integer indicating the number of old array elements to remove. If amount is 0, no elements are removed.
   * @param {Array} [elements]
   * @returns {Array} Returns removed portion of rows
   */
  spliceRow(row: number, index: number, amount: number, ...elements: unknown[]): unknown[] {
    const rowData = this.instance.getSourceDataAtRow(row);
    const removed = rowData.slice(index, index + amount);
    const after = rowData.slice(index + amount);

    extendArray(elements, after);
    for (let i = 0; i < amount; i++) {
      elements.push(null); // add null in place of removed elements
    }
    this.instance.populateFromArray(row, index, [elements], null, null, 'spliceRow');

    return removed;
  }

  /**
   * Add/remove row(s) to/from the data source.
   *
   * @param {Number} index Physical index of the element to remove.
   * @param {Number} amount Number of rows to add/remove.
   * @param {Object} element Row to add.
   */
  spliceData(index: number, amount: number, element: SourceRow): void {
    const continueSplicing = this.instance.runHooks('beforeDataSplice', index, amount, element);

    if (continueSplicing !== false) {
      this.dataSource.splice(index, amount, element);
    }
  }

  /**
   * Filter unwanted data elements from the data source.
   *
   * @param {Number} index Visual index of the element to remove.
   * @param {Number} amount Number of rows to add/remove.
   * @returns {Array}
   */
  filterData(index: number, amount: number): SourceRow[] | undefined {
    const physicalRows = this.visualRowsToPhysical(index, amount);
    const continueSplicing = this.instance.runHooks('beforeDataFilter', index, amount, physicalRows);

    if (continueSplicing !== false) {
      return this.dataSource.filter((row, rowIndex) => physicalRows.indexOf(rowIndex) === -1);
    }

    return undefined;
  }

  /**
   * Returns single value from the data array.
   *
   * @param {Number} row Visual row index.
   * @param {Number} prop
   */
  get(row: number, prop: Prop): unknown {
    const physicalRow = this.instance.runHooks('modifyRow', row);

    let dataRow = this.dataSource[physicalRow];
    // TODO: To remove, use 'modifyData' hook instead (see below)
    const modifiedRowData = this.instance.runHooks('modifyRowData', physicalRow);

    dataRow = isNaN(modifiedRowData) ? modifiedRowData : dataRow;
    //

    let value: unknown = null;

    // try to get value under property `prop` (includes dot)
    if (dataRow && dataRow.hasOwnProperty && hasOwnProperty(dataRow, prop as PropertyKey)) {
      value = dataRow[prop as PropertyKey];

    } else if (typeof prop === 'string' && prop.indexOf('.') > -1) {
      let out = dataRow;

      if (!out) {
        return null;
      }
      for (const key of prop.split('.')) {
        out = out[key];

        if (typeof out === 'undefined') {
          return null;
        }
      }
      value = out;

    } else if (typeof prop === 'function') {
      /**
       *  allows for interacting with complex structures, for example
       *  d3/jQuery getter/setter properties:
       *
       *    {columns: [{
       *      data: function(row, value){
       *        if(arguments.length === 1){
       *          return row.property();
       *        }
       *        row.property(value);
       *      }
       *    }]}
       */
      value = prop(this.dataSource.slice(physicalRow, physicalRow + 1)[0]);
    }

    if (this.instance.hasHook('modifyData')) {
      const valueHolder = createObjectPropListener(value);

      this.instance.runHooks('modifyData', physicalRow, this.propToCol(prop), valueHolder, 'get');

      if (valueHolder.isTouched()) {
        value = valueHolder.value;
      }
    }

    return value;
  }

  /**
   * Returns single value from the data array (intended for clipboard copy to an external application).
   *
   * @param {Number} row Physical row index.
   * @param {Number} prop
   * @returns {String}
   */
  getCopyable(row: number, prop: Prop): unknown {
    if (copyableLookup.call(this.instance, row, this.propToCol(prop))) {
      return this.get(row, prop);
    }
    return '';
  }

  /**
   * Saves single value to the data array. A property path through `__proto__`, `constructor` or `prototype` is
   * ignored, so data cannot change `Object.prototype`.
   *
   * @param {Number} row Visual row index.
   * @param {Number} prop
   * @param {String} value
   * @param {String} [source] Source of hook runner.
   */
  set(row: number, prop: Prop, value: unknown, source?: string): void {
    const physicalRow = this.instance.runHooks('modifyRow', row, source || 'datamapGet');
    let newValue = value;
    let dataRow = this.dataSource[physicalRow];
    // TODO: To remove, use 'modifyData' hook instead (see below)
    const modifiedRowData = this.instance.runHooks('modifyRowData', physicalRow);

    dataRow = isNaN(modifiedRowData) ? modifiedRowData : dataRow;
    //

    if (this.instance.hasHook('modifyData')) {
      const valueHolder = createObjectPropListener(newValue);

      this.instance.runHooks('modifyData', physicalRow, this.propToCol(prop), valueHolder, 'set');

      if (valueHolder.isTouched()) {
        newValue = valueHolder.value;
      }
    }

    if (isUnsafeProp(prop)) {
      return;
    }

    // try to set value under property `prop` (includes dot)
    if (dataRow && dataRow.hasOwnProperty && hasOwnProperty(dataRow, prop as PropertyKey)) {
      dataRow[prop as PropertyKey] = newValue;

    } else if (typeof prop === 'string' && prop.indexOf('.') > -1) {
      const sliced = prop.split('.');
      const last = sliced.pop() as string;
      let out = dataRow;

      for (const key of sliced) {
        if (typeof out[key] === 'undefined') {
          out[key] = {};
        }
        out = out[key];
      }
      out[last] = newValue;

    } else if (typeof prop === 'function') {
      /* see the `function` handler in `get` */
      prop(this.dataSource.slice(physicalRow, physicalRow + 1)[0], newValue);

    } else {
      dataRow[prop] = newValue;
    }
  }

  /**
   * This ridiculous piece of code maps rows Id that are present in table data to those displayed for user.
   * The trick is, the physical row id (stored in settings.data) is not necessary the same
   * as the visual (displayed) row id (e.g. when sorting is applied).
   *
   * @param {Number} index Visual row index.
   * @param {Number} amount
   * @fires Hooks#modifyRow
   * @returns {Number}
   */
  visualRowsToPhysical(index: number, amount: number): number[] {
    const totalRows = this.instance.countSourceRows();
    const logicRows: number[] = [];
    let physicRow = (totalRows + index) % totalRows;
    let rowsToRemove = amount;

    while (physicRow < totalRows && rowsToRemove) {
      logicRows.push(this.instance.runHooks('modifyRow', physicRow));

      rowsToRemove -= 1;
      physicRow += 1;
    }

    return logicRows;
  }

  /**
   *
   * @param index Visual column index.
   * @param amount
   * @returns {Array}
   */
  visualColumnsToPhysical(index: number, amount: number): number[] {
    const totalCols = this.instance.countCols();
    let physicalCol = (totalCols + index) % totalCols;
    const visualCols: number[] = [];
    let colsToRemove = amount;

    while (physicalCol < totalCols && colsToRemove) {
      visualCols.push(this.instance.runHooks('modifyCol', physicalCol));

      colsToRemove -= 1;
      physicalCol += 1;
    }

    return visualCols;
  }

  /**
   * Clears the data array.
   */
  clear(): void {
    for (let r = 0; r < this.instance.countSourceRows(); r++) {
      for (let c = 0; c < this.instance.countCols(); c++) {
        this.set(r, this.colToProp(c), '');
      }
    }
  }

  /**
   * Clear cached data length.
   */
  clearLengthCache(): void {
    this.cachedLength = null;
  }

  /**
   * Get data length.
   *
   * @returns {Number}
   */
  getLength(): number {
    const maxRowsFromSettings = this.instance.getSettings().maxRows;
    let maxRows;

    if (maxRowsFromSettings < 0 || maxRowsFromSettings === 0) {
      maxRows = 0;
    } else {
      maxRows = maxRowsFromSettings || Infinity;
    }

    let length = this.instance.countSourceRows();

    if (this.instance.hasHook('modifyRow')) {
      let reValidate = this.skipCache;

      this.interval?.start();
      if (length !== this.latestSourceRowsCount) {
        reValidate = true;
      }

      this.latestSourceRowsCount = length;
      if (this.cachedLength === null || reValidate) {
        rangeEach(length - 1, (row) => {
          const physicalRow = this.instance.runHooks('modifyRow', row);

          if (physicalRow === null) {
            length -= 1;
          }
        });
        this.cachedLength = length;

      } else {
        length = this.cachedLength;
      }
    } else {
      this.interval?.stop();
    }

    return Math.min(length, maxRows);
  }

  /**
   * Returns the data array.
   *
   * @returns {Array}
   */
  getAll(): unknown[][] {
    const start = {
      row: 0,
      col: 0,
    };

    const end = {
      row: Math.max(this.instance.countSourceRows() - 1, 0),
      col: Math.max(this.instance.countCols() - 1, 0),
    };

    if (start.row - end.row === 0 && !this.instance.countSourceRows()) {
      return [];
    }

    return this.getRange(start, end, this.DESTINATION_RENDERER);
  }

  /**
   * Returns data range as array.
   *
   * @param {Object} [start] Start selection position. Visual indexes.
   * @param {Object} [end] End selection position. Visual indexes.
   * @param {Number} destination Destination of datamap.get
   * @returns {Array}
   */
  getRange(start: Coords, end: Coords, destination: number): unknown[][] {
    const output: unknown[][] = [];

    const maxRows = this.instance.getSettings().maxRows;
    const maxCols = this.instance.getSettings().maxCols;

    if (maxRows === 0 || maxCols === 0) {
      return [];
    }

    const getFn = destination === this.DESTINATION_CLIPBOARD_GENERATOR ? this.getCopyable : this.get;

    const rlen = Math.min(Math.max(maxRows - 1, 0), Math.max(start.row, end.row));
    const clen = Math.min(Math.max(maxCols - 1, 0), Math.max(start.col, end.col));

    for (let r = Math.min(start.row, end.row); r <= rlen; r++) {
      const row: unknown[] = [];
      const physicalRow = this.instance.runHooks('modifyRow', r);

      for (let c = Math.min(start.col, end.col); c <= clen; c++) {

        if (physicalRow === null) {
          break;
        }
        row.push(getFn.call(this, r, this.colToProp(c)));
      }
      if (physicalRow !== null) {
        output.push(row);
      }
    }

    return output;
  }

  /**
   * Return data as text (tab separated columns).
   *
   * @param {Object} [start] Start selection position. Visual indexes.
   * @param {Object} [end] End selection position. Visual indexes.
   * @returns {String}
   */
  getText(start: Coords, end: Coords): string {
    return SheetClip.stringify(this.getRange(start, end, this.DESTINATION_RENDERER));
  }

  /**
   * Return data as copyable text (tab separated columns intended for clipboard copy to an external application).
   *
   * @param {Object} [start] Start selection position. Visual indexes.
   * @param {Object} [end] End selection position. Visual indexes.
   * @returns {String}
   */
  getCopyableText(start: Coords, end: Coords): string {
    return SheetClip.stringify(this.getRange(start, end, this.DESTINATION_CLIPBOARD_GENERATOR));
  }

  /**
   * `skipLengthCache` callback.
   * @private
   * @param {Number} delay Time of the delay in milliseconds.
   */
  onSkipLengthCache(delay: number): void {
    this.skipCache = true;
    setTimeout(() => {
      this.skipCache = false;
    }, delay);
  }

  /**
   * Destroy instance.
   */
  destroy(): void {
    this.interval?.stop();

    this.interval = null;
    this.instance = null!;
    this.priv = null;
    this.GridSettings = null;
    this.dataSource = null as unknown as SourceRow[];
    this.cachedLength = null;
    this.duckSchema = null;
  }
}

export default DataMap;
