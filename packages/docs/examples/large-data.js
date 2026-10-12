import FreeGrid from 'freegrid';
import 'freegrid/dist/freegrid.full.css';

function createRows(rows, cols) {
  return Array.from({ length: rows }, (_, r) => [
    `Item ${r + 1}`,
    ...Array.from({ length: cols - 1 }, (__, c) => (r * 7 + (c + 1) * 13) % 1000),
  ]);
}

export default function createGrid(container) {
  return new FreeGrid(container, {
    data: createRows(10000, 20),
    rowHeaders: true,
    colHeaders: true,
    fixedColumnsLeft: 1,
    fixedRowsTop: 1,
    columnSorting: true,
    contextMenu: true,
    height: 420,
  });
}
