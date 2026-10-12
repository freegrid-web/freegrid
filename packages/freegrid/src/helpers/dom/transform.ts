/**
 * CSS transforms used to position overlays. Safari gets the `-webkit-` property, as upstream did.
 */
import { isSafari } from '../browser';

type StyledElement = { style: CSSStyleDeclaration };

// `-webkit-transform` is not a CSSStyleDeclaration property name in the DOM types; read and write it by name.
const styleOf = (element: StyledElement): Record<string, string> => element.style as unknown as Record<string, string>;

/**
 * Moves an overlay with `translate3d(left, top, 0)`.
 */
export const setOverlayPosition = (overlayElem: StyledElement, left: string, top: string): void => {
  if (isSafari()) {
    styleOf(overlayElem)['-webkit-transform'] = `translate3d(${left},${top},0)`;
  } else {
    overlayElem.style.transform = `translate3d(${left},${top},0)`;
  }
};

/**
 * Returns `[property, value]` of the element's transform, or -1 when it has none.
 */
export const getCssTransform = (element: StyledElement): [string, string] | -1 => {
  if (element.style.transform && element.style.transform !== '') {
    return ['transform', element.style.transform];

  } else if (styleOf(element)['-webkit-transform'] && styleOf(element)['-webkit-transform'] !== '') {
    return ['-webkit-transform', styleOf(element)['-webkit-transform']];
  }

  return -1;
};

/**
 * Removes the element's transform.
 */
export const resetCssTransform = (element: StyledElement): void => {
  if (element.style.transform && element.style.transform !== '') {
    element.style.transform = '';
  } else if (styleOf(element)['-webkit-transform'] && styleOf(element)['-webkit-transform'] !== '') {
    styleOf(element)['-webkit-transform'] = '';
  }
};
