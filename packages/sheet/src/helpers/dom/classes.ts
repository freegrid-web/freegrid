/**
 * CSS class helpers. They add, remove and match the FreeSheet/legacy counterpart of every known class name
 * (`fs-core` ↔ `htCore`, see `helpers/classNames`), so code and stylesheets using either name keep working
 * during FreeSheet 0.x.
 */
import { toFreeSheetClassName, toLegacyClassName, withCounterpartClassNames } from '../classNames';

type ClassNames = string | readonly string[] | null | undefined;

// The names up to the first empty one (upstream behavior, kept as is).
const filterEmptyClassNames = (classNames: ArrayLike<string> | null | undefined): string[] => {
  const result: string[] = [];

  if (!classNames || !classNames.length) {
    return result;
  }
  for (let i = 0; classNames[i]; i++) {
    result.push(classNames[i]);
  }

  return result;
};

const classListHas = (element: Element, className: unknown): boolean => {
  if (element.classList === void 0 || typeof className !== 'string' || className === '') {
    return false;
  }

  return element.classList.contains(className);
};

const toClassList = (classes: ClassNames): string[] => filterEmptyClassNames(typeof classes === 'string' ? classes.split(' ') : classes);

// Adds the counterpart of every known name; anything that is not a string or an array passes through.
const expandClassNames = (className: ClassNames): ClassNames => {
  const classNames = typeof className === 'string' ? className.split(' ') : className;

  return Array.isArray(classNames) ? withCounterpartClassNames(classNames.filter(name => name)) : classNames;
};

/**
 * Checks if the element has the class, or its FreeSheet/legacy counterpart.
 */
export const hasClass = (element: Element, className: string): boolean => {
  const counterpart = toFreeSheetClassName(className) === className ? toLegacyClassName(className) : toFreeSheetClassName(className);

  return classListHas(element, className) || (counterpart !== className && classListHas(element, counterpart));
};

/**
 * Adds classes (a space-separated string or an array) and their counterparts.
 */
export const addClass = (element: Element, className: ClassNames): void => {
  const classes = toClassList(expandClassNames(className));

  if (classes.length > 0) {
    element.classList.add(...classes);
  }
};

/**
 * Removes classes (a space-separated string or an array) and their counterparts.
 */
export const removeClass = (element: Element, className: ClassNames): void => {
  const classes = toClassList(expandClassNames(className));

  if (classes.length > 0) {
    element.classList.remove(...classes);
  }
};
