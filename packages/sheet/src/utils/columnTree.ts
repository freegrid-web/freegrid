/**
 * Column groups in `columns`: a column with `columns` of its own is a group over them. The grid works with the columns
 * without children (the leaves), in order; the groups become header rows above the column headers.
 *
 * ```js
 * columns: [
 *   { data: 'region', title: 'Region' },
 *   { title: '2026', collapsible: true, columns: [
 *     { data: 'q1', title: 'Q1' },
 *     { data: 'total', title: 'Total', showWhenCollapsed: true },
 *   ] },
 * ]
 * ```
 */
export type ColumnNode = Record<string, unknown> & {
  title?: string;
  columns?: ColumnNode[];
  /** A group: whether it has a − / + button. */
  collapsible?: boolean;
  /** A group: whether it starts collapsed. */
  collapsed?: boolean;
  /** A column: whether it stays when its group is collapsed (the first column does when none is marked). */
  showWhenCollapsed?: boolean;
  /** A column: whether it starts hidden. */
  hidden?: boolean;
};

/** A header over physical columns `start` to `end` on a header row (`level`, 0 = the top). */
export type ColumnGroup = {
  level: number;
  label: string;
  start: number;
  end: number;
  /** Set for groups from `columns`: whether the group is collapsible, starts collapsed, and the column it keeps. */
  collapsible?: boolean;
  collapsed?: boolean;
  kept?: number;
};

const trees = new WeakMap<object, ColumnNode[]>();

/** Whether `columns` has groups (a column with `columns`). */
export const isColumnTree = (columns: unknown): columns is ColumnNode[] => Array.isArray(columns) &&
  columns.some(column => !!column && typeof column === 'object' && Array.isArray((column as ColumnNode).columns));

/** The columns without children, in order. */
export const flattenColumns = (tree: ColumnNode[]): ColumnNode[] => tree.flatMap(column =>
  (column && Array.isArray(column.columns) ? flattenColumns(column.columns) : [column]));

/** Keeps the grid's column tree (`null`: no groups in `columns`). */
export const setColumnTree = (grid: object, tree: ColumnNode[] | null): void => {
  if (tree) {
    trees.set(grid, tree);
  } else {
    trees.delete(grid);
  }
};

/** The grid's column tree, or `undefined` when `columns` has no groups. */
export const getColumnTree = (grid: object): ColumnNode[] | undefined => trees.get(grid);

/**
 * The header rows of a column tree: for each row, the group over each physical column. The last row has the columns
 * themselves (their `title`).
 */
export const columnTreeLevels = (tree: ColumnNode[]): (ColumnGroup | undefined)[][] => {
  const depth = (nodes: ColumnNode[]): number => Math.max(1, ...nodes.map(node =>
    (node && Array.isArray(node.columns) ? depth(node.columns) + 1 : 1)));
  const count = depth(tree);
  const levels: (ColumnGroup | undefined)[][] = Array.from({ length: count }, () => []);
  let column = 0;
  const walk = (nodes: ColumnNode[], level: number) => nodes.forEach((node) => {
    if (node && Array.isArray(node.columns)) {
      const start = column;

      walk(node.columns, level + 1);

      const end = column - 1;

      if (end < start) {
        return;
      }
      const leaves = flattenColumns(node.columns);
      const kept = leaves.findIndex(leaf => leaf && leaf.showWhenCollapsed);
      const group: ColumnGroup = { level, label: String(node.title ?? ''), start, end,
        collapsible: !!node.collapsible, collapsed: !!node.collapsed, kept: start + Math.max(0, kept) };

      for (let i = start; i <= end; i += 1) {
        levels[level][i] = group;
      }
    } else {
      levels[count - 1][column] = { level: count - 1, label: String(node?.title ?? ''), start: column, end: column };
      column += 1;
    }
  });

  walk(tree, 0);

  return levels;
};
