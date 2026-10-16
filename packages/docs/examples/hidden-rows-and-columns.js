import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

export default function createGrid(container) {
  return new FreeSheet(container, {
    data: [
      ['Region', 'Q1', 'Q2', 'Q3', 'Q4', 'Total'],
      ['North', 120, 135, 150, 160, 565],
      ['South', 90, 95, 110, 105, 400],
      ['East', 130, 125, 140, 155, 550],
      ['West', 80, 85, 95, 100, 360],
      ['Notes', 'internal', '', '', '', ''],
    ],
    rowHeaders: true,
    colHeaders: true,
    contextMenu: true, // right-click: Hide rows / Show rows, Hide columns / Show columns
    stretchH: 'all',
    hiddenRows: { rows: [5] }, // row 6 (Notes) starts hidden
    hiddenColumns: { columns: [2, 3] }, // Q2 and Q3 start hidden
  });
}
