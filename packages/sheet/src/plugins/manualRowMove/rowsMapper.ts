import arrayMapper, { invalidateArrayMap } from './../../mixins/arrayMapper';
import type { ArrayMapper } from './../../mixins/arrayMapper';
import { mixin } from './../../helpers/object';
import type ManualRowMove from './manualRowMove';

/**
 * @class RowsMapper
 * @plugin ManualRowMove
 *
 * The order of the rows: the physical row at each visual position.
 */
class RowsMapper {
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
   * Instance of ManualRowMove plugin.
   */
  manualRowMove: ManualRowMove;

  constructor(manualRowMove: ManualRowMove) {
    this.manualRowMove = manualRowMove;
  }

  /**
   * Reset current map array and create new one.
   *
   * @param [length] Custom generated map length.
   */
  createMap(length?: number): void {
    const originLength = length === undefined ? this._arrayMap.length : length;

    invalidateArrayMap(this._arrayMap);
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
   * Moving elements in rowsMapper: the row at `from` goes before `to` (its old place is `null` until
   * `clearNull()`).
   *
   * @param from Row index to move.
   * @param to Target index.
   */
  moveRow(from: number, to: number): void {
    const indexToMove = this._arrayMap[from];

    invalidateArrayMap(this._arrayMap);
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

mixin(RowsMapper, arrayMapper);

export default RowsMapper;
