import { isCtrlMetaKey, isKey } from '../helpers/unicode';

/**
 * Which keyboard keys are held down, for all grids on the page. Grids call `startObserving()` when they are created
 * and `stopObserving()` when they are destroyed; the document listeners exist while at least one grid observes.
 */

// Aborting it removes all the document listeners at once.
let listeners: AbortController | null = null;
const pressedKeys = new Set<number>();
let refCount = 0;

/** Begins observing (or adds an observer). */
export const startObserving = (): void => {
  if (refCount === 0) {
    listeners = new AbortController();
    const { signal } = listeners;

    document.addEventListener('keydown', (event) => {
      pressedKeys.add(event.keyCode);
    }, { signal });
    document.addEventListener('keyup', (event) => {
      pressedKeys.delete(event.keyCode);
    }, { signal });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        pressedKeys.clear();
      }
    }, { signal });
    window.addEventListener('blur', () => {
      pressedKeys.clear();
    }, { signal });
  }

  refCount += 1;
};

/** Removes the listeners and the saved states. */
export const _resetState = (): void => {
  listeners?.abort();
  listeners = null;
  pressedKeys.clear();
  refCount = 0;
};

/** Removes an observer; the last one stops observing. */
export const stopObserving = (): void => {
  if (refCount > 0) {
    refCount -= 1;
  }
  if (refCount === 0) {
    _resetState();
  }
};

/**
 * Whether one of `keyCodes` (names from helpers/unicode, separated by `|`, e.g. `'SHIFT|CONTROL'`) is pressed.
 */
export const isPressed = (keyCodes: string): boolean => [...pressedKeys].some(keyCode => isKey(keyCode, keyCodes));

/** Whether Ctrl (or Cmd on macOS) is pressed. */
export const isPressedCtrlKey = (): boolean => [...pressedKeys].some(keyCode => isCtrlMetaKey(keyCode));

/** The number of observers (for tests). */
export const _getRefCount = (): number => refCount;
