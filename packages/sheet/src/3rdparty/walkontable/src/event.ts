import {
  closestDown,
  hasClass,
  isChildOf,
  getParent,
} from './../../../helpers/dom/element';
import { partial } from './../../../helpers/function';
import { isTouchSupported } from './../../../helpers/feature';
import { isMobileBrowser } from './../../../helpers/browser';
import EventManager from './../../../eventManager';
import type CellCoords from './cell/coords';
import type CellRange from './cell/range';

/** The engine surface used by pointer handling, shared by the master and its clones. */
export interface EventInstance {
  wtTable: {
    holder: HTMLElement;
    TABLE: HTMLTableElement;
    getCoords(cell: HTMLTableCellElement): CellCoords;
    getCell(coords: CellCoords): HTMLTableCellElement | number | null;
  };
  selections: {
    getCell(): { cellRange: CellRange };
    createOrGetArea(): { cellRange: CellRange | null };
  };
  momentumScrolling?: { _timeout?: number; ongoing?: boolean };
  touchApplied?: boolean;
  lastMouseOver?: HTMLTableCellElement;
  cloneSource?: EventInstance;
  getSetting(key: string, ...params: unknown[]): unknown;
  hasSetting(key: string): boolean;
  draw(): unknown;
}

/** Touch handlers reuse the mouse handlers; touch events have no button or related target. */
type PointerEvent = (MouseEvent | TouchEvent) & {
  realTarget: Element;
  button?: number;
  relatedTarget?: Node | null;
  target: Element;
};
type ParentCell = { coords?: CellCoords; TD?: HTMLTableCellElement | number | null };


/**
 * @class Event
 */
