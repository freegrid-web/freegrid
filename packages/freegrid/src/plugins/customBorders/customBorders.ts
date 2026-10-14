import BasePlugin from './../_base';
import { registerPlugin } from './../../plugins';
import { hasOwnProperty } from './../../helpers/object';
import { rangeEach } from './../../helpers/number';
import { CellRange } from './../../3rdparty/walkontable/src';
import * as C from './../../i18n/constants';
import {
  bottom,
  left,
  noBorders,
  right,
  top
} from './contextMenuItem';
import {
  createId,
  createDefaultCustomBorder,
  createSingleEmptyBorder,
  createEmptyBorders,
  extendDefaultBorder,
} from './utils';
import type { CellBorders, Side, SideBorder } from './utils';
import {
  detectSelectionType,
  normalizeSelectionFactory,
} from './../../selection';
import type { SelectionInput } from './../../selection/utils';
import type { MenuItem, SelectedRange } from './../contextMenu/menuItem';
import type { PluginHost } from './../_base';

/** A side, or `noBorders` (all sides). */
type Place = Side | 'noBorders';

/** A border of the `customBorders` setting: one cell (`row`, `col`) or a `range`, with its sides. */
type CustomBorderSetting = {
  row?: number;
  col?: number;
  range?: { from: { row: number; col: number }; to: { row: number; col: number } };
  [side: string]: unknown;
};

/** A custom selection of Walkontable that draws a cell's borders. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Walkontable is not typed yet
type BorderSelection = { settings: CellBorders; cellRange: CellRange | null; instanceBorders: Record<string, any>; clear(): void };

/**
 * @class CustomBorders
 * @plugin CustomBorders
 *
 * @description
 * This plugin enables an option to apply custom borders through the context menu (configurable with context menu key
 * `borders`).
 *
 * To initialize FreeGrid with predefined custom borders, provide cell coordinates and border styles in a form
 * of an array.
 *
 * See [Custom Borders](https://github.com/freegrid-web/freegrid) demo for more examples.
 *
 * @example
 * ```js
 * customBorders: [
 *   {
 *    range: {
 *      from: {
 *        row: 1,
 *        col: 1
 *      },
 *      to: {
 *        row: 3,
 *        col: 4
 *      },
 *    },
 *    left: {},
 *    right: {},
 *    top: {},
 *    bottom: {},
 *   },
 * ],
 *
 * // or
 * customBorders: [
 *   { row: 2,
 *     col: 2,
 *     left: {
 *       width: 2,
 *       color: 'red',
 *     },
 *     right: {
 *       width: 1,
 *       color: 'green',
 *     },
 *     top: '',
 *     bottom: '',
 *   }
 * ],
 * ```
 */
class CustomBorders extends BasePlugin {
  /**
   * Saved borders.
   *
   * @private
   */
  savedBorders: CellBorders[] = [];

  /**
   * Checks if the plugin is enabled in the FreeGrid settings. This method is executed in {@link Hooks#beforeInit}
   * hook and if it returns `true` than the {@link CustomBorders#enablePlugin} method is called.
   */
  isEnabled(): boolean {
    return !!this.hot.getSettings().customBorders;
  }

  /**
   * Enables the plugin functionality for this FreeGrid instance.
   */
  enablePlugin(): void {
    if (this.enabled) {
      return;
    }

    this.addHook('afterContextMenuDefaultOptions',
      (options: { items: MenuItem[] }) => this.onAfterContextMenuDefaultOptions(options));
    this.addHook('afterInit', () => this.onAfterInit());

    super.enablePlugin();
  }

  /**
   * Disables the plugin functionality for this FreeGrid instance.
   */
  disablePlugin(): void {
    this.hideBorders();

    super.disablePlugin();
  }

  /**
   * Updates the plugin state. This method is executed when {@link Core#updateSettings} is invoked.
   */
  updatePlugin(): void {
    this.disablePlugin();
    this.enablePlugin();

    this.changeBorderSettings();

    super.updatePlugin();
  }

