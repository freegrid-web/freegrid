import { isObject, objectEach, deepClone } from '../../helpers/object';
import type { ColumnSortState, CompareFunctionFactory, SortOrder, SortSettings } from './utils';

const inheritedColumnProperties = ['sortEmptyCells', 'indicator', 'headerAction', 'compareFunctionFactory'];

const SORT_EMPTY_CELLS_DEFAULT = false;
const SHOW_SORT_INDICATOR_DEFAULT = true;
const HEADER_ACTION_DEFAULT = true;

/**
 * Store and manages states of sorted columns.
 *
 * @class ColumnStatesManager
 * @plugin ColumnSorting
 */
// eslint-disable-next-line import/prefer-default-export
export class ColumnStatesManager {
  /**
   * Queue of sort states containing sorted columns and their orders (Array of objects containing `column` and `sortOrder` properties).
   */
  sortedColumnsStates: ColumnSortState[] = [];

  /**
   * Determines whether we should sort empty cells.
   */
  sortEmptyCells = SORT_EMPTY_CELLS_DEFAULT;

  /**
   * Determines whether indicator should be visible (for sorted columns).
   */
  indicator = SHOW_SORT_INDICATOR_DEFAULT;

  /**
   * Determines whether click on the header perform sorting.
   */
  headerAction = HEADER_ACTION_DEFAULT;

  /**
   * Determines compare function factory. Method get as parameters `sortOder` and `columnMeta` and return compare function.
   */
  compareFunctionFactory: CompareFunctionFactory | undefined = undefined;

  /**
   * Update column properties which affect the sorting result.
   *
   * **Note**: All column properties can be overwritten by [columns](https://github.com/freegrid-web/freegrid) option.
   *
   * @param allSortSettings Column sorting plugin's configuration object.
   */
  updateAllColumnsProperties(allSortSettings: unknown): void {
    if (!isObject(allSortSettings)) {
      return;
    }

    objectEach(allSortSettings, (newValue, propertyName) => {
      if (inheritedColumnProperties.includes(propertyName)) {
        (this as unknown as Record<string, unknown>)[propertyName] = newValue;
      }
    });
  }

  /**
   * Get all column properties which affect the sorting result.
   *
   */
  getAllColumnsProperties(): SortSettings {
    const columnProperties: SortSettings = {
      sortEmptyCells: this.sortEmptyCells,
      indicator: this.indicator,
      headerAction: this.headerAction
    };

    if (typeof this.compareFunctionFactory === 'function') {
      columnProperties.compareFunctionFactory = this.compareFunctionFactory;
    }

    return columnProperties;
  }

  /**
   * Get index of first sorted column.
   *
   */
  getFirstSortedColumn(): number | undefined {
    return this.sortedColumnsStates[0]?.column;
  }

  /**
   * Get sort order of column.
   *
   * @param searchedColumn Physical column index.
   * @returns Sort order (`asc` for ascending, `desc` for descending and undefined for not sorted).
   */
  getSortOrderOfColumn(searchedColumn: number): SortOrder | undefined {
    const searchedState = this.sortedColumnsStates.find(({ column }) => searchedColumn === column);

    return isObject(searchedState) ? searchedState!.sortOrder : undefined;
  }

  /**
   * Get list of sorted columns.
   *
   */
  getSortedColumns(): number[] {
    return this.sortedColumnsStates.map(({ column }) => column);
  }

  /**
   * Get order of particular column in the states queue.
   *
   * @param column Physical column index.
   */
  getIndexOfColumnInSortQueue(column: number): number {
    return this.getSortedColumns().indexOf(column);
  }

  /**
   * Get number of sorted columns.
   *
   */
  getNumberOfSortedColumns(): number {
    return this.sortedColumnsStates.length;
  }

  /**
   * Get if list of sorted columns is empty.
   *
   */
  isListOfSortedColumnsEmpty(): boolean {
    return this.getNumberOfSortedColumns() === 0;
  }

  /**
   * Get if particular column is sorted.
   *
   * @param column Physical column index.
   */
  isColumnSorted(column: number): boolean {
    return this.getSortedColumns().includes(column);
  }

  /**
   * Get states for all sorted columns.
   *
   */
  getSortStates(): ColumnSortState[] {
    return deepClone(this.sortedColumnsStates);
  }

  /**
   * Get sort state for particular column. Object contains `column` and `sortOrder` properties.
   *
   * **Note**: Please keep in mind that returned objects expose **physical** column index under the `column` key.
   *
   * @param column Physical column index.
   */
  getColumnSortState(column: number): ColumnSortState | undefined {
    return this.isColumnSorted(column) ?
      deepClone(this.sortedColumnsStates[this.getIndexOfColumnInSortQueue(column)]) : undefined;
  }

  /**
   * Set all sorted columns states.
   *
   * @param sortStates The sorted columns, first sorted first.
   */
  setSortStates(sortStates: ColumnSortState[]): void {
    this.sortedColumnsStates = sortStates;
  }

  /**
   * Destroy the state manager.
   */
  destroy(): void {
    this.sortedColumnsStates.length = 0;
    this.sortedColumnsStates = null!;
  }
}
