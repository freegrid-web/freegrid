import MergedCellCoords from './cellCoords';
import type { MergedCellInfo } from './cellCoords';
import { CellCoords, CellRange } from '../../3rdparty/walkontable/src/index';
import { rangeEachReverse } from '../../helpers/number';
import { warn } from '../../helpers/console';
import { applySpanProperties } from './utils';
import { toSingleLine } from './../../helpers/templateLiteralTag';
import type MergeCells from './mergeCells';
import type { PluginHost } from './../_base';

/** A range, as `CellRange` or as a plain object. */
type RangeLike = { from: { row: number; col: number }; to: { row: number; col: number } };

/**
 * Defines a container object for the merged cells.
 *
 * @class MergedCellsCollection
 * @plugin MergeCells
 */
class MergedCellsCollection {
  /**
   * Reference to the Merge Cells plugin.
   */
  plugin: MergeCells;

  /**
   * Array of merged cells.
   */
  mergedCells: MergedCellCoords[] = [];

  /**
   * The FreeGrid instance.
   */
  hot: PluginHost;

  constructor(plugin: MergeCells) {
    this.plugin = plugin;
    this.hot = plugin.hot;
  }

  /**
   * Get a warning message for when the declared merged cell data overlaps already existing merged cells.
   *
   * @param newMergedCell Object containg information about the merged cells that was about to be added.
   */
  static IS_OVERLAPPING_WARNING(newMergedCell: MergedCellInfo): string {
    return toSingleLine`The merged cell declared at [${newMergedCell.row}, ${newMergedCell.col}], overlaps with the other declared merged 
    cell. The overlapping merged cell was not added to the table, please fix your setup.`;
  }

  /**
   * Get a merged cell from the container, based on the provided arguments. You can provide either the "starting coordinates"
   * of a merged cell, or any coordinates from the body of the merged cell.
   *
   * @param row Row index.
   * @param column Column index.
   * @returns Returns a wanted merged cell on success and `false` on failure.
   */
  get(row: number, column: number): MergedCellCoords | false {
    return this.mergedCells.find(mergedCell => mergedCell.row <= row && mergedCell.row + mergedCell.rowspan - 1 >= row &&
      mergedCell.col <= column && mergedCell.col + mergedCell.colspan - 1 >= column) || false;
  }

  /**
   * Get a merged cell containing the provided range.
   *
   * @param range The range to search merged cells for.
   * @returns The merged cell, or `false`.
   */
  getByRange(range: RangeLike): MergedCellCoords | false {
    return this.mergedCells.find(mergedCell => mergedCell.row <= range.from.row &&
      mergedCell.row + mergedCell.rowspan - 1 >= range.to.row && mergedCell.col <= range.from.col &&
      mergedCell.col + mergedCell.colspan - 1 >= range.to.col) || false;
  }

  /**
   * Get a merged cell contained in the provided range.
   *
   * @param range The range to search merged cells in.
   * @param [countPartials=false] If set to `true`, all the merged cells overlapping the range will be taken into calculation.
   * @returns Array of found merged cells of `false` if none were found.
   */
  getWithinRange(range: RangeLike | CellRange, countPartials = false): MergedCellCoords[] | false {
    let testedRange = range as CellRange;

    if (!testedRange.includesRange) {
      const from = new CellCoords(range.from.row, range.from.col);
      const to = new CellCoords(range.to.row, range.to.col);

      testedRange = new CellRange(from, from, to);
    }

    const foundMergedCells = this.mergedCells.filter((mergedCell) => {
      const mergedCellRange = mergedCell.getRange();

      return countPartials ? testedRange.overlaps(mergedCellRange) : testedRange.includesRange(mergedCellRange);
    });

    return foundMergedCells.length ? foundMergedCells : false;
  }

