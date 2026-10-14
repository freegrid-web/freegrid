import { getProperty } from './helpers/object';
import { rangeEach } from './helpers/number';
import type { PluginHost } from './plugins/_base';

/** A row of the source data: an array, or an object (with properties). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- rows hold any values
export type SourceRow = any;

/** A column's property: an index, a path (`a.b`), or a function of the row. */
type ColumnProp = number | string | ((row: SourceRow) => unknown);

/**
 * @class DataSource
 * @private
 */
class DataSource {
  /**
   * Instance of FreeGrid.
   */
  hot: PluginHost;

  /**
   * Data source
   */
  data: SourceRow[];

  /**
   * Type of data source: `array` (rows are arrays) or `object`.
   *
   * @default 'array'
   */
  dataType = 'array';

  /** A visual column's property (set by the grid's data map). */
  colToProp: (column: number) => ColumnProp = () => undefined as unknown as ColumnProp;

  /** A property's visual column (set by the grid's data map). */
  propToCol: (prop: ColumnProp) => number = () => undefined as unknown as number;

  constructor(hotInstance: PluginHost, dataSource: SourceRow[] = []) {
    this.hot = hotInstance;
    this.data = dataSource;
  }

  /**
   * Get all data.
   *
   * @param [toArray=false] If `true` return source data as an array of arrays even when source data was provided
   *                                  in another format.
   */
  getData(toArray = false): SourceRow[] {
    let result = this.data;

    if (toArray) {
      result = this.getByRange(
        { row: 0, col: 0 },
        { row: Math.max(this.countRows() - 1, 0), col: Math.max(this.countColumns() - 1, 0) },
        true
      );
    }

    return result;
  }

  /**
   * Set new data source.
   *
   * @param data The rows.
   */
  setData(data: SourceRow[]): void {
    this.data = data;
  }

  /**
   * Returns array of column values from the data source. `column` is the index of the row in the data source.
   *
   * @param column Visual column index.
   */
  getAtColumn(column: number): unknown[] {
    const result: unknown[] = [];

    this.data.forEach((row) => {
      const property = this.colToProp(column);
      let value;

      if (typeof property === 'string') {
        value = getProperty(row, property);
      } else if (typeof property === 'function') {
        value = property(row);
      } else {
        value = row[property];
      }

      result.push(value);
    });

    return result;
  }

  /**
   * Returns a single row of the data (array or object, depending on what you have). `row` is the index of the row in the data source.
   *
   * @param row Physical row index.
   */
  getAtRow(row: number): SourceRow {
    return this.data[row];
  }

  /**
   * Returns a single value from the data.
   *
   * @param row Physical row index.
   * @param column Visual column index.
   */
  getAtCell(row: number, column: number): unknown {
    let result: unknown = null;

    const modifyRowData = this.hot.runHooks('modifyRowData', row);

    // A hook may give the row's data itself (instead of the row index).
    const dataRow = Number.isNaN(Number(modifyRowData)) ? modifyRowData : this.data[row];

    if (dataRow) {
      const prop = this.colToProp(column);

      if (typeof prop === 'string') {
        result = getProperty(dataRow, prop);

      } else if (typeof prop === 'function') {
        result = prop(this.data.slice(row, row + 1)[0]);

      } else {
        result = dataRow[prop];
      }
    }

    return result;
  }

  /**
   * Returns source data by passed range.
   *
   * @param start Object with physical `row` and `col` keys (or visual column index, if data type is an array of objects).
   * @param end Object with physical `row` and `col` keys (or visual column index, if data type is an array of objects).
   * @param [toArray=false] If `true` return source data as an array of arrays even when source data was provided
   *                                  in another format.
   */
  getByRange(start: { row: number; col: number }, end: { row: number; col: number }, toArray = false): SourceRow[] {
    const startRow = Math.min(start.row, end.row);
    const startCol = Math.min(start.col, end.col);
    const endRow = Math.max(start.row, end.row);
    const endCol = Math.max(start.col, end.col);
    const result: SourceRow[] = [];

    rangeEach(startRow, endRow, (currentRow) => {
      const row = this.getAtRow(currentRow);
      let newRow: SourceRow;

      if (this.dataType === 'array') {
        newRow = row.slice(startCol, endCol + 1);

      } else if (this.dataType === 'object') {
        newRow = toArray ? [] : {};

        rangeEach(startCol, endCol, (column) => {
          const prop = this.colToProp(column) as string | number;

          if (toArray) {
            newRow.push(row[prop]);
          } else {
            newRow[prop] = row[prop];
          }
        });
      }

      result.push(newRow);
    });

    return result;
  }

  /**
   * Count number of rows.
   *
   */
  countRows(): number {
    return Array.isArray(this.data) ? this.data.length : 0;
  }

  /**
   * Count number of columns.
   *
   */
  countColumns(): number {
    let result = 0;

    if (Array.isArray(this.data)) {
      if (this.dataType === 'array') {
        result = this.data[0].length;

      } else if (this.dataType === 'object') {
        result = Object.keys(this.data[0]).length;
      }
    }

    return result;
  }

  /**
   * Destroy instance.
   */
  destroy(): void {
    this.data = null!;
    this.hot = null;
  }
}

export default DataSource;
