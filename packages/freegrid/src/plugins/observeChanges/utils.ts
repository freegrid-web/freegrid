/** A JSON patch from the observer, with the cell it changes (`col` is undefined for a whole row). */
export type Patch = {
  op: string;
  path: string;
  value?: unknown;
  row?: number;
  col?: number | string;
};

/**
 * The row and the column of a JSON patch path (`/2/3`, `/2/name`, `/2`), or `null` when the path has no row.
 */
export const parsePath = (path: string): { row: number; col: number | string | undefined } | null => {
  const match = path.match(/^\/(\d+)\/?(.*)?$/);

  if (!match) {
    return null;
  }
  const [, row, column] = match;

  return {
    row: parseInt(row, 10),
    // A missing column stays undefined (`/^\d*$/` does not match "undefined").
    col: /^\d*$/.test(column as string) ? parseInt(column, 10) : column,
  };
};

/**
 * The observer's patches with their cells: without `length` patches and paths without a row, and with one patch for
 * each added or removed column (the observer makes one per row).
 */
export const cleanPatches = (patches: Patch[]): Patch[] => {
  const newOrRemovedColumns = new Set<number | string>();

  return patches
    .filter(patch => !/[/]length/i.test(patch.path) && parsePath(patch.path))
    .map((patch) => {
      const { row, col } = parsePath(patch.path)!;

      patch.row = row;
      patch.col = col;

      return patch;
    })
    .filter((patch) => {
      if (['add', 'remove'].includes(patch.op) && !Number.isNaN(Number(patch.col))) {
        if (newOrRemovedColumns.has(patch.col!)) {
          return false;
        }
        newOrRemovedColumns.add(patch.col!);
      }

      return true;
    });
};