class Event {
  #instance: EventInstance;
  #eventManager: EventManager;
  #state: {
    selectedCellBeforeTouchEnd?: CellRange;
    dblClickTimeout: [number | null, number | null];
    dblClickOrigin: [ParentCell['TD'], ParentCell['TD']];
  };
  /**
   * @param {*} instance Walkontable instance.
   */
  constructor(instance: EventInstance) {
    /**
     * Instance of {@link Walkontable}.
     *
     * @private
     * @type {Walkontable}
     */
    this.#instance = instance;
    /**
     * Instance of {@link EventManager}.
     *
     * @private
     * @type {EventManager}
     */
    this.#eventManager = new EventManager(instance);

    this.#state = {
      selectedCellBeforeTouchEnd: void 0,
      dblClickTimeout: [null, null],
      dblClickOrigin: [null, null],
    };

    this.registerEvents();
  }

  /**
   * Adds listeners for mouse and touch events.
   *
   * @private
   */
  registerEvents() {
    this.#eventManager.addEventListener(this.#instance.wtTable.holder, 'contextmenu', event => this.onContextMenu(event));
    this.#eventManager.addEventListener(this.#instance.wtTable.TABLE, 'mouseover', event => this.onMouseOver(event));
    this.#eventManager.addEventListener(this.#instance.wtTable.TABLE, 'mouseout', event => this.onMouseOut(event));

    const initTouchEvents = () => {
      this.#eventManager.addEventListener(this.#instance.wtTable.holder, 'touchstart', event => this.onTouchStart(event));
      this.#eventManager.addEventListener(this.#instance.wtTable.holder, 'touchend', event => this.onTouchEnd(event));

      if (!this.#instance.momentumScrolling) {
        this.#instance.momentumScrolling = {};
      }
      this.#eventManager.addEventListener(this.#instance.wtTable.holder, 'scroll', () => {
        clearTimeout(this.#instance.momentumScrolling!._timeout);

        if (!this.#instance.momentumScrolling!.ongoing) {
          this.#instance.getSetting('onBeforeTouchScroll');
        }
        this.#instance.momentumScrolling!.ongoing = true;

        this.#instance.momentumScrolling!._timeout = setTimeout(() => {
          if (!this.#instance.touchApplied) {
            this.#instance.momentumScrolling!.ongoing = false;

            this.#instance.getSetting('onAfterMomentumScroll');
          }
        }, 200);
      });
    };

    const initMouseEvents = () => {
      this.#eventManager.addEventListener(this.#instance.wtTable.holder, 'mouseup', event => this.onMouseUp(event));
      this.#eventManager.addEventListener(this.#instance.wtTable.holder, 'mousedown', event => this.onMouseDown(event));
    };

    if (isMobileBrowser()) {
      initTouchEvents();
    } else {
      // PC like devices which support both methods (touchscreen and ability to plug-in mouse).
      if (isTouchSupported()) {
        initTouchEvents();
      }

      initMouseEvents();
    }

    this.#eventManager.addEventListener(window, 'resize', () => {
      if (this.#instance.getSetting('stretchH') !== 'none') {
        this.#instance.draw();
      }
    });
  }

  /**
   * Checks if an element is already selected.
   *
   * @private
   * @param {Element} touchTarget
   * @returns {Boolean}
   */
  selectedCellWasTouched(touchTarget: Element) {
    const state = this.#state;
    const cellUnderFinger = this.parentCell(touchTarget);
    const coordsOfCellUnderFinger = cellUnderFinger.coords;

    if (state.selectedCellBeforeTouchEnd && coordsOfCellUnderFinger) {
      const [rowTouched, rowSelected] = [coordsOfCellUnderFinger.row, state.selectedCellBeforeTouchEnd.from.row];
      const [colTouched, colSelected] = [coordsOfCellUnderFinger.col, state.selectedCellBeforeTouchEnd.from.col];

      return rowTouched === rowSelected && colTouched === colSelected;
    }

    return false;
  }

  /**
   * Gets closest TD or TH element.
   *
   * @private
   * @param {Element} elem
   * @returns {Object} Contains coordinates and reference to TD or TH if it exists. Otherwise it's empty object.
   */
  parentCell(elem: Element) {
    const cell: ParentCell = {};
    const TABLE = this.#instance.wtTable.TABLE;
    const TD = closestDown(elem, ['TD', 'TH'], TABLE);

    if (TD) {
      cell.coords = this.#instance.wtTable.getCoords(TD as HTMLTableCellElement);
      cell.TD = TD as HTMLTableCellElement;

    } else if (hasClass(elem, 'fs-selection-border') && hasClass(elem, 'current')) {
      cell.coords = this.#instance.selections.getCell().cellRange.highlight;
      cell.TD = this.#instance.wtTable.getCell(cell.coords);

    } else if (hasClass(elem, 'fs-selection-border') && hasClass(elem, 'area')) {
      if (this.#instance.selections.createOrGetArea().cellRange) {
        cell.coords = this.#instance.selections.createOrGetArea().cellRange!.to;
        cell.TD = this.#instance.wtTable.getCell(cell.coords);
      }
    }

    return cell;
  }

  /**
   * onMouseDown callback.
   *
   * @private
   * @param {MouseEvent} event
   */
  onMouseDown(event: PointerEvent) {
    const state = this.#state;
    const activeElement = document.activeElement;
    const getParentNode = partial(getParent, event.realTarget);
    const realTarget = event.realTarget;

    // ignore focusable element from mouse down processing (https://github.com/handsontable/handsontable/issues/3555)
    if (realTarget === activeElement ||
        getParentNode(0) === activeElement ||
        getParentNode(1) === activeElement) {
      return;
    }

    const cell = this.parentCell(realTarget);

    if (hasClass(realTarget, 'corner')) {
      this.#instance.getSetting('onCellCornerMouseDown', event, realTarget);
    } else if (cell.TD && this.#instance.hasSetting('onCellMouseDown')) {
      this.#instance.getSetting('onCellMouseDown', event, cell.coords, cell.TD, this.#instance);
    }

    if (event.button !== 2 && cell.TD) { // if not right mouse button
      state.dblClickOrigin[0] = cell.TD;

      clearTimeout(state.dblClickTimeout[0]!);

      state.dblClickTimeout[0] = setTimeout(() => {
        state.dblClickOrigin[0] = null;
      }, 1000);
    }
  }

  /**
   * onContextMenu callback.
   *
   * @private
   * @param {MouseEvent} event
   */
  onContextMenu(event: PointerEvent) {
    if (this.#instance.hasSetting('onCellContextMenu')) {
      const cell = this.parentCell(event.realTarget);

      if (cell.TD) {
        this.#instance.getSetting('onCellContextMenu', event, cell.coords, cell.TD, this.#instance);
      }
    }
  }

  /**
   * onMouseOver callback.
   *
   * @private
   * @param {MouseEvent} event
   */
  onMouseOver(event: PointerEvent) {
    if (!this.#instance.hasSetting('onCellMouseOver')) {
      return;
    }

    const table = this.#instance.wtTable.TABLE;
    const td = closestDown(event.realTarget, ['TD', 'TH'], table);
    const mainWOT = this.#instance.cloneSource || this.#instance;

    if (td && td !== mainWOT.lastMouseOver && isChildOf(td, table)) {
      mainWOT.lastMouseOver = td as HTMLTableCellElement;

      this.#instance.getSetting('onCellMouseOver', event, this.#instance.wtTable.getCoords(td as HTMLTableCellElement), td, this.#instance);
    }
  }

  /**
   * onMouseOut callback.
   *
   * @private
   * @param {MouseEvent} event
   */
  onMouseOut(event: PointerEvent) {
    if (!this.#instance.hasSetting('onCellMouseOut')) {
      return;
    }

    const table = this.#instance.wtTable.TABLE;
    const lastTD = closestDown(event.realTarget, ['TD', 'TH'], table);
    const nextTD = closestDown(event.relatedTarget as Node | null, ['TD', 'TH'], table);

    if (lastTD && lastTD !== nextTD && isChildOf(lastTD, table)) {
      this.#instance.getSetting('onCellMouseOut', event, this.#instance.wtTable.getCoords(lastTD as HTMLTableCellElement), lastTD, this.#instance);
    }
  }

  /**
   * onMouseUp callback.
   *
   * @private
   * @param {MouseEvent} event
   */
  onMouseUp(event: PointerEvent) {
    if (event.button === 2) {
      return;
    }

    // if not right mouse button
    const state = this.#state;
    const cell = this.parentCell(event.realTarget);

    if (cell.TD && this.#instance.hasSetting('onCellMouseUp')) {
      this.#instance.getSetting('onCellMouseUp', event, cell.coords, cell.TD, this.#instance);
    }

    if (cell.TD === state.dblClickOrigin[0] && cell.TD === state.dblClickOrigin[1]) {
      if (hasClass(event.realTarget, 'corner')) {
        this.#instance.getSetting('onCellCornerDblClick', event, cell.coords, cell.TD, this.#instance);
      } else {
        this.#instance.getSetting('onCellDblClick', event, cell.coords, cell.TD, this.#instance);
      }

      state.dblClickOrigin[0] = null;
      state.dblClickOrigin[1] = null;

    } else if (cell.TD === state.dblClickOrigin[0]) {
      state.dblClickOrigin[1] = cell.TD;

      clearTimeout(state.dblClickTimeout[1]!);

      state.dblClickTimeout[1] = setTimeout(() => {
        state.dblClickOrigin[1] = null;
      }, 500);
    }
  }

  /**
   * onTouchStart callback. Simulates mousedown event.
   *
   * @private
   * @param {MouseEvent} event
   */
  onTouchStart(event: PointerEvent) {
    const state = this.#state;

    state.selectedCellBeforeTouchEnd = this.#instance.selections.getCell().cellRange;
    this.#instance.touchApplied = true;

    this.onMouseDown(event);
  }

  /**
   * onTouchEnd callback. Simulates mouseup event.
   *
   * @private
   * @param {MouseEvent} event
   */
  onTouchEnd(event: PointerEvent) {
    const excludeTags = ['A', 'BUTTON', 'INPUT'];
    const target = event.target;

    this.#instance.touchApplied = false;

    // When the standard event was performed on the link element (a cell which contains HTML `a` element) then here
    // we check if it should be canceled. Click is blocked in a situation when the element is rendered outside
    // selected cells. This prevents accidentally page reloads while selecting adjacent cells.
    if (this.selectedCellWasTouched(target) === false && excludeTags.includes(target.tagName)) {
      event.preventDefault();
    }

    this.onMouseUp(event);
  }

  /**
   * Clears double-click timeouts and destroys the internal eventManager instance.
   */
  destroy() {
    const state = this.#state;

    clearTimeout(state.dblClickTimeout[0]!);
    clearTimeout(state.dblClickTimeout[1]!);

    this.#eventManager.destroy();
  }
}

export default Event;
