import HiddenIndexes from './../hiddenRows/hiddenIndexes';
import { registerPlugin } from './../../plugins';

/**
 * Hidden columns: hide columns from the context menu or with `hideColumns`. A hidden column leaves the visual order
 * (`countCols()`, selection, the keyboard and copying skip it), and the column headers show where columns are hidden.
 * Hidden columns are kept as physical columns, so they stay hidden when the columns are moved.
 *
 * ```js
 * new FreeSheet(container, { data, colHeaders: true, contextMenu: true, hiddenColumns: { columns: [1] } });
 * ```
 */
class HiddenColumns extends HiddenIndexes {
  readonly axis = 'column' as const;

  /**
   * Hides columns.
   *
   * @param columns Visual column indexes.
   */
  hideColumns(columns: number[]): void {
    this.hide(columns);
  }

  /**
   * Shows hidden columns.
   *
   * @param columns Physical column indexes (a hidden column has no visual index).
   */
  showColumns(columns: number[]): void {
    this.show(columns);
  }

  /** Shows every hidden column. */
  showAllColumns(): void {
    this.show(this.getHidden());
  }

  /** The hidden columns, as physical column indexes in ascending order. */
  getHiddenColumns(): number[] {
    return this.getHidden();
  }
}

registerPlugin('hiddenColumns', HiddenColumns);

export default HiddenColumns;
