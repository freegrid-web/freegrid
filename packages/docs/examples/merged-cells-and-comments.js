import FreeGrid from 'freegrid';
import 'freegrid/dist/freegrid.full.css';

const green = { width: 2, color: '#1a7f37' };

export default function createGrid(container) {
  return new FreeGrid(container, {
    data: FreeGrid.helper.createSpreadsheetData(8, 8),
    rowHeaders: true,
    colHeaders: true,
    contextMenu: true,
    stretchH: 'all',
    mergeCells: [
      { row: 1, col: 1, rowspan: 2, colspan: 3 },
      { row: 4, col: 4, rowspan: 3, colspan: 2 },
    ],
    comments: true,
    cell: [
      { row: 0, col: 0, comment: { value: 'Comments are free too.' } },
      { row: 5, col: 1, comment: { value: 'Right-click to edit or delete this comment.' } },
    ],
    customBorders: [
      { range: { from: { row: 1, col: 1 }, to: { row: 2, col: 3 } }, top: green, bottom: green, left: green, right: green },
    ],
  });
}
