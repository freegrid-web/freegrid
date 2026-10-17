import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

export default function createGrid(container) {
  // Buttons above the grid: download as Excel or CSV, open an .xlsx or .csv file.
  const toolbar = document.createElement('div');
  const grid = document.createElement('div');

  toolbar.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;align-items:center';
  toolbar.innerHTML = '<button type="button" data-format="xlsx">Download .xlsx</button>'
    + '<button type="button" data-format="csv">Download .csv</button>'
    + '<label>Open a file <input type="file" accept=".xlsx,.csv"></label>';
  container.append(toolbar, grid);

  const hot = new FreeSheet(grid, {
    data: [
      ['Region', 'Q1', 'Q2', 'Total'],
      ['North', 120, 135, '=SUM(B2:C2)'],
      ['South', 90, 95, '=SUM(B3:C3)'],
      ['East', 130, 125, '=SUM(B4:C4)'],
    ],
    rowHeaders: true,
    colHeaders: true,
    stretchH: 'all',
    fixedRowsTop: 1,
    comments: true,
    cell: [
      { row: 0, col: 0, style: { fontWeight: 'bold' } },
      { row: 0, col: 1, style: { fontWeight: 'bold' } },
      { row: 0, col: 2, style: { fontWeight: 'bold' } },
      { row: 0, col: 3, style: { fontWeight: 'bold' } },
      { row: 1, col: 0, comment: { value: 'Best region this year' } },
    ],
    conditionalFormatting: [{ range: 'B2:C4', colorScale: ['#f8696b', '#ffeb84', '#63be7b'] }],
  });

  toolbar.querySelectorAll('button').forEach((button) => {
    button.addEventListener('click', () => hot.downloadFile(button.dataset.format, `regions.${button.dataset.format}`));
  });
  toolbar.querySelector('input').addEventListener('change', (event) => {
    if (event.target.files[0]) {
      hot.importFile(event.target.files[0]);
    }
  });

  return hot;
}
