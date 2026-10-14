export type Coordinate = { row: number; col: number };
export type GridDimensions = { getSetting(key: 'totalRows' | 'totalColumns'): number };

/**
 * CellCoords holds cell coordinates (row, column) and few method to validate them and retrieve as an array or an object.
 *
 * @util
 */
class CellCoords {
  // Empty coordinates retain null at runtime; grid consumers fill them before using indexes.
  declare row: number;
  declare col: number;
  constructor(row?: number | null, column?: number | null) {
    /**
     * Row index.
     *
     * @type {Number}
     */
    this.row = null!;
    /**
     * Column index.
     *
     * @type {Number}
     */
    this.col = null!;

    if (typeof row !== 'undefined' && typeof column !== 'undefined') {
      this.row = row!;
      this.col = column!;
    }
  }

  /**
   * Checks if given set of coordinates is valid in context of a given Walkontable instance.
   *
   * @param {Walkontable} wot A Walkontable instance.
   * @returns {Boolean}
   */
  isValid(wot: GridDimensions) {
    // is it a valid cell index (0 or higher)
    if (this.row < 0 || this.col < 0) {
      return false;
    }
    // is selection within total rows and columns
    if (this.row >= wot.getSetting('totalRows') || this.col >= wot.getSetting('totalColumns')) {
      return false;
    }

    return true;
  }

  /**
   * Checks if this cell coordinates are the same as cell coordinates given as an argument.
   *
   * @param {CellCoords} cellCoords Cell coordinates to equal.
   * @returns {Boolean}
   */
  isEqual(cellCoords: Coordinate) {
    if (cellCoords === this) {
      return true;
    }

    return this.row === cellCoords.row && this.col === cellCoords.col;
  }

  /**
   * Checks if tested coordinates are positioned in south-east from this cell coordinates.
   *
   * @param {Object} testedCoords Cell coordinates to check.
   * @returns {Boolean}
   */
  isSouthEastOf(testedCoords: Coordinate) {
    return this.row >= testedCoords.row && this.col >= testedCoords.col;
  }

  /**
   * Checks if tested coordinates are positioned in north-east from this cell coordinates.
   *
   * @param {Object} testedCoords Cell coordinates to check.
   * @returns {Boolean}
   */
  isNorthWestOf(testedCoords: Coordinate) {
    return this.row <= testedCoords.row && this.col <= testedCoords.col;
  }

  /**
   * Checks if tested coordinates are positioned in south-west from this cell coordinates.
   *
   * @param {Object} testedCoords Cell coordinates to check.
   * @returns {Boolean}
   */
  isSouthWestOf(testedCoords: Coordinate) {
    return this.row >= testedCoords.row && this.col <= testedCoords.col;
  }

  /**
   * Checks if tested coordinates are positioned in north-east from this cell coordinates.
   *
   * @param {Object} testedCoords Cell coordinates to check.
   * @returns {Boolean}
   */
  isNorthEastOf(testedCoords: Coordinate) {
    return this.row <= testedCoords.row && this.col >= testedCoords.col;
  }

  /**
   * Converts CellCoords to literal object with `row` and `col` properties.
   *
   * @return {Object} Returns a literal object with `row` and `col` properties.
   */
  toObject() {
    return {
      row: this.row,
      col: this.col,
    };
  }
}

export default CellCoords;
