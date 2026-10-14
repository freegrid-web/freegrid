/**
 * Layout: visibility, offsets, scroll positions, sizes, styles and the scrollbar width.
 */
import { polymerUnwrap } from './tree';

type Scrollable = HTMLElement | Window;
type StyledNode = Node & { style?: CSSStyleDeclaration; host?: StyledNode };

/**
 * Checks if the element is in the document and neither it nor an ancestor has `display: none` set inline.
 * Shadow roots are followed to their host.
 */
export const isVisible = (elem: StyledNode | null): boolean => {
  let next = elem;

  while (polymerUnwrap(next) !== document.documentElement) { // until <html> reached
    if (next === null) { // parent detached from DOM
      return false;
    } else if (next.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
      // A shadow root continues at its host; any other fragment is detached from the document.
      return next.host ? isVisible(next.host) : false;
    } else if ((next as HTMLElement).style.display === 'none') {
      return false;
    }
    next = next.parentNode;
  }

  return true;
};

/**
 * Returns the element's position relative to the document (adding the window scroll for fixed elements).
 */
export const offset = (elem: HTMLElement): { left: number; top: number } => {
  const docElem = document.documentElement;
  let elementToCheck: HTMLElement | null = elem;
  let offsetLeft = elem.offsetLeft;
  let offsetTop = elem.offsetTop;
  let lastElem = elem;

  elementToCheck = elementToCheck.offsetParent as HTMLElement | null;
  while (elementToCheck) {
    // from my observation, document.body always has scrollLeft/scrollTop == 0
    if (elementToCheck === document.body) {
      break;
    }
    offsetLeft += elementToCheck.offsetLeft;
    offsetTop += elementToCheck.offsetTop;
    lastElem = elementToCheck;
    elementToCheck = elementToCheck.offsetParent as HTMLElement | null;
  }

  if (lastElem && lastElem.style.position === 'fixed') {
    offsetLeft += window.pageXOffset || docElem.scrollLeft;
    offsetTop += window.pageYOffset || docElem.scrollTop;
  }

  return {
    left: offsetLeft,
    top: offsetTop,
  };
};

/**
 * Returns the window's vertical scroll position.
 */
export const getWindowScrollTop = (): number => window.scrollY;

/**
 * Returns the window's horizontal scroll position.
 */
export const getWindowScrollLeft = (): number => window.scrollX;

/**
 * Returns the vertical scroll position of an element or the window.
 */
export const getScrollTop = (element: Scrollable): number => (element === window ? getWindowScrollTop() : (element as HTMLElement).scrollTop);

/**
 * Returns the horizontal scroll position of an element or the window.
 */
export const getScrollLeft = (element: Scrollable): number => (element === window ? getWindowScrollLeft() : (element as HTMLElement).scrollLeft);

/**
 * Returns the closest ancestor with overflow `scroll` or `auto` (inline or computed), or the window.
 */
export const getScrollableElement = (element: Node): Scrollable => {
  const props = ['auto', 'scroll'];
  let el = element.parentNode as HTMLElement | null;

  while (el && el.style && document.body !== el) {
    const overflow = el.style.overflow;
    const overflowX = el.style.overflowX;
    const overflowY = el.style.overflowY;

    if (overflow === 'scroll' || overflowX === 'scroll' || overflowY === 'scroll') {
      return el;
    }
    const computedStyle = window.getComputedStyle(el);
    const computedOverflow = computedStyle.getPropertyValue('overflow');
    const computedOverflowY = computedStyle.getPropertyValue('overflow-y');
    const computedOverflowX = computedStyle.getPropertyValue('overflow-x');

    if (computedOverflow === 'scroll' || computedOverflowX === 'scroll' || computedOverflowY === 'scroll') {
      return el;
    }

    // The '+ 1' after the scrollHeight/scrollWidth is to prevent problems with zoomed out Chrome.
    if (el.clientHeight <= el.scrollHeight + 1 && (props.indexOf(overflowY) !== -1 || props.indexOf(overflow) !== -1 ||
        props.indexOf(computedOverflow) !== -1 || props.indexOf(computedOverflowY) !== -1)) {
      return el;
    }
    if (el.clientWidth <= el.scrollWidth + 1 && (props.indexOf(overflowX) !== -1 || props.indexOf(overflow) !== -1 ||
        props.indexOf(computedOverflow) !== -1 || props.indexOf(computedOverflowX) !== -1)) {
      return el;
    }
    el = el.parentNode as HTMLElement | null;
  }

  return window;
};

