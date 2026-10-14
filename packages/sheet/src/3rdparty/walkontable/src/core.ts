import {
  addClass,
  fastInnerText,
  isVisible,
  removeClass,
} from './../../../helpers/dom/element';
import { objectEach } from './../../../helpers/object';
import { toUpperCaseFirst, randomString } from './../../../helpers/string';
import Event from './event';
import Overlays from './overlays';
import Scroll from './scroll';
import Settings from './settings';
import Table from './table';
import Viewport from './viewport';
import type { Coordinates, EngineSettings, OverlayManager, OverlaySurface, SelectionCollection, SettingResults, WalkontableOptions } from './types';

/**
 * @class Walkontable
 */
class Walkontable {
  declare guid: string;
  declare cloneSource?: Walkontable;
  declare cloneOverlay?: OverlaySurface;
  declare wtSettings: EngineSettings;
  declare wtTable: Table;
  declare wtScroll: Scroll;
  declare wtViewport: Viewport;
  declare wtEvent: Event;
  declare selections: SelectionCollection;
  declare wtOverlays: OverlayManager;
  declare drawn: boolean;
  declare drawInterrupted: boolean;
  declare lastMouseOver?: HTMLTableCellElement;
  declare touchApplied?: boolean;
  declare momentumScrolling?: { _timeout?: number; ongoing?: boolean };

  /**
   * @param {Object} settings
   */
  constructor(settings: WalkontableOptions) {
    const originalHeaders: string[] = [];

    // this is the namespace for global events
    this.guid = `wt_${randomString()}`;

    // bootstrap from settings
    if (settings.cloneSource) {
      this.cloneSource = settings.cloneSource;
      this.cloneOverlay = settings.cloneOverlay;
      this.wtSettings = settings.cloneSource.wtSettings;
      this.wtTable = new Table(this, settings.table, settings.wtRootElement);
      this.wtScroll = new Scroll(this);
      this.wtViewport = settings.cloneSource.wtViewport;
      this.wtEvent = new Event(this as unknown as ConstructorParameters<typeof Event>[0]);
      this.selections = this.cloneSource.selections;
    } else {
      this.wtSettings = new Settings(this, settings) as unknown as EngineSettings;
      this.wtTable = new Table(this, settings.table);
      this.wtScroll = new Scroll(this);
      this.wtViewport = new Viewport(this);
      this.wtEvent = new Event(this as unknown as ConstructorParameters<typeof Event>[0]);
      this.selections = this.getSetting('selections');
      this.wtOverlays = new Overlays(this) as unknown as OverlayManager;
      this.exportSettingsAsClassNames();
    }

    // find original headers
    if (this.wtTable.THEAD.childNodes.length && this.wtTable.THEAD.childNodes[0].childNodes.length) {
      for (let c = 0, clen = this.wtTable.THEAD.childNodes[0].childNodes.length; c < clen; c++) {
        originalHeaders.push((this.wtTable.THEAD.childNodes[0].childNodes[c] as HTMLElement).innerHTML);
      }
      if (!this.getSetting('columnHeaders').length) {
        this.update('columnHeaders', [
          function(column: number, TH: HTMLTableCellElement) {
            fastInnerText(TH, originalHeaders[column]);
          }
        ]);
      }
    }
    this.drawn = false;
    this.drawInterrupted = false;
  }

  /**
   * Force rerender of Walkontable
   *
   * @param {Boolean} [fastDraw=false] When `true`, try to refresh only the positions of borders without rerendering
   *                                   the data. It will only work if Table.draw() does not force
   *                                   rendering anyway
   * @returns {Walkontable}
   */
  draw(fastDraw = false) {
    this.drawInterrupted = false;

    if (!fastDraw && !isVisible(this.wtTable.TABLE)) {
      // draw interrupted because TABLE is not visible
      this.drawInterrupted = true;
    } else {
      this.wtTable.draw(fastDraw);
    }

    return this;
  }

  /**
   * Returns the TD at coords. If topmost is set to true, returns TD from the topmost overlay layer,
   * if not set or set to false, returns TD from the master table.
   *
   * @param {CellCoords} coords
   * @param {Boolean} [topmost=false]
   * @returns {Object}
   */
  getCell(coords: Coordinates, topmost = false): HTMLTableCellElement | -1 | -2 | undefined {
    if (!topmost) {
      return this.wtTable.getCell(coords);
    }

    const totalRows = this.wtSettings.getSetting('totalRows') as number;
    const fixedRowsTop = this.wtSettings.getSetting('fixedRowsTop') as number;
    const fixedRowsBottom = this.wtSettings.getSetting('fixedRowsBottom') as number;
    const fixedColumns = this.wtSettings.getSetting('fixedColumnsLeft') as number;

    if (coords.row < fixedRowsTop && coords.col < fixedColumns) {
      return this.wtOverlays.topLeftCornerOverlay.clone.wtTable.getCell(coords);

    } else if (coords.row < fixedRowsTop) {
      return this.wtOverlays.topOverlay.clone.wtTable.getCell(coords);

    } else if (coords.col < fixedColumns && coords.row >= totalRows - fixedRowsBottom) {
      if (this.wtOverlays.bottomLeftCornerOverlay && this.wtOverlays.bottomLeftCornerOverlay.clone) {
        return this.wtOverlays.bottomLeftCornerOverlay.clone.wtTable.getCell(coords);
      }

    } else if (coords.col < fixedColumns) {
      return this.wtOverlays.leftOverlay.clone.wtTable.getCell(coords);

    } else if (coords.row < totalRows && coords.row > totalRows - fixedRowsBottom) {
      if (this.wtOverlays.bottomOverlay && this.wtOverlays.bottomOverlay.clone) {
        return this.wtOverlays.bottomOverlay.clone.wtTable.getCell(coords);
      }

    }

    return this.wtTable.getCell(coords);
  }

