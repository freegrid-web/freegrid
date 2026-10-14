/**
 * Event helpers.
 */
import { getWindowScrollTop, getWindowScrollLeft } from './layout';

type FreeSheetEvent = {
  isImmediatePropagationEnabled?: boolean;
  cancelBubble?: boolean;
  stopPropagation?: () => void;
};

type PointerLikeEvent = { pageX?: number; pageY?: number; clientX: number; clientY: number };

/**
 * Stops other FreeSheet listeners of the same event (see `isImmediatePropagationStopped`) and the event's bubbling.
 */
export const stopImmediatePropagation = (event: FreeSheetEvent): void => {
  event.isImmediatePropagationEnabled = false;
  event.cancelBubble = true;
};

/**
 * Checks if `stopImmediatePropagation` was called for the event.
 */
export const isImmediatePropagationStopped = (event: FreeSheetEvent): boolean => event.isImmediatePropagationEnabled === false;

/**
 * Stops the event's bubbling. Also accepts plain event-like objects without `stopPropagation()`.
 */
export const stopPropagation = (event: FreeSheetEvent): void => {
  if (typeof event.stopPropagation === 'function') {
    event.stopPropagation();
  } else {
    event.cancelBubble = true;
  }
};

/**
 * Returns the event's horizontal position relative to the whole document.
 */
export const pageX = (event: PointerLikeEvent): number => {
  if (event.pageX) {
    return event.pageX;
  }

  return event.clientX + getWindowScrollLeft();
};

/**
 * Returns the event's vertical position relative to the whole document.
 */
export const pageY = (event: PointerLikeEvent): number => {
  if (event.pageY) {
    return event.pageY;
  }

  return event.clientY + getWindowScrollTop();
};

/**
 * Checks if the right mouse button was pressed.
 */
export const isRightClick = (event: { button: number }): boolean => event.button === 2;

/**
 * Checks if the left mouse button was pressed.
 */
export const isLeftClick = (event: { button: number }): boolean => event.button === 0;
