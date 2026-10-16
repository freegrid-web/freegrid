import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

export default function createGrid(container) {
  return new FreeSheet(container, {
    data: [
      ['North', 120, 135, 150, 160, 565, 170, 180],
      ['South', 90, 95, 110, 105, 400, 115, 120],
      ['East', 130, 125, 140, 155, 550, 160, 165],
      ['West', 80, 85, 95, 100, 360, 105, 110],
    ],
    nestedHeaders: [
      ['Region', { label: '2026', colspan: 5 }, { label: '2027', colspan: 2 }],
      ['', 'Q1', 'Q2', 'Q3', 'Q4', 'Total', 'Q1', 'Q2'],
    ],
    // −/+ on the year headers; 2026 keeps its Total column when collapsed.
    collapsibleColumns: [{ row: 0, col: 1, show: 'last' }, { row: 0, col: 6 }],
    rowHeaders: true,
    stretchH: 'all',
  });
}