  /**
   * Add a merged cell to the container.
   *
   * @param mergedCellInfo The merged cell information object. Has to contain `row`, `col`, `colspan` and `rowspan` properties.
   * @returns Returns the new merged cell on success and `false` on failure.
   */
  add(mergedCellInfo: MergedCellInfo): MergedCellCoords | false {
    const { row, col: column, rowspan, colspan } = mergedCellInfo;
    const newMergedCell = new MergedCellCoords(row, column, rowspan, colspan);
    const alreadyExists = this.get(row, column);
    const isOverlapping = this.isOverlapping(newMergedCell);

    if (!alreadyExists && !isOverlapping) {
      if (this.hot) {
        newMergedCell.normalize(this.hot);
      }

      this.mergedCells.push(newMergedCell);

      return newMergedCell;
    }

    warn(MergedCellsCollection.IS_OVERLAPPING_WARNING(newMergedCell));

    return false;
  }

  /**
   * Remove a merged cell from the container. You can provide either the "starting coordinates"
   * of a merged cell, or any coordinates from the body of the merged cell.
   *
   * @param row Row index.
   * @param column Column index.
   * @returns Returns the removed merged cell on success and `false` on failure.
   */
  remove(row: number, column: number): MergedCellCoords | false {
    const wantedCollection = this.get(row, column);

    if (wantedCollection) {
      this.mergedCells.splice(this.mergedCells.indexOf(wantedCollection), 1);

      return wantedCollection;
    }

    return false;
  }

  /**
   * Clear all the merged cells: their first cells stop spanning, and the cells they hid are shown.
   */
  clear(): void {
    const mergedCellsToClear = this.mergedCells
      .map(mergedCell => [this.hot.getCell(mergedCell.row, mergedCell.col), mergedCell] as const)
      .filter((pair): pair is readonly [HTMLTableCellElement, typeof pair[1]] => pair[0] !== null);

    this.mergedCells.length = 0;

    mergedCellsToClear.forEach(([TD, mergedCell]) => {
      applySpanProperties(TD, null, mergedCell.row, mergedCell.col);

      for (let j = 0; j < mergedCell.rowspan; j += 1) {
        for (let k = 0; k < mergedCell.colspan; k += 1) {
          const hiddenTD = k !== 0 || j !== 0 ? this.hot.getCell(mergedCell.row + j, mergedCell.col + k) : null;

          if (hiddenTD) {
            applySpanProperties(hiddenTD, null, mergedCell.row + j, mergedCell.col + k);
          }
        }
      }
    });
  }

  /**
   * Check if the provided merged cell overlaps with the others in the container.
   *
   * @param mergedCell The merged cell to check against all others in the container.
   * @returns `true` if the provided merged cell overlaps with the others, `false` otherwise.
   */
  isOverlapping(mergedCell: MergedCellInfo): boolean {
    const toRange = ({ row, col, rowspan, colspan }: MergedCellInfo) => new CellRange(null as unknown as CellCoords,
      new CellCoords(row, col), new CellCoords(row + rowspan - 1, col + colspan - 1));
    const mergedCellRange = toRange(mergedCell);

    return this.mergedCells.some(otherCell => toRange(otherCell).overlaps(mergedCellRange));
  }

  /**
   * Check whether the provided row/col coordinates direct to a merged parent.
   *
   * @param row Row index.
   * @param column Column index.
   */
  isMergedParent(row: number, column: number): boolean {
    return this.mergedCells.some(mergedCell => mergedCell.row === row && mergedCell.col === column);
  }

  /**
   * Shift the merged cell in the direction and by an offset defined in the arguments.
   *
   * @param direction `right`, `left`, `up` or `down`.
   * @param index Index where the change, which caused the shifting took place.
   * @param count Number of rows/columns added/removed in the preceding action.
   */
  shiftCollections(direction: string, index: number, count: number): void {
    const shiftVector: [number, number] = [0, 0];

    switch (direction) {
      case 'right':
        shiftVector[0] += count;
        break;

      case 'left':
        shiftVector[0] -= count;
        break;

      case 'down':
        shiftVector[1] += count;
        break;

      case 'up':
        shiftVector[1] -= count;
        break;

      default:
    }

    this.mergedCells.forEach((currentMerge) => {
      currentMerge.shift(shiftVector, index);
    });

    rangeEachReverse(this.mergedCells.length - 1, 0, (i) => {
      const currentMerge = this.mergedCells[i];

      if (currentMerge && currentMerge.removed) {
        this.mergedCells.splice(this.mergedCells.indexOf(currentMerge), 1);
      }
    });
  }
}

export default MergedCellsCollection;