  /**
   * Set custom borders.
   *
   * @example
   * ```js
   * const customBordersPlugin = hot.getPlugin('customBorders');
   *
   * // Using an array of arrays (produced by `.getSelected()` method).
   * customBordersPlugin.setBorders([[1, 1, 2, 2], [6, 2, 0, 2]], {left: {width: 2, color: 'blue'}});
   * // Using an array of CellRange objects (produced by `.getSelectedRange()` method).
   * customBordersPlugin.setBorders(hot.getSelectedRange(), {left: {hide: false, width: 2, color: 'blue'}});
   * ```
   *
   * @param selectionRanges Array of selection ranges.
   * @param [borderObject] Object with `top`, `right`, `bottom` and `left` properties (without it, the borders are
   * cleared).
   */
  setBorders(selectionRanges: SelectionInput[], borderObject?: Record<string, unknown>): void {
    const borderKeys = borderObject ? Object.keys(borderObject) : ['top', 'right', 'bottom', 'left'];
    const selectionSchemaNormalizer = normalizeSelectionFactory(detectSelectionType(selectionRanges));

    selectionRanges.forEach((selection) => {
      const [rowStart, columnStart, rowEnd, columnEnd] = selectionSchemaNormalizer(selection);

      for (let row = rowStart; row <= rowEnd; row += 1) {
        for (let col = columnStart; col <= columnEnd; col += 1) {
          borderKeys.forEach((borderKey) => {
            this.prepareBorderFromCustomAdded(row, col, borderObject, borderKey as Place);
          });
        }
      }
    });
  }

  /**
   * Get custom borders.
   *
   * @example
   * ```js
   * const customBordersPlugin = hot.getPlugin('customBorders');
   *
   * // Using an array of arrays (produced by `.getSelected()` method).
   * customBordersPlugin.getBorders([[1, 1, 2, 2], [6, 2, 0, 2]]);
   * // Using an array of CellRange objects (produced by `.getSelectedRange()` method).
   * customBordersPlugin.getBorders(hot.getSelectedRange());
   * // Using without param - return all customBorders.
   * customBordersPlugin.getBorders();
   * ```
   *
   * @param [selectionRanges] Array of selection ranges.
   * @returns Returns array of border objects.
   */
  getBorders(selectionRanges?: SelectionInput[]): CellBorders[] {
    if (!Array.isArray(selectionRanges)) {
      return this.savedBorders;
    }
    const selectionSchemaNormalizer = normalizeSelectionFactory(detectSelectionType(selectionRanges));
    const selectedBorders: CellBorders[] = [];

    selectionRanges.forEach((selection) => {
      const [rowStart, columnStart, rowEnd, columnEnd] = selectionSchemaNormalizer(selection);

      for (let row = rowStart; row <= rowEnd; row += 1) {
        for (let col = columnStart; col <= columnEnd; col += 1) {
          selectedBorders.push(...this.savedBorders.filter(border => border.row === row && border.col === col));
        }
      }
    });

    return selectedBorders;
  }

  /**
   * Clear custom borders.
   *
   * @example
   * ```js
   * const customBordersPlugin = hot.getPlugin('customBorders');
   *
   * // Using an array of arrays (produced by `.getSelected()` method).
   * customBordersPlugin.clearBorders([[1, 1, 2, 2], [6, 2, 0, 2]]);
   * // Using an array of CellRange objects (produced by `.getSelectedRange()` method).
   * customBordersPlugin.clearBorders(hot.getSelectedRange());
   * // Using without param - clear all customBorders.
   * customBordersPlugin.clearBorders();
   * ```
   *
   * @param [selectionRanges] Array of selection ranges.
   */
  clearBorders(selectionRanges?: SelectionInput[]): void {
    if (selectionRanges) {
      this.setBorders(selectionRanges);

    } else {
      this.savedBorders.forEach((border) => {
        this.clearBordersFromSelectionSettings(border.id);
        this.clearNullCellRange();
        this.hot.removeCellMeta(border.row, border.col, 'borders');
      });

      this.savedBorders.length = 0;
    }
  }

