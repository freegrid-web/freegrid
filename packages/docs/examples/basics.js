import FreeGrid from 'freegrid';
import 'freegrid/dist/freegrid.full.css';

export default function createGrid(container) {
  return new FreeGrid(container, {
    data: [
      ['', 'Tesla', 'Volvo', 'Toyota', 'Ford'],
      ['2022', 10, 11, 12, 13],
      ['2023', 20, 11, 14, 13],
      ['2024', 30, 15, 12, 13],
      ['2025', 35, 18, 16, 15],
      ['2026', 42, 21, 19, 14],
    ],
    rowHeaders: true,
    colHeaders: true,
    contextMenu: true,
    columnSorting: true,
    manualColumnResize: true,
    manualRowResize: true,
    manualColumnMove: true,
    manualRowMove: true,
    stretchH: 'all',
    minSpareRows: 1,
  });
}
