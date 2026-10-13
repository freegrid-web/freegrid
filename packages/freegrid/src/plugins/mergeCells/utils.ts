import type { MergedCellInfo } from './cellCoords';

/**
 * Apply the `colspan`/`rowspan` properties: the merged cell's first cell spans it, its other cells are hidden.
 *
 * @param TD The soon-to-be-modified cell.
 * @param mergedCellInfo The merged cell in question.
 * @param row Row index.
 * @param col Column index.
 */
// eslint-disable-next-line import/prefer-default-export
export const applySpanProperties = (TD: HTMLTableCellElement, mergedCellInfo: MergedCellInfo | null | false | undefined,
  row: number, col: number): void => {
  if (mergedCellInfo && mergedCellInfo.row === row && mergedCellInfo.col === col) {
    TD.setAttribute('rowspan', mergedCellInfo.rowspan.toString());
    TD.setAttribute('colspan', mergedCellInfo.colspan.toString());

    return;
  }
  TD.removeAttribute('rowspan');
  TD.removeAttribute('colspan');
  TD.style.display = mergedCellInfo ? 'none' : '';
};
