import { getWindowScrollTop, hasClass, getWindowScrollLeft } from './../../helpers/dom/element';
import { isMobileBrowser } from './../../helpers/browser';
import BasePlugin from './../_base';
import EventManager from './../../eventManager';
import { registerPlugin } from './../../plugins';
import { CellCoords } from './../../3rdparty/walkontable/src';
import type { CellRange } from './../../3rdparty/walkontable/src';

/** A selection handle on touch screens. */
type Handle = 'topLeft' | 'bottomRight';

/** The new start (`null`: unchanged) and end of the selection. */
type RangeCoords = { start: CellCoords | null; end: CellCoords | null };

const HANDLES: [string, Handle][] = [
  ['topLeftSelectionHandle-HitArea', 'topLeft'],
  ['bottomRightSelectionHandle-HitArea', 'bottomRight'],
];

/** The handle whose hit area `target` is. */
const handleOf = (target: EventTarget | null): Handle | undefined => HANDLES
  .find(([className]) => hasClass(target as HTMLElement, className))?.[1];

/**
 * @private
 * @plugin MultipleSelectionHandles
 *
 * On mobile browsers: the selection's corners have handles that change the selection when dragged.
 */
class MultipleSelectionHandles extends BasePlugin {
  /** The handles being dragged. */
  dragged: Handle[] = [];

  /**
   * Instance of EventManager.
   */
  eventManager: EventManager | undefined = undefined;

  /** The cell the selection was last extended to. */
  lastSetCell: Element | null = null;

  /** The selection's size and direction when a handle was touched. */
  touchStartRange: { width: number; height: number; direction: string } | undefined = undefined;

  /**
   * Check if the plugin is enabled in the FreeGrid settings.
   */
  isEnabled(): boolean {
    return isMobileBrowser();
  }

  /**
   * Enable plugin for this FreeGrid instance.
   */
  enablePlugin(): void {
    if (this.enabled) {
      return;
    }
    if (!this.eventManager) {
      this.eventManager = new EventManager(this);
    }
    this.registerListeners();
    super.enablePlugin();
  }

  /**
   * A handle is not dragged any longer.
   *
   * @private
   * @param handle The released handle.
   */
  removeFromDragged(handle: Handle): void {
    // With one handle dragged, releasing ends the drag.
    this.dragged = this.dragged.length === 1 ? [] : this.dragged.filter(dragged => dragged !== handle);
  }

  /**
   * Bind the touch events
   * @private
   */
  registerListeners(): void {
    const eventManager = this.eventManager!;

    eventManager.addEventListener(this.hot.rootElement, 'touchstart', (event: TouchEvent) => {
      const handle = handleOf(event.target);

      if (!handle) {
        return;
      }
      const selectedRange = this.hot.getSelectedRangeLast()!;

      this.dragged.push(handle);
      this.touchStartRange = {
        width: selectedRange.getWidth(),
        height: selectedRange.getHeight(),
        direction: selectedRange.getDirection(),
      };
      event.preventDefault();

      return false;
    });

    eventManager.addEventListener(this.hot.rootElement, 'touchend', (event: TouchEvent) => {
      const handle = handleOf(event.target);

      if (!handle) {
        return;
      }
      this.removeFromDragged(handle);
      this.touchStartRange = undefined;
      event.preventDefault();

      return false;
    });

    eventManager.addEventListener(this.hot.rootElement, 'touchmove', (event: TouchEvent) => {
      if (this.dragged.length === 0) {
        return;
      }
      const endTarget = document.elementFromPoint(
        event.touches[0].screenX - getWindowScrollLeft(),
        event.touches[0].screenY - getWindowScrollTop());

      if (!endTarget || endTarget === this.lastSetCell) {
        return;
      }

      if (endTarget.nodeName === 'TD' || endTarget.nodeName === 'TH') {
        const targetCoords: CellCoords = this.hot.getCoords(endTarget)!;

        if (targetCoords.col === -1) {
          targetCoords.col = 0;
        }
        const selectedRange: CellRange = this.hot.getSelectedRangeLast()!;

        if (selectedRange.getWidth() === 1 && selectedRange.getHeight() === 1) {
          this.hot.selection.setRangeEnd(targetCoords);
        }
        const newRangeCoords = this.getCurrentRangeCoords(selectedRange, targetCoords,
          this.touchStartRange!.direction, selectedRange.getDirection(), this.dragged[0]);

        if (newRangeCoords.start !== null) {
          this.hot.selection.setRangeStart(newRangeCoords.start);
        }
        this.hot.selection.setRangeEnd(newRangeCoords.end!);
        this.lastSetCell = endTarget;
      }

      event.preventDefault();
    });
  }

