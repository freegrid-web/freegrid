import Hooks from './../pluginHooks';
import type { CellStyle } from './../utils/cellStyle';

/** A grid as the font row heights see it. */
type Grid = {
  getCellsMeta(): { row: number; style?: CellStyle }[];
  toPhysicalRow(row: number): number | null;
  addHook(name: string, callback: (...args: never[]) => unknown): void;
};

/** The height of a row for its text in a font size (CSS: `14pt`, `20px`), or 0 for no size. */
const heightFor = (fontSize: string | undefined): number => {
  const match = /^\s*(\d+(\.\d+)?)\s*(pt|px)?\s*$/i.exec(fontSize || '');

  if (!match) {
    return 0;
  }
  const pixels = match[3]?.toLowerCase() === 'px' ? Number(match[1]) : Number(match[1]) * (4 / 3);

  // The line (1.25 of the text) and the cell's padding and line.
  return Math.ceil(pixels * 1.25 + 6);
};

/** The heights rows need for their biggest font, by physical row (only the rows with a font size). */
const heights = new WeakMap<Grid, Map<number, number>>();

const measure = (grid: Grid): void => {
  const rows = new Map<number, number>();

  grid.getCellsMeta().forEach((meta) => {
    const height = heightFor(meta.style?.fontSize);

    if (height && height > (rows.get(meta.row) || 0)) {
      rows.set(meta.row, height);
    }
  });
  heights.set(grid, rows);
};

/**
 * Rows grow for the font sizes of their cells' `style`, as a spreadsheet's do: the grid's row heights are fixed, so a
 * row with a bigger font gets the height its text needs (never less than its own height).
 */
/** The grids whose rows are measured again before the next draw. */
const dirty = new WeakSet<Grid>();

const install = (grid: Grid): void => {
  ['afterSetCellStyle', 'afterSetCellFormat', 'afterLoadData', 'afterUpdateSettings', 'afterCreateRow',
    'afterRemoveRow', 'afterRowMove'].forEach(name => grid.addHook(name, () => {
    // Returns nothing: a hook's value would replace the next callback's first argument.
    dirty.add(grid);
  }));
  grid.addHook('modifyRowHeight', ((height: number, row: number) => {
    // Measured when a height is asked for, once after each change (the cell settings are all there by then).
    if (dirty.has(grid)) {
      dirty.delete(grid);
      measure(grid);
    }
    const physical = grid.toPhysicalRow(row);
    const needed = physical === null ? 0 : heights.get(grid)?.get(physical) || 0;

    return needed > (height || 0) ? needed : height;
  }) as (...args: never[]) => unknown);
  dirty.add(grid);
};

// Before the grid draws for the first time.
Hooks.getSingleton().add('beforeInit', function fontRows(this: Grid) {
  install(this);
});