/**
 * Returns the closest ancestor that clips its content (inline overflow other than `visible`, or computed overflow
 * `scroll`, `hidden` or `auto`), or the window.
 */
export const getTrimmingContainer = (base: Node): Scrollable => {
  let el = base.parentNode as HTMLElement | null;

  while (el && el.style && document.body !== el) {
    if (el.style.overflow !== 'visible' && el.style.overflow !== '') {
      return el;
    }

    const computedStyle = getComputedStyle(el);
    const allowedProperties = ['scroll', 'hidden', 'auto'];
    const property = computedStyle.getPropertyValue('overflow');
    const propertyY = computedStyle.getPropertyValue('overflow-y');
    const propertyX = computedStyle.getPropertyValue('overflow-x');

    if (allowedProperties.includes(property) || allowedProperties.includes(propertyY) || allowedProperties.includes(propertyX)) {
      return el;
    }

    el = el.parentNode as HTMLElement | null;
  }

  return window;
};

/**
 * Returns a style value: the inline one, else the computed one; for the window, its inner `width`/`height` in px.
 * `undefined` when there is no value.
 */
export const getStyle = (element: HTMLElement | Window | null | undefined, prop: string): string | undefined => {
  if (!element) {
    return undefined;
  }
  if (element === window) {
    if (prop === 'width') {
      return `${window.innerWidth}px`;
    }
    if (prop === 'height') {
      return `${window.innerHeight}px`;
    }

    return undefined;
  }
  const styleProp = ((element as HTMLElement).style as unknown as Record<string, string | undefined>)[prop];

  if (styleProp !== '' && styleProp !== void 0) {
    return styleProp;
  }
  const computedProp = (getComputedStyle(element as HTMLElement) as unknown as Record<string, string | undefined>)[prop];

  if (computedProp !== '' && computedProp !== void 0) {
    return computedProp;
  }

  return undefined;
};

/**
 * Returns the computed style of the element (needed when the style comes from a stylesheet).
 */
export const getComputedStyle = (element: Element): CSSStyleDeclaration => (document.defaultView as Window).getComputedStyle(element);

/**
 * Returns the element's outer width.
 */
export const outerWidth = (element: HTMLElement): number => element.offsetWidth;

/**
 * Returns the element's outer height.
 */
export const outerHeight = (elem: HTMLElement): number => elem.offsetHeight;

/**
 * Returns the inner height of an element (`clientHeight`) or the window (`innerHeight`).
 */
export const innerHeight = (element: HTMLElement | Window): number =>
  (element as HTMLElement).clientHeight || (element as Window).innerHeight;

/**
 * Returns the inner width of an element (`clientWidth`) or the window (`innerWidth`).
 */
export const innerWidth = (element: HTMLElement | Window): number =>
  (element as HTMLElement).clientWidth || (element as Window).innerWidth;

let cachedScrollbarWidth: number | undefined;

// http://stackoverflow.com/questions/986937/how-can-i-get-the-browsers-scrollbar-sizes
const calculateScrollbarWidth = (): number => {
  const inner = document.createElement('div');

  inner.style.height = '200px';
  inner.style.width = '100%';

  const outer = document.createElement('div');

  outer.style.boxSizing = 'content-box';
  outer.style.height = '150px';
  outer.style.left = '0px';
  outer.style.overflow = 'hidden';
  outer.style.position = 'absolute';
  outer.style.top = '0px';
  outer.style.width = '200px';
  outer.style.visibility = 'hidden';
  outer.appendChild(inner);

  (document.body || document.documentElement).appendChild(outer);
  const w1 = inner.offsetWidth;

  outer.style.overflow = 'scroll';
  let w2 = inner.offsetWidth;

  if (w1 === w2) {
    w2 = outer.clientWidth;
  }

  (document.body || document.documentElement).removeChild(outer);

  return w1 - w2;
};

/**
 * Returns the browser's scrollbar width in px (measured once).
 */
export const getScrollbarWidth = (): number => {
  if (cachedScrollbarWidth === void 0) {
    cachedScrollbarWidth = calculateScrollbarWidth();
  }

  return cachedScrollbarWidth;
};

/**
 * Checks if the element shows a vertical scrollbar.
 */
export const hasVerticalScrollbar = (element: HTMLElement): boolean => element.offsetWidth !== element.clientWidth;

/**
 * Checks if the element shows a horizontal scrollbar.
 */
export const hasHorizontalScrollbar = (element: HTMLElement): boolean => element.offsetHeight !== element.clientHeight;