  /**
   * The selection after dragging a handle to `currentTouch`, from the direction the selection had when the handle was
   * touched and the direction it has now.
   *
   * @private
   */
  getCurrentRangeCoords(selectedRange: CellRange, currentTouch: CellCoords, touchStartDirection: string,
    currentDirection: string, draggedHandle: Handle): RangeCoords {
    const topLeftCorner = selectedRange.getTopLeftCorner();
    const bottomRightCorner = selectedRange.getBottomRightCorner();
    const bottomLeftCorner = selectedRange.getBottomLeftCorner();
    const topRightCorner = selectedRange.getTopRightCorner();
    let newCoords: RangeCoords = { start: null, end: null };

    switch (touchStartDirection) {
      case 'NE-SW':
        switch (currentDirection) {
          case 'NE-SW':
          case 'NW-SE':
            if (draggedHandle === 'topLeft') {
              newCoords = {
                start: new CellCoords(currentTouch.row, selectedRange.highlight.col),
                end: new CellCoords(bottomLeftCorner.row, currentTouch.col),
              };
            } else {
              newCoords = {
                start: new CellCoords(selectedRange.highlight.row, currentTouch.col),
                end: new CellCoords(currentTouch.row, topLeftCorner.col),
              };
            }
            break;
          case 'SE-NW':
            if (draggedHandle === 'bottomRight') {
              newCoords = {
                start: new CellCoords(bottomRightCorner.row, currentTouch.col),
                end: new CellCoords(currentTouch.row, topLeftCorner.col),
              };
            }
            break;
          default:
            break;
        }
        break;
      case 'NW-SE': {
        const ends: Record<string, CellCoords> = {
          'NE-SW': bottomLeftCorner,
          'NW-SE': bottomRightCorner,
          'SE-NW': topLeftCorner,
          'SW-NE': topRightCorner,
        };

        if (ends[currentDirection]) {
          newCoords = draggedHandle === 'topLeft' ?
            { start: currentTouch, end: ends[currentDirection] } : { start: null, end: currentTouch };
        }
        break;
      }
      case 'SW-NE':
        switch (currentDirection) {
          case 'NW-SE':
            if (draggedHandle === 'bottomRight') {
              newCoords = {
                start: new CellCoords(currentTouch.row, topLeftCorner.col),
                end: new CellCoords(bottomLeftCorner.row, currentTouch.col),
              };
            } else {
              newCoords = {
                start: new CellCoords(topLeftCorner.row, currentTouch.col),
                end: new CellCoords(currentTouch.row, bottomRightCorner.col),
              };
            }
            break;
          case 'SW-NE':
            if (draggedHandle === 'topLeft') {
              newCoords = {
                start: new CellCoords(selectedRange.highlight.row, currentTouch.col),
                end: new CellCoords(currentTouch.row, bottomRightCorner.col),
              };
            } else {
              newCoords = {
                start: new CellCoords(currentTouch.row, topLeftCorner.col),
                end: new CellCoords(topLeftCorner.row, currentTouch.col),
              };
            }
            break;
          case 'SE-NW':
            if (draggedHandle === 'bottomRight') {
              newCoords = {
                start: new CellCoords(currentTouch.row, topRightCorner.col),
                end: new CellCoords(topLeftCorner.row, currentTouch.col),
              };
            } else {
              newCoords = { start: bottomLeftCorner, end: currentTouch };
            }
            break;
          default:
            break;
        }
        break;
      case 'SE-NW':
        if (['NW-SE', 'NE-SW', 'SW-NE', 'SE-NW'].includes(currentDirection)) {
          if (draggedHandle === 'topLeft') {
            newCoords.end = currentTouch;
          } else if (currentDirection === 'SE-NW') {
            newCoords = { start: currentTouch, end: topLeftCorner };
          }
        }
        break;
      default:
        break;
    }

    return newCoords;
  }

  /**
   * Check if user is currently dragging the handle.
   *
   * @returns Dragging state
   */
  isDragged(): boolean {
    return this.dragged.length > 0;
  }
}

registerPlugin('multipleSelectionHandles', MultipleSelectionHandles);

export default MultipleSelectionHandles;
