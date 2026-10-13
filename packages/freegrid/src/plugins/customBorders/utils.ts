import { hasOwnProperty, isObject } from './../../helpers/object';
import type { PluginHost } from './../_base';

/** The sides of a cell. */
export type Side = 'top' | 'right' | 'bottom' | 'left';

export const SIDES: Side[] = ['top', 'right', 'bottom', 'left'];

/** One side's border, or `{ hide: true }`. */
export type SideBorder = { width?: number; color?: string; hide?: boolean };

/** A cell's borders, as Walkontable draws them. */
export type CellBorders = {
  id: string;
  border: { width: number; color: string; cornerVisible: boolean };
  row: number;
  col: number;
  top: SideBorder;
  right: SideBorder;
  bottom: SideBorder;
  left: SideBorder;
};

/**
 * Create separated id for borders for each cell.
 *
 * @param row Visual row index.
 * @param col Visual column index.
 */
export const createId = (row: number, col: number): string => `border_row${row}col${col}`;

/**
 * Create default single border for each position (top/right/bottom/left).
 */
export const createDefaultCustomBorder = (): SideBorder => ({
  width: 1,
  color: 'var(--fg-custom-border-color)', // see src/css/variables.css
});

/**
 * Create default object for empty border.
 */
export const createSingleEmptyBorder = (): SideBorder => ({ hide: true });

/**
 * Create default FreeGrid border object.
 */
export const createDefaultHtBorder = (): CellBorders['border'] => ({
  width: 1,
  color: 'var(--fg-custom-border-color)', // see src/css/variables.css
  cornerVisible: false,
});

/**
 * Prepare empty border for each cell with all custom borders hidden.
 *
 * @param row Visual row index.
 * @param col Visual column index.
 */
export const createEmptyBorders = (row: number, col: number): CellBorders => ({
  id: createId(row, col),
  border: createDefaultHtBorder(),
  row,
  col,
  top: createSingleEmptyBorder(),
  right: createSingleEmptyBorder(),
  bottom: createSingleEmptyBorder(),
  left: createSingleEmptyBorder(),
});

/**
 * `defaultBorder` with the sides `customBorder` has: an object as it is, another truthy value as the default border,
 * a falsy value as hidden. `customBorder` gets the same side objects.
 */
export const extendDefaultBorder = (defaultBorder: CellBorders, customBorder: Record<string, unknown>): CellBorders => {
  if (hasOwnProperty(customBorder, 'border')) {
    defaultBorder.border = customBorder.border as CellBorders['border'];
  }

  SIDES.forEach((side) => {
    if (!hasOwnProperty(customBorder, side)) {
      return;
    }
    if (!customBorder[side]) {
      customBorder[side] = createSingleEmptyBorder();
    } else if (!isObject(customBorder[side])) {
      customBorder[side] = createDefaultCustomBorder();
    }
    defaultBorder[side] = customBorder[side] as SideBorder;
  });

  return defaultBorder;
};

/**
 * Whether a selected cell has borders: on the side `direction`, or (without it) any.
 */
export const checkSelectionBorders = (hot: PluginHost, direction?: Side): boolean => {
  let atLeastOneHasBorder = false;

  hot.getSelectedRange().forEach((range: { forAll(callback: (row: number, col: number) => boolean | void): void }) => {
    range.forAll((r, c) => {
      const metaBorders = hot.getCellMeta(r, c).borders;

      if (metaBorders && (!direction || !hasOwnProperty(metaBorders[direction], 'hide') ||
        metaBorders[direction].hide === false)) {
        atLeastOneHasBorder = true;

        return false; // breaks forAll
      }

      return undefined;
    });
  });

  return atLeastOneHasBorder;
};

/**
 * Mark label in contextMenu as selected.
 */
export const markSelected = (label: string): string => `<span class="selected">${String.fromCharCode(10003)}</span>${label}`;