  /**
   * @param {Object} settings
   * @param {*} value
   * @returns {Walkontable}
   */
  update(settings: Record<string, unknown> | string, value?: unknown) {
    return this.wtSettings.update(settings, value);
  }

  /**
   * Scrolls the viewport to a cell (rerenders if needed).
   *
   * @param {CellCoords} coords
   * @param {Boolean} [snapToTop]
   * @param {Boolean} [snapToRight]
   * @param {Boolean} [snapToBottom]
   * @param {Boolean} [snapToLeft]
   * @returns {Boolean}
   */
  scrollViewport(coords: Coordinates, snapToTop?: boolean, snapToRight?: boolean, snapToBottom?: boolean, snapToLeft?: boolean) {
    return this.wtScroll.scrollViewport(coords, snapToTop, snapToRight, snapToBottom, snapToLeft);
  }

  /**
   * Scrolls the viewport to a column (rerenders if needed).
   *
   * @param {Number} column Visual column index.
   * @param {Boolean} [snapToRight]
   * @param {Boolean} [snapToLeft]
   * @returns {Boolean}
   */
  scrollViewportHorizontally(column: number, snapToRight?: boolean, snapToLeft?: boolean) {
    return this.wtScroll.scrollViewportHorizontally(column, snapToRight, snapToLeft);
  }

  /**
   * Scrolls the viewport to a row (rerenders if needed).
   *
   * @param {Number} row Visual row index.
   * @param {Boolean} [snapToTop]
   * @param {Boolean} [snapToBottom]
   * @returns {Boolean}
   */
  scrollViewportVertically(row: number, snapToTop?: boolean, snapToBottom?: boolean) {
    return this.wtScroll.scrollViewportVertically(row, snapToTop, snapToBottom);
  }

  /**
   * @returns {Array}
   */
  getViewport() {
    return [
      this.wtTable.getFirstVisibleRow(),
      this.wtTable.getFirstVisibleColumn(),
      this.wtTable.getLastVisibleRow(),
      this.wtTable.getLastVisibleColumn()
    ];
  }

  /**
   * Get overlay name
   *
   * @returns {String}
   */
  getOverlayName() {
    return this.cloneOverlay ? this.cloneOverlay.type : 'master';
  }

  /**
   * Check overlay type of this Walkontable instance.
   *
   * @param {String} name Clone type @see {Overlay.CLONE_TYPES}.
   * @returns {Boolean}
   */
  isOverlayName(name: string) {
    if (this.cloneOverlay) {
      return this.cloneOverlay.type === name;
    }

    return false;
  }

  /**
   * Export settings as class names added to the parent element of the table.
   */
  exportSettingsAsClassNames() {
    const toExport = {
      rowHeaders: ['array'],
      columnHeaders: ['array']
    };
    const allClassNames: string[] = [];
    const newClassNames: string[] = [];

    objectEach(toExport, (optionType, key) => {
      if (optionType.indexOf('array') > -1 && (this.getSetting(key) as unknown[]).length) {
        newClassNames.push(`ht${toUpperCaseFirst(key)}`);
      }
      allClassNames.push(`ht${toUpperCaseFirst(key)}`);
    });
    removeClass(this.wtTable.wtRootElement.parentNode as HTMLElement, allClassNames);
    addClass(this.wtTable.wtRootElement.parentNode as HTMLElement, newClassNames);
  }

  /**
   * Get/Set Walkontable instance setting
   *
   * @param {String} key
   * @param {*} [param1]
   * @param {*} [param2]
   * @param {*} [param3]
   * @param {*} [param4]
   * @returns {*}
   */
  getSetting<Key extends keyof SettingResults>(key: Key, param1?: unknown, param2?: unknown, param3?: unknown, param4?: unknown): SettingResults[Key];
  getSetting(key: string, param1?: unknown, param2?: unknown, param3?: unknown, param4?: unknown): unknown;
  getSetting(key: string, param1?: unknown, param2?: unknown, param3?: unknown, param4?: unknown): unknown {
    // this is faster than .apply - https://github.com/handsontable/handsontable/wiki/JavaScript-&-DOM-performance-tips
    return this.wtSettings.getSetting(key, param1, param2, param3, param4);
  }

  /**
   * Checks if setting exists
   *
   * @param {String} key
   * @returns {Boolean}
   */
  hasSetting(key: string) {
    return this.wtSettings.has(key);
  }

  /**
   * Destroy instance
   */
  destroy() {
    this.wtOverlays.destroy();
    this.wtEvent.destroy();
  }
}

export default Walkontable;
