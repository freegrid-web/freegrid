import { classNameIncludes, toLegacyClassName } from './../../helpers/classNames';
import { hasClass } from './../../helpers/dom/element';
import { KEY as SEPARATOR } from './predefinedItems/separator';
import type { SelectedRange } from './menuItem';

/** A range with corners (a CellRange). */
type CornersRange = { getTopLeftCorner(): { row: number; col: number }; getBottomRightCorner(): { row: number; col: number } };

/** A range of cells (`from`, `to`). */
type FromToRange = { from: { row: number; col: number }; to: { row: number; col: number } };

/** A range that visits its cells (`forAll`; `false` from the callback stops it). */
type IterableRange = { forAll(callback: (row: number, col: number) => boolean | void): void };

/** The selected ranges as `{ start, end }` (top left and bottom right corners), as menu item callbacks get them. */
export const normalizeSelection = (selRanges: CornersRange[]): SelectedRange[] => selRanges.map(range => ({
  start: range.getTopLeftCorner(),
  end: range.getBottomRightCorner(),
}));

export const isSeparator = (cell: HTMLElement): boolean => hasClass(cell, 'fg-separator');

export const hasSubMenu = (cell: HTMLElement): boolean => hasClass(cell, 'fg-submenu');

export const isDisabled = (cell: HTMLElement): boolean => hasClass(cell, 'fg-disabled');

export const isSelectionDisabled = (cell: HTMLElement): boolean => hasClass(cell, 'fg-selection-disabled');

/** The grid's selection (`getSelected()`), or `null` when there is none. */
export const getValidSelection = (hot: { getSelected(): number[][] | undefined }): number[][] | null => {
  const selected = hot.getSelected();

  // `selected[0] < 0` compares an array (as before): it is never true for a selection.
  if (!selected || (selected[0] as unknown as number) < 0) {
    return null;
  }

  return selected;
};

const VERTICAL_ALIGNMENTS = ['fg-top', 'fg-middle', 'fg-bottom'];
const HORIZONTAL_ALIGNMENTS = ['fg-left', 'fg-center', 'fg-right', 'fg-justify'];

// Removes alignment classes, in both their FreeGrid and legacy names.
const removeAlignmentClasses = (className: string, alignments: string[]): string => alignments
  .reduce((result, alignment) => result.replace(alignment, '').replace(toLegacyClassName(alignment), ''), className)
  .replace('  ', '');

/** `className` with the vertical alignment `alignment` (instead of another one). */
export const prepareVerticalAlignClass = (className: string, alignment: string): string => (
  classNameIncludes(className, alignment) ? className :
    `${removeAlignmentClasses(className, VERTICAL_ALIGNMENTS)} ${alignment}`);

/** `className` with the horizontal alignment `alignment` (instead of another one). */
export const prepareHorizontalAlignClass = (className: string, alignment: string): string => (
  classNameIncludes(className, alignment) ? className :
    `${removeAlignmentClasses(className, HORIZONTAL_ALIGNMENTS)} ${alignment}`);

/** `callback(row, col)` (a cell's class name) for the cells of the ranges, by row and column. */
export const getAlignmentClasses = (ranges: FromToRange[], callback: (row: number, col: number) => unknown) => {
  const classes: Record<number, unknown[]> = {};

  ranges.forEach(({ from, to }) => {
    for (let row = from.row; row <= to.row; row += 1) {
      for (let col = from.col; col <= to.col; col += 1) {
        if (!classes[row]) {
          classes[row] = [];
        }
        classes[row][col] = callback(row, col);
      }
    }
  });

  return classes;
};

type CellDescriptor = (row: number, col: number) => { className?: string };
type PropertySetter = (row: number, col: number, key: string, value: unknown) => void;

const applyAlignClassName = (row: number, col: number, type: string, alignment: string, cellDescriptor: CellDescriptor,
  propertySetter: PropertySetter): void => {
  const { className } = cellDescriptor(row, col);
  let newClassName = alignment;

  if (className) {
    newClassName = type === 'vertical' ? prepareVerticalAlignClass(className, alignment) :
      prepareHorizontalAlignClass(className, alignment);
  }

  propertySetter(row, col, 'className', newClassName);
};

/** Sets the alignment `alignment` (of `type`: `horizontal` or `vertical`) in the class name of the ranges' cells. */
export const align = (ranges: FromToRange[], type: string, alignment: string, cellDescriptor: CellDescriptor,
  propertySetter: PropertySetter): void => {
  ranges.forEach(({ from, to }) => {
    for (let row = from.row; row <= to.row; row += 1) {
      for (let col = from.col; col <= to.col; col += 1) {
        applyAlignClassName(row, col, type, alignment, cellDescriptor, propertySetter);
      }
    }
  });
};

/** Whether `comparator` is true for a cell of the ranges. */
export const checkSelectionConsistency = (ranges: unknown, comparator: (row: number, col: number) => unknown): boolean => {
  let result = false;

  if (Array.isArray(ranges)) {
    (ranges as IterableRange[]).some((range) => {
      range.forAll((row, col) => {
        if (comparator(row, col)) {
          result = true;

          return false;
        }

        return undefined;
      });

      return result;
    });
  }

  return result;
};

/** A check mark before the label. */
export const markLabelAsSelected = (label: string | null): string => (
  `<span class="selected">${String.fromCharCode(10003)}</span>${label}`);

/**
 * Whether a menu item is shown (despite its name): without `hidden`, or when its `hidden()` returns false. A `hidden`
 * that is not a function does not hide it.
 */
export const isItemHidden = (item: { hidden?: unknown }, instance: unknown): boolean => (
  !item.hidden || !(typeof item.hidden === 'function' && item.hidden.call(instance)));

type Named = { name?: unknown };

/** The items without separators at the start. */
const shiftSeparators = <T extends Named>(items: T[], separator: string): T[] => {
  const firstItem = items.findIndex(item => item.name !== separator);

  return firstItem === -1 ? [] : items.slice(firstItem);
};

/** The items without separators at the end. */
const popSeparators = <T extends Named>(items: T[], separator: string): T[] => (
  shiftSeparators([...items].reverse(), separator).reverse());

/** The items without an item named as the one before it (repeated separators). */
const removeDuplicatedSeparators = <T extends Named>(items: T[]): T[] => items
  .filter((item, index) => index === 0 || items[index - 1].name !== item.name);

/** The items without separators at the start or the end, and without repeated separators. */
export const filterSeparators = <T extends Named>(items: T[], separator: string = SEPARATOR): T[] => (
  removeDuplicatedSeparators(popSeparators(shiftSeparators(items, separator), separator)));
