import { CellCoords } from './../3rdparty/walkontable/src';
import { mixin } from './../helpers/object';
import localHooks from './../mixins/localHooks';
import type { LocalHooks } from './../mixins/localHooks';
import type SelectionRange from './range';

/** The table state that moving the selection depends on (read when needed). */
export type TransformationOptions = {
  countRows(): number;
  countCols(): number;
  fixedRowsBottom(): number;
  minSpareRows(): number;
  minSpareCols(): number;
  autoWrapRow(): boolean;
  autoWrapCol(): boolean;
};

/**
 * Moves the selection by a number of rows and columns (keyboard navigation), within the table, wrapping to the next
 * row or column with `autoWrapRow`/`autoWrapCol`, or asking for new rows or columns (`minSpareRows`/`minSpareCols`).
 * Local hooks: `beforeTransformStart`, `afterTransformStart`, `beforeTransformEnd`, `afterTransformEnd`,
 * `insertRowRequire`, `insertColRequire`.
 */
class Transformation {
  // From the localHooks mixin (on the prototype): `declare` keeps class fields from hiding them.
  declare addLocalHook: LocalHooks['addLocalHook'];

  declare runLocalHooks: LocalHooks['runLocalHooks'];

  declare clearLocalHooks: LocalHooks['clearLocalHooks'];

  range: SelectionRange;

  options: TransformationOptions;

  constructor(range: SelectionRange, options: TransformationOptions) {
    this.range = range;
    this.options = options;
  }

  /**
   * The cell `rowDelta` rows and `colDelta` columns from the current cell, kept within the table. With `force`, moving
   * past the last row or column asks for a new one (when `minSpareRows`/`minSpareCols` allow it).
   */
  transformStart(rowDelta: number, colDelta: number, force?: boolean): CellCoords {
    const delta = new CellCoords(rowDelta, colDelta);

    this.runLocalHooks('beforeTransformStart', delta);

    let totalRows = this.options.countRows();
    let totalCols = this.options.countCols();
    const fixedRowsBottom = this.options.fixedRowsBottom();
    const minSpareRows = this.options.minSpareRows();
    const minSpareCols = this.options.minSpareCols();
    const autoWrapRow = this.options.autoWrapRow();
    const autoWrapCol = this.options.autoWrapCol();
    const highlightCoords = this.range.current()!.highlight;

    if (highlightCoords.row + rowDelta > totalRows - 1) {
      if (force && minSpareRows > 0 && !(fixedRowsBottom && highlightCoords.row >= totalRows - fixedRowsBottom - 1)) {
        this.runLocalHooks('insertRowRequire', totalRows);
        totalRows = this.options.countRows();
      } else if (autoWrapCol) {
        delta.row = 1 - totalRows;
        delta.col = highlightCoords.col + delta.col === totalCols - 1 ? 1 - totalCols : 1;
      }
    } else if (autoWrapCol && highlightCoords.row + delta.row < 0 && highlightCoords.col + delta.col >= 0) {
      delta.row = totalRows - 1;
      delta.col = highlightCoords.col + delta.col === 0 ? totalCols - 1 : -1;
    }

    if (highlightCoords.col + delta.col > totalCols - 1) {
      if (force && minSpareCols > 0) {
        this.runLocalHooks('insertColRequire', totalCols);
        totalCols = this.options.countCols();
      } else if (autoWrapRow) {
        delta.row = highlightCoords.row + delta.row === totalRows - 1 ? 1 - totalRows : 1;
        delta.col = 1 - totalCols;
      }
    } else if (autoWrapRow && highlightCoords.col + delta.col < 0 && highlightCoords.row + delta.row >= 0) {
      delta.row = highlightCoords.row + delta.row === 0 ? totalRows - 1 : -1;
      delta.col = totalCols - 1;
    }

    const [coords, rowTransformDir, colTransformDir] = Transformation.#clamp(
      new CellCoords(highlightCoords.row + delta.row, highlightCoords.col + delta.col), totalRows, totalCols);

    this.runLocalHooks('afterTransformStart', coords, rowTransformDir, colTransformDir);

    return coords;
  }

  /** The end of the current range moved by `rowDelta` rows and `colDelta` columns, kept within the table. */
  transformEnd(rowDelta: number, colDelta: number): CellCoords {
    const delta = new CellCoords(rowDelta, colDelta);

    this.runLocalHooks('beforeTransformEnd', delta);

    const cellRange = this.range.current()!;
    const [coords, rowTransformDir, colTransformDir] = Transformation.#clamp(
      new CellCoords(cellRange.to.row + delta.row, cellRange.to.col + delta.col),
      this.options.countRows(), this.options.countCols());

    this.runLocalHooks('afterTransformEnd', coords, rowTransformDir, colTransformDir);

    return coords;
  }

  /**
   * `coords` moved into the table, and which way each axis was pushed back (-1: it was before the start, 1: past the
   * end, 0: inside).
   */
  static #clamp(coords: CellCoords, totalRows: number, totalCols: number): [CellCoords, number, number] {
    let rowTransformDir = 0;
    let colTransformDir = 0;

    if (coords.row < 0) {
      rowTransformDir = -1;
      coords.row = 0;
    } else if (coords.row > 0 && coords.row >= totalRows) {
      rowTransformDir = 1;
      coords.row = totalRows - 1;
    }
    if (coords.col < 0) {
      colTransformDir = -1;
      coords.col = 0;
    } else if (coords.col > 0 && coords.col >= totalCols) {
      colTransformDir = 1;
      coords.col = totalCols - 1;
    }

    return [coords, rowTransformDir, colTransformDir];
  }
}

mixin(Transformation, localHooks);

export default Transformation;
