import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

export default function createGrid(container) {
  return new FreeSheet(container, {
    data: [
      ['North', 'Ada', 'Laptop', 1200, '2026-01-14'],
      ['South', 'Linus', 'Phone', 650, '2026-01-20'],
      ['East', 'Grace', 'Laptop', 1350, '2026-02-03'],
      ['West', 'Alan', 'Tablet', 480, '2026-02-11'],
      ['North', 'Grace', 'Phone', 700, '2026-02-25'],
      ['South', 'Ada', 'Tablet', 520, '2026-03-04'],
      ['East', 'Linus', 'Laptop', 1280, '2026-03-17'],
      ['West', 'Ada', 'Phone', 640, '2026-03-29'],
    ],
    colHeaders: ['Region', 'Seller', 'Product', 'Amount', 'Date'],
    columns: [{}, {}, {}, { type: 'numeric' }, { type: 'date', dateFormat: 'YYYY-MM-DD' }],
    rowHeaders: true,
    stretchH: 'all',
    columnSorting: true,
    filters: true,
    dropdownMenu: true, // the ▾ button in each header
  });
}
