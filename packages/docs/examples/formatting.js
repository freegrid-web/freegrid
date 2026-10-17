import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

export default function createGrid(container) {
  return new FreeSheet(container, {
    data: [
      ['Product', 'Price', 'Stock', 'Status'],
      ['Laptop', 1299, 12, 'In stock'],
      ['Monitor', 249, 0, 'Sold out'],
      ['Keyboard', 79, 48, 'In stock'],
      ['Mouse', 39, 5, 'Few left'],
    ],
    rowHeaders: true,
    colHeaders: true,
    stretchH: 'all',
    // Right click: the formatting bar opens above the menu; the menu has Format too.
    contextMenu: ['undo', 'redo', '---------', 'alignment', 'formatting'],
    formattingBar: true,
    cell: [
      { row: 0, col: 0, style: { fontWeight: 'bold', color: '#1f2937', background: '#d9e1f2' } },
      { row: 0, col: 1, style: { fontWeight: 'bold', color: '#1f2937', background: '#d9e1f2' } },
      { row: 0, col: 2, style: { fontWeight: 'bold', color: '#1f2937', background: '#d9e1f2' } },
      { row: 0, col: 3, style: { fontWeight: 'bold', color: '#1f2937', background: '#d9e1f2' } },
      { row: 2, col: 3, style: { color: '#c00000', textDecoration: 'line-through' } },
    ],
  });
}
