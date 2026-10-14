/**
 * Calculates indexes of columns to render OR columns that are visible.
 * To redo the calculation, you need to create a new calculator.
 *
 * @class ViewportColumnsCalculator
 */
class ViewportColumnsCalculator {
  #options: {
    viewportWidth: number;
    scrollOffset: number;
    totalColumns: number;
    columnWidthFn: (index: number) => number | undefined;
    overrideFn?: ((calculator: ViewportColumnsCalculator) => void) | null;
    onlyFullyVisible?: boolean;
    stretchingColumnWidthFn: (width: number | undefined, column: number) => number | undefined;
  };
  declare count: number;
  declare startColumn: number | null;
  declare endColumn: number | null;
  declare startPosition: number | null;
  declare stretchAllRatio: number;
  declare stretchLastWidth: number;
  declare stretch: string;
  #totalTargetWidth: number;
  declare needVerifyLastColumnWidth: boolean;
  declare stretchAllColumnsWidth: number[];

  /**
   * Default column width
   *
   * @type {Number}
   */
  static get DEFAULT_WIDTH() {
    return 50;
  }

  /**
   * @param {Number} viewportWidth Width of the viewport
   * @param {Number} scrollOffset Current horizontal scroll position of the viewport
   * @param {Number} totalColumns Total number of rows
   * @param {Function} columnWidthFn Function that returns the width of the column at a given index (in px)
   * @param {Function} overrideFn Function that changes calculated this.startRow, this.endRow (used by MergeCells plugin)
   * @param {Boolean} onlyFullyVisible if `true`, only startRow and endRow will be indexes of rows that are fully in viewport
   * @param {Boolean} stretchH
   * @param {Function} [stretchingColumnWidthFn] Function that returns the new width of the stretched column.
   */
  constructor(viewportWidth: number, scrollOffset: number, totalColumns: number,
              columnWidthFn: (column: number) => number | undefined,
              overrideFn: ((calculator: ViewportColumnsCalculator) => void) | null | undefined,
              onlyFullyVisible: boolean, stretchH: string,
              stretchingColumnWidthFn: (width: number | undefined, column: number) => number | undefined = width => width) {
    this.#options = {
      viewportWidth,
      scrollOffset,
      totalColumns,
      columnWidthFn,
      overrideFn,
      onlyFullyVisible,
      stretchingColumnWidthFn,
    };

    /**
     * Number of rendered/visible columns
     *
     * @type {Number}
     */
    this.count = 0;

    /**
     * Index of the first rendered/visible column (can be overwritten using overrideFn)
     *
     * @type {Number|null}
     */
    this.startColumn = null;

    /**
     * Index of the last rendered/visible column (can be overwritten using overrideFn)
     *
     * @type {null}
     */
    this.endColumn = null;

    /**
     * Position of the first rendered/visible column (in px)
     *
     * @type {Number|null}
     */
    this.startPosition = null;

    this.stretchAllRatio = 0;
    this.stretchLastWidth = 0;
    this.stretch = stretchH;
    this.#totalTargetWidth = 0;
    this.needVerifyLastColumnWidth = true;
    this.stretchAllColumnsWidth = [];

    this.calculate();
  }

  /**
   * Calculates viewport
   */
  calculate() {
    let sum = 0;
    let needReverse = true;
    const startPositions: number[] = [];
    let columnWidth!: number;

    const options = this.#options;
    const onlyFullyVisible = options.onlyFullyVisible;
    const overrideFn = options.overrideFn;
    const scrollOffset = options.scrollOffset;
    const totalColumns = options.totalColumns;
    const viewportWidth = options.viewportWidth;

    for (let i = 0; i < totalColumns; i++) {
      columnWidth = this._getColumnWidth(i);

      if (sum <= scrollOffset && !onlyFullyVisible) {
        this.startColumn = i;
      }

      // +1 pixel for row header width compensation for horizontal scroll > 0
      const compensatedViewportWidth = scrollOffset > 0 ? viewportWidth + 1 : viewportWidth;

      if (sum >= scrollOffset && sum + columnWidth <= scrollOffset + compensatedViewportWidth) {
        if (this.startColumn === null || this.startColumn === void 0) {
          this.startColumn = i;
        }
        this.endColumn = i;
      }
      startPositions.push(sum);
      sum += columnWidth;

      if (!onlyFullyVisible) {
        this.endColumn = i;
      }
      if (sum >= scrollOffset + viewportWidth) {
        needReverse = false;
        break;
      }
    }

    if (this.endColumn === totalColumns - 1 && needReverse) {
      this.startColumn = this.endColumn;

      while (this.startColumn > 0) {
        const viewportSum = startPositions[this.endColumn!] + columnWidth - startPositions[this.startColumn - 1];

        if (viewportSum <= viewportWidth || !onlyFullyVisible) {
          this.startColumn -= 1;
        }
        if (viewportSum > viewportWidth) {
          break;
        }
      }
    }

    if (this.startColumn !== null && overrideFn) {
      overrideFn(this);
    }
    this.startPosition = startPositions[this.startColumn!];

    if (this.startPosition === void 0) {
      this.startPosition = null;
    }
    if (this.startColumn !== null) {
      this.count = this.endColumn! - this.startColumn + 1;
    }
  }

  /**
   * Recalculate columns stretching.
   *
   * @param {Number} totalWidth
   */
  refreshStretching(totalWidth: number) {
    if (this.stretch === 'none') {
      return;
    }
    let totalColumnsWidth = totalWidth;
    this.#totalTargetWidth = totalColumnsWidth;

    const options = this.#options;
    const totalColumns = options.totalColumns;
    let sumAll = 0;

    for (let i = 0; i < totalColumns; i++) {
      const columnWidth = this._getColumnWidth(i);
      const permanentColumnWidth = options.stretchingColumnWidthFn(void 0, i);

      if (typeof permanentColumnWidth === 'number') {
        totalColumnsWidth -= permanentColumnWidth;
      } else {
        sumAll += columnWidth;
      }
    }
    const remainingSize = totalColumnsWidth - sumAll;

    if (this.stretch === 'all' && remainingSize > 0) {
      this.stretchAllRatio = totalColumnsWidth / sumAll;
      this.stretchAllColumnsWidth = [];
      this.needVerifyLastColumnWidth = true;

    } else if (this.stretch === 'last' && totalColumnsWidth !== Infinity) {
      const columnWidth = this._getColumnWidth(totalColumns - 1);
      const lastColumnWidth = remainingSize + columnWidth;

      this.stretchLastWidth = lastColumnWidth >= 0 ? lastColumnWidth : columnWidth;
    }
  }

  /**
   * Get stretched column width based on stretchH (all or last) setting passed in FreeSheet instance.
   *
   * @param {Number} column
   * @param {Number} baseWidth
   * @returns {Number|null}
   */
  getStretchedColumnWidth(column: number, baseWidth: number) {
    let result = null;

    if (this.stretch === 'all' && this.stretchAllRatio !== 0) {
      result = this._getStretchedAllColumnWidth(column, baseWidth);

    } else if (this.stretch === 'last' && this.stretchLastWidth !== 0) {
      result = this._getStretchedLastColumnWidth(column);
    }

    return result;
  }

  /**
   * @param {Number} column
   * @param {Number} baseWidth
   * @returns {Number}
   * @private
   */
  _getStretchedAllColumnWidth(column: number, baseWidth: number) {
    let sumRatioWidth = 0;
    const options = this.#options;
    const totalColumns = options.totalColumns;

    if (!this.stretchAllColumnsWidth[column]) {
      const stretchedWidth = Math.round(baseWidth * this.stretchAllRatio);
      const newStretchedWidth = options.stretchingColumnWidthFn(stretchedWidth, column);

      if (newStretchedWidth === void 0) {
        this.stretchAllColumnsWidth[column] = stretchedWidth;
      } else {
        this.stretchAllColumnsWidth[column] = isNaN(newStretchedWidth) ? this._getColumnWidth(column) : newStretchedWidth;
      }
    }

    if (this.stretchAllColumnsWidth.length === totalColumns && this.needVerifyLastColumnWidth) {
      this.needVerifyLastColumnWidth = false;

      for (let i = 0; i < this.stretchAllColumnsWidth.length; i++) {
        sumRatioWidth += this.stretchAllColumnsWidth[i];
      }
      if (sumRatioWidth !== this.#totalTargetWidth) {
        this.stretchAllColumnsWidth[this.stretchAllColumnsWidth.length - 1] += this.#totalTargetWidth - sumRatioWidth;
      }
    }

    return this.stretchAllColumnsWidth[column];
  }

  /**
   * @param {Number} column
   * @returns {Number|null}
   * @private
   */
  _getStretchedLastColumnWidth(column: number) {
    const options = this.#options;
    const totalColumns = options.totalColumns;

    if (column === totalColumns - 1) {
      return this.stretchLastWidth;
    }

    return null;
  }

  /**
   * @param {Number} column Column index.
   * @returns {Number}
   * @private
   */
  _getColumnWidth(column: number) {
    let width = this.#options.columnWidthFn(column) as number;

    if (isNaN(width)) {
      width = ViewportColumnsCalculator.DEFAULT_WIDTH;
    }

    return width;
  }
}

export default ViewportColumnsCalculator;
