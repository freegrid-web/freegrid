import HiddenIndexes from './hiddenIndexes';
import { registerPlugin } from './../../plugins';

/**
 * Hidden rows: hide rows from the context menu or with `hideRows`. A hidden row leaves the visual order (`countRows()`,
 * selection, the keyboard and copying skip it), and the row headers show where rows are hidden. Hidden rows are kept
 * as physical rows, so they stay hidden when the rows are sorted or moved.
 *
 * ```js
 * new FreeSheet(container, { data, rowHeaders: true, contextMenu: true, hiddenRows: { rows: [2, 3] } });
 * ```
 */
class HiddenRows extends HiddenIndexes {
  readonly axis = 'row' as const;

  /**
   * Hides rows.
   *
   * @param rows Visual row indexes.
   */
  hideRows(rows: number[]): void {
    this.hide(rows);
  }

  /**
   * Shows hidden rows.
   *
   * @param rows Physical row indexes (a hidden row has no visual index).
   */
  showRows(rows: number[]): void {
    this.show(rows);
  }

  /** Shows every hidden row. */
  showAllRows(): void {
    this.show(this.getHidden());
  }

  /** The hidden rows, as physical row indexes in ascending order. */
  getHiddenRows(): number[] {
    return this.getHidden();
  }
}

registerPlugin('hiddenRows', HiddenRows);

export default HiddenRows;