  /**
   * Insert WalkontableSelection instance into Walkontable settings.
   *
   * @private
   * @param border The cell's borders.
   * @param [place] Coordinate where add/remove border - `top`, `bottom`, `left`, `right`.
   */
  insertBorderIntoSettings(border: CellBorders, place?: Place): void {
    if (!this.checkSavedBorders(border)) {
      this.savedBorders.push(border);
    }
    const coordinates = { row: border.row, col: border.col };
    const cellRange = new CellRange(coordinates, coordinates, coordinates);

    if (!this.checkCustomSelections(border, cellRange, place)) {
      this.hot.selection.highlight.addCustomSelection({ border, cellRange });
      this.hot.view.wt.draw(true);
    }
  }

  /**
   * Prepare borders from setting (single cell).
   *
   * @private
   * @param row Visual row index.
   * @param column Visual column index.
   * @param [borderDescriptor] Object with `row` and `col`, `left`, `right`, `top` and `bottom` properties.
   * @param [place] Coordinate where add/remove border - `top`, `bottom`, `left`, `right`.
   */
  prepareBorderFromCustomAdded(row: number, column: number, borderDescriptor?: Record<string, unknown>,
    place?: Place): void {
    let border = createEmptyBorders(row, column);

    if (borderDescriptor) {
      border = extendDefaultBorder(border, borderDescriptor);

      // The cell has a border selection already: it gets the new sides.
      const customSelection = this.#customSelections().find(selection => selection.settings.id === border.id);

      if (customSelection) {
        Object.assign(customSelection.settings, borderDescriptor);
        border = customSelection.settings;
      }
    }

    this.hot.setCellMeta(row, column, 'borders', border);

    this.insertBorderIntoSettings(border, place);
  }

  /**
   * Prepare borders from setting (object): the range's outer sides.
   *
   * @private
   * @param rowDecriptor Object with `range`, `left`, `right`, `top` and `bottom` properties.
   */
  prepareBorderFromCustomAddedRange(rowDecriptor: CustomBorderSetting): void {
    const range = rowDecriptor.range!;
    const edges: [Side, (row: number, col: number) => boolean][] = [
      ['top', row => row === range.from.row],
      ['bottom', row => row === range.to.row],
      ['left', (row, col) => col === range.from.col],
      ['right', (row, col) => col === range.to.col],
    ];

    rangeEach(range.from.row, range.to.row, (rowIndex) => {
      rangeEach(range.from.col, range.to.col, (colIndex) => {
        const border = createEmptyBorders(rowIndex, colIndex);
        let onEdge = false;

        edges.forEach(([side, isOnEdge]) => {
          if (isOnEdge(rowIndex, colIndex)) {
            onEdge = true;

            if (hasOwnProperty(rowDecriptor, side)) {
              border[side] = rowDecriptor[side] as SideBorder;
            }
          }
        });

        if (onEdge) {
          this.hot.setCellMeta(rowIndex, colIndex, 'borders', border);
          this.insertBorderIntoSettings(border);
        }
      });
    });
  }

  /**
   * Remove border (triggered from context menu).
   *
   * @private
   * @param row Visual row index.
   * @param column Visual column index.
   */
  removeAllBorders(row: number, column: number): void {
    const borderId = createId(row, column);

    this.spliceBorder(borderId);

    this.clearBordersFromSelectionSettings(borderId);
    this.clearNullCellRange();

    this.hot.removeCellMeta(row, column, 'borders');
  }

