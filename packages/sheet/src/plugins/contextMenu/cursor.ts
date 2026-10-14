import { getWindowScrollLeft, getWindowScrollTop } from './../../helpers/dom/element';
import { pageX, pageY } from './../../helpers/dom/event';

/** Where to open a menu: a mouse event, or coordinates (relative to the viewport) with the cell's size. */
export type CursorSource = MouseEvent | { top: number | string; left: number | string; width?: number; height?: number };

/**
 * Helper class for checking if element will fit at the desired side of cursor.
 *
 * @class Cursor
 * @plugin ContextMenu
 */
class Cursor {
  type: 'literal' | 'event';

  /** The position in the page. */
  top: number;

  left: number;

  /** The position in the viewport. */
  topRelative: number;

  leftRelative: number;

  scrollTop: number;

  scrollLeft: number;

  /** The size of the cell the menu opens at. */
  cellHeight: number;

  cellWidth: number;

  constructor(object: CursorSource) {
    const windowScrollTop = getWindowScrollTop();
    const windowScrollLeft = getWindowScrollLeft();

    this.type = this.getSourceType(object);
    this.scrollTop = windowScrollTop;
    this.scrollLeft = windowScrollLeft;

    if (this.type === 'event') {
      const event = object as MouseEvent;
      const target = event.target as HTMLElement;

      this.top = parseInt(String(pageY(event)), 10);
      this.left = parseInt(String(pageX(event)), 10);
      this.cellHeight = target.clientHeight;
      this.cellWidth = target.clientWidth;
      this.topRelative = this.top - windowScrollTop;
      this.leftRelative = this.left - windowScrollLeft;
    } else {
      const literal = object as Exclude<CursorSource, MouseEvent>;

      this.topRelative = parseInt(String(literal.top), 10);
      this.leftRelative = parseInt(String(literal.left), 10);
      this.cellHeight = literal.height || 0;
      this.cellWidth = literal.width || 0;
      this.top = this.topRelative + windowScrollTop;
      this.left = this.leftRelative + windowScrollLeft;
    }
  }

  /**
   * Get source type name.
   *
   * @param object Event or Object with coordinates.
   * @returns Returns one of this values: `'literal'`, `'event'`.
   */
  getSourceType(object: unknown): 'literal' | 'event' {
    return object instanceof Event ? 'event' : 'literal';
  }

  /**
   * Checks if element can be placed above the cursor.
   *
   * @param element Element to check if it's size will fit above the cursor.
   */
  fitsAbove(element: HTMLElement): boolean {
    return this.topRelative >= element.offsetHeight;
  }

  /**
   * Checks if element can be placed below the cursor.
   *
   * @param element Element to check if it's size will fit below the cursor.
   * @param [viewportHeight] The viewport height.
   */
  fitsBelow(element: HTMLElement, viewportHeight = window.innerHeight): boolean {
    return this.topRelative + element.offsetHeight <= viewportHeight;
  }

  /**
   * Checks if element can be placed on the right of the cursor.
   *
   * @param element Element to check if it's size will fit on the right of the cursor.
   * @param [viewportWidth] The viewport width.
   */
  fitsOnRight(element: HTMLElement, viewportWidth = window.innerWidth): boolean {
    return this.leftRelative + this.cellWidth + element.offsetWidth <= viewportWidth;
  }

  /**
   * Checks if element can be placed on the left on the cursor.
   *
   * @param element Element to check if it's size will fit on the left of the cursor.
   */
  fitsOnLeft(element: HTMLElement): boolean {
    return this.leftRelative >= element.offsetWidth;
  }
}

export default Cursor;
