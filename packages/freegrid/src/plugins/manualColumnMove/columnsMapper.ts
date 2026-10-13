import arrayMapper from './../../mixins/arrayMapper';
import type { ArrayMapper } from './../../mixins/arrayMapper';
import { mixin } from './../../helpers/object';
import type ManualColumnMove from './manualColumnMove';

/**
 * @class ColumnsMapper
 * @plugin ManualColumnMove
 *
 * The order of the columns: the physical column at each visual position.
 */
class ColumnsMapper {
  // From the arrayMapper mixin (on the prototype): `declare` keeps class fields from hiding them.
  declare _arrayMap: ArrayMapper['_arrayMap'];

  declare getValueByIndex: ArrayMapper['getValueByIndex'];

  declare getIndexByValue: ArrayMapper['getIndexByValue'];

  declare insertItems: ArrayMapper['insertItems'];

  declare removeItems: ArrayMapper['removeItems'];

  declare unshiftItems: ArrayMapper['unshiftItems'];

  declare shiftItems: ArrayMapper['shiftItems'];

  declare swapIndexes: ArrayMapper['swapIndexes'];

  declare clearMap: ArrayMapper['clearMap'];

  /**
   * Instance of ManualColumnMove plugin.
   */
  manualColumnMove: ManualColumnMove;

  constructor(manualColumnMove: ManualColumnMove) {
    this.manualColumnMove = manualColumnMove;
  }

  /**
   * Reset current map array and create new one.
   *
   * @param [length] Custom generated map length.
   */
  createMap(length?: number): void {
    const originLength = length === undefined ? this._arrayMap.length : length;

    this._arrayMap.length = 0;

    for (let itemIndex = 0; itemIndex < originLength; itemIndex += 1) {
      this._arrayMap[itemIndex] = itemIndex;
    }
  }

  /**
   * Destroy class.
   */
  destroy(): void {
    this._arrayMap = null!;
  }

  /**
   * Moving elements in columnsMapper: the column at `from` goes before `to` (its old place is `null` until
   * `clearNull()`).
   *
   * @param from Column index to move.
   * @param to Target index.
   */
  moveColumn(from: number, to: number): void {
    const indexToMove = this._arrayMap[from];

    (this._arrayMap as (number | null)[])[from] = null;
    this._arrayMap.splice(to, 0, indexToMove);
  }

  /**
   * Clearing arrayMap from `null` entries.
   */
  clearNull(): void {
    this._arrayMap = this._arrayMap.filter(i => i !== null);
  }
}

mixin(ColumnsMapper, arrayMapper);

export default ColumnsMapper;