  /**
   * Set borders for each cell re. to border position.
   *
   * @private
   * @param row Visual row index.
   * @param column Visual column index.
   * @param place Coordinate where add/remove border - `top`, `bottom`, `left`, `right`.
   * @param [remove] True when remove borders, and false when add borders.
   */
  setBorder(row: number, column: number, place: Side, remove?: boolean): void {
    let bordersMeta: CellBorders | undefined = this.hot.getCellMeta(row, column).borders;

    if (!bordersMeta || bordersMeta.border === undefined) {
      bordersMeta = createEmptyBorders(row, column);
    }

    if (remove) {
      bordersMeta[place] = createSingleEmptyBorder();

      if (this.countHide(bordersMeta) === 4) {
        this.removeAllBorders(row, column);

        return;
      }
    } else {
      bordersMeta[place] = createDefaultCustomBorder();
    }

    if (!this.checkCustomSelectionsFromContextMenu(bordersMeta, place, remove)) {
      this.insertBorderIntoSettings(bordersMeta);
    }

    this.hot.setCellMeta(row, column, 'borders', bordersMeta);
  }

  /**
   * Prepare borders based on cell and border position.
   *
   * @private
   * @param selected The selected ranges.
   * @param place Coordinate where add/remove border - `top`, `bottom`, `left`, `right` and `noBorders`.
   * @param [remove] True when remove borders, and false when add borders.
   */
  prepareBorder(selected: SelectedRange[], place: Place, remove?: boolean): void {
    selected.forEach(({ start, end }) => {
      if (start.row === end.row && start.col === end.col) {
        if (place === 'noBorders') {
          this.removeAllBorders(start.row, start.col);
        } else {
          this.setBorder(start.row, start.col, place, remove);
        }

        return;
      }

      switch (place) {
        case 'noBorders':
          rangeEach(start.col, end.col, (colIndex) => {
            rangeEach(start.row, end.row, (rowIndex) => {
              this.removeAllBorders(rowIndex, colIndex);
            });
          });
          break;

        case 'top':
          rangeEach(start.col, end.col, (topCol) => {
            this.setBorder(start.row, topCol, place, remove);
          });
          break;

        case 'right':
          rangeEach(start.row, end.row, (rowRight) => {
            this.setBorder(rowRight, end.col, place, remove);
          });
          break;

        case 'bottom':
          rangeEach(start.col, end.col, (bottomCol) => {
            this.setBorder(end.row, bottomCol, place, remove);
          });
          break;

        case 'left':
          rangeEach(start.row, end.row, (rowLeft) => {
            this.setBorder(rowLeft, start.col, place, remove);
          });
          break;

        default:
          break;
      }
    });
  }

  /**
   * Create borders from settings.
   *
   * @private
   * @param customBorders Object with `row` and `col`, `left`, `right`, `top` and `bottom` properties.
   */
  createCustomBorders(customBorders: CustomBorderSetting[]): void {
    customBorders.forEach((customBorder) => {
      if (customBorder.range) {
        this.prepareBorderFromCustomAddedRange(customBorder);
      } else {
        this.prepareBorderFromCustomAdded(customBorder.row!, customBorder.col!, customBorder);
      }
    });
  }

  /**
   * Count hide property in border object.
   *
   * @private
   * @param border The cell's borders.
   */
  countHide(border: CellBorders): number {
    return Object.values(border).filter(value => (value as SideBorder)?.hide).length;
  }

  /**
   * Clear borders settings from custom selections.
   *
   * @private
   * @param borderId Border id name as string.
   */
  clearBordersFromSelectionSettings(borderId: string): void {
    this.#customSelections().find(customSelection => customSelection.settings.id === borderId)?.clear();
    this.hot.view.wt.draw(true);
  }

  /**
   * Clear cellRange with null value.
   *
   * @private
   */
  clearNullCellRange(): void {
    const customSelections = this.#customSelections();
    const index = customSelections.findIndex(customSelection => customSelection.cellRange === null);

    if (index > -1) {
      customSelections.splice(index, 1);
    }
  }

  /**
   * Hide custom borders.
   *
   * @private
   */
  hideBorders(): void {
    this.savedBorders.forEach((border) => {
      this.clearBordersFromSelectionSettings(border.id);
    });
  }

  /**
   * Splice border from savedBorders.
   *
   * @private
   * @param borderId Border id name as string.
   */
  spliceBorder(borderId: string): void {
    const index = this.savedBorders.findIndex(border => border.id === borderId);

    if (index > -1) {
      this.savedBorders.splice(index, 1);
    }
  }

