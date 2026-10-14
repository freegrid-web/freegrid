import arrayMapper from '../../mixins/arrayMapper';
import type { ArrayMapper } from '../../mixins/arrayMapper';
import { mixin } from '../../helpers/object';

/**
 * @class RowsMapper
 *
 * The sorted order of the rows: the physical row at each visual position.
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
}

mixin(RowsMapper, arrayMapper);

export default RowsMapper;
