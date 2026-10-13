import FreeGrid from '@freegrid/core';
import '@freegrid/core/dist/freegrid.full.css';

// A grid that shows most themed parts: headers, a selection, a read-only and an invalid cell, a comment, a date
// column, and the context menu (right-click).
export default function createGrid(container) {
  const grid = new FreeGrid(container, {
    data: [
      ['Apples', 'Fruit', 1.2, '10/12/2026', 'In stock'],
      ['Carrots', 'Vegetable', 0.8, '10/14/2026', 'In stock'],
      ['Cheese', 'Dairy', 'n/a', '10/15/2026', 'Low'],
      ['Bread', 'Bakery', 2.5, '10/16/2026', 'In stock'],
      ['Milk', 'Dairy', 1.1, '10/18/2026', 'Sold out'],
      ['Pears', 'Fruit', 1.6, '10/20/2026', 'In stock'],
    ],
    colHeaders: ['Product', 'Category', 'Price', 'Delivery', 'Status'],
    rowHeaders: true,
    contextMenu: true,
    comments: true,
    columns: [
      {},
      { type: 'dropdown', source: ['Fruit', 'Vegetable', 'Dairy', 'Bakery'] },
      { type: 'numeric', numericFormat: { pattern: '0.00' } },
      { type: 'date', dateFormat: 'MM/DD/YYYY', correctFormat: true },
      { readOnly: true },
    ],
    cell: [{ row: 0, col: 0, comment: { value: 'Seasonal: cheaper in autumn.' } }],
  });

  grid.validateCells();
  grid.selectCell(1, 1, 3, 2);

  return grid;
}
