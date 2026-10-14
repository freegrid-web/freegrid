/**
 * @class ColumnFilter
 */
class ColumnFilter {
  declare offset: number;
  declare total: number;
  declare countTH: number;
  /**
   * @param {Number} offset
   * @param {Number} total
   * @param {Number} countTH
   */
  constructor(offset: number, total: number, countTH: number) {
    this.offset = offset;
    this.total = total;
    this.countTH = countTH;
  }

  /**
   * @param index
   * @returns {Number}
   */
  offsetted(index: number) {
    return index + this.offset;
  }

  /**
   * @param index
   * @returns {Number}
   */
  unOffsetted(index: number) {
    return index - this.offset;
  }

  /**
   * @param index
   * @returns {Number}
   */
  renderedToSource(index: number) {
    return this.offsetted(index);
  }

  /**
   * @param index
   * @returns {Number}
   */
  sourceToRendered(index: number) {
    return this.unOffsetted(index);
  }

  /**
   * @param index
   * @returns {Number}
   */
  offsettedTH(index: number) {
    return index - this.countTH;
  }

  /**
   * @param index
   * @returns {Number}
   */
  unOffsettedTH(index: number) {
    return index + this.countTH;
  }

  /**
   * @param index
   * @returns {Number}
   */
  visibleRowHeadedColumnToSourceColumn(index: number) {
    return this.renderedToSource(this.offsettedTH(index));
  }

  /**
   * @param index
   * @returns {Number}
   */
  sourceColumnToVisibleRowHeadedColumn(index: number) {
    return this.unOffsettedTH(this.sourceToRendered(index));
  }
}

export default ColumnFilter;
