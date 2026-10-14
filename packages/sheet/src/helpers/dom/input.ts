/**
 * Inputs: caret and selection, input detection, and plain event listeners.
 */

type TextInput = HTMLInputElement | HTMLTextAreaElement;

/**
 * Adds an event listener (bubbling phase).
 */
export const addEvent = <E extends Event>(element: EventTarget, event: string, callback: (event: E) => void): void => {
  element.addEventListener(event, callback as EventListener, false);
};

/**
 * Removes an event listener added with `addEvent`.
 */
export const removeEvent = <E extends Event>(element: EventTarget, event: string, callback: (event: E) => void): void => {
  element.removeEventListener(event, callback as EventListener, false);
};

/**
 * Returns the caret position in a text input (0 when there is none).
 */
export const getCaretPosition = (el: TextInput): number => {
  if (el.selectionStart) {
    return el.selectionStart;
  }

  return 0;
};

/**
 * Returns the end of the selection in a text input (0 when there is none).
 */
export const getSelectionEndPosition = (el: TextInput): number => {
  if (el.selectionEnd) {
    return el.selectionEnd;
  }

  return 0;
};

/**
 * Returns the text selected in the document.
 */
export const getSelectionText = (): string => (window.getSelection() as Selection).toString();

/**
 * Focuses a text input and selects from `pos` to `endPos` (a caret at `pos` when `endPos` is omitted). Works
 * around browsers that refuse while the parent is hidden.
 */
export const setCaretPosition = (element: TextInput, pos: number, endPos: number = pos): void => {
  if (element.setSelectionRange) {
    element.focus();

    try {
      element.setSelectionRange(pos, endPos);
    } catch (err) {
      const elementParent = element.parentNode as HTMLElement;
      const parentDisplayValue = elementParent.style.display;

      elementParent.style.display = 'block';
      element.setSelectionRange(pos, endPos);
      elementParent.style.display = parentDisplayValue;
    }
  }
};

/**
 * Checks if the element is an input, select, textarea or editable element. A missing element is returned as it
 * is (`null`/`undefined`), as upstream did.
 */
export const isInput = (element: Element | null | undefined): boolean | null | undefined => {
  if (!element) {
    return element;
  }

  return ['INPUT', 'SELECT', 'TEXTAREA'].indexOf(element.nodeName) > -1 || (element as HTMLElement).contentEditable === 'true';
};

/**
 * Checks if the element is an input that is not part of FreeSheet (not its editor or copy-paste field).
 */
export const isOutsideInput = (element: Element | null | undefined): boolean | null | undefined =>
  isInput(element) && (element as Element).className.indexOf('fs-editor-input') === -1 &&
    (element as Element).className.indexOf('copyPaste') === -1;