  /**
   * Check if an border already exists in the savedBorders array, and if true update border in savedBorders.
   *
   * @private
   * @param border The cell's borders.
   * @returns Whether the border was saved already (or all its sides are hidden: it was removed).
   */
  checkSavedBorders(border: CellBorders): boolean {
    if (this.countHide(border) === 4) {
      this.spliceBorder(border.id);

      return true;
    }
    const index = this.savedBorders.findIndex(savedBorder => savedBorder.id === border.id);

    if (index > -1) {
      this.savedBorders[index] = border;
    }

    return index > -1;
  }

  /**
   * Check if an border already exists in the customSelections, and if true call toggleHiddenClass method.
   *
   * @private
   * @param border The cell's borders.
   * @param place Coordinate where add/remove border - `top`, `bottom`, `left`, `right` and `noBorders`.
   * @param [remove] True when remove borders, and false when add borders.
   */
  checkCustomSelectionsFromContextMenu(border: CellBorders, place: Place, remove?: boolean): boolean {
    const customSelection = this.#customSelections().find(selection => selection.settings.id === border.id);

    if (customSelection) {
      Object.values(customSelection.instanceBorders).forEach(borderObject => borderObject.toggleHiddenClass(place, remove));
    }

    return !!customSelection;
  }

  /**
   * Check if an border already exists in the customSelections, and if true reset cellRange.
   *
   * @private
   * @param border The cell's borders.
   * @param cellRange The cell.
   * @param [place] Coordinate where add/remove border - `top`, `bottom`, `left`, `right`.
   */
  checkCustomSelections(border: CellBorders, cellRange: CellRange, place?: Place): boolean {
    if (this.countHide(border) === 4) {
      this.removeAllBorders(border.row, border.col);
      this.clearBordersFromSelectionSettings(border.id);
      this.clearNullCellRange();

      return true;
    }
    const customSelection = this.#customSelections().find(selection => selection.settings.id === border.id);

    if (customSelection) {
      customSelection.cellRange = cellRange;

      if (place) {
        Object.values(customSelection.instanceBorders).forEach(borderObject => borderObject.changeBorderStyle(place, border));
      }
    }

    return !!customSelection;
  }

  /**
   * Change borders from settings.
   *
   * @private
   */
  changeBorderSettings(): void {
    const { customBorders } = this.hot.getSettings();

    if (Array.isArray(customBorders)) {
      if (!customBorders.length) {
        this.savedBorders = customBorders;
      }

      this.createCustomBorders(customBorders);

    } else if (customBorders !== undefined) {
      this.createCustomBorders(this.savedBorders as unknown as CustomBorderSetting[]);
    }
  }

  /**
   * Add border options to context menu.
   *
   * @private
   * @param defaultOptions Context menu items.
   */
  onAfterContextMenuDefaultOptions(defaultOptions: { items: MenuItem[] }): void {
    if (!this.hot.getSettings().customBorders) {
      return;
    }

    defaultOptions.items.push({
      name: '---------',
    }, {
      key: 'borders',
      name(this: PluginHost) {
        return this.getTranslatedPhrase(C.CONTEXTMENU_ITEMS_BORDERS);
      },
      disabled(this: PluginHost) {
        return this.selection.isSelectedByCorner();
      },
      submenu: {
        items: [
          top(this),
          right(this),
          bottom(this),
          left(this),
          noBorders(this),
        ],
      },
    });
  }

  /**
   * `afterInit` hook callback.
   *
   * @private
   */
  onAfterInit(): void {
    this.changeBorderSettings();
  }

  /**
   * Destroys the plugin instance.
   */
  destroy(): void {
    super.destroy();
  }

  /** Walkontable's custom selections (the cells' borders). */
  #customSelections(): BorderSelection[] {
    return this.hot.selection.highlight.customSelections as unknown as BorderSelection[];
  }
}

registerPlugin('customBorders', CustomBorders);

export default CustomBorders;
