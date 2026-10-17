import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

export default function createGrid(container) {
  // A small toolbar above the grid; the same commands are in the context menu (right click) and on Ctrl+B/I/U.
  const toolbar = document.createElement('div');
  const grid = document.createElement('div');

  toolbar.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;align-items:center;flex-wrap:wrap';
  toolbar.innerHTML = '<button type="button" data-toggle="fontWeight:bold"><b>B</b></button>'
    + '<button type="button" data-toggle="fontStyle:italic"><i>I</i></button>'
    + '<button type="button" data-toggle="textDecoration:underline"><u>U</u></button>'
    + '<label>Text <input type="color" data-property="color" value="#c00000"></label>'
    + '<label>Fill <input type="color" data-property="background" value="#fff2cc"></label>'
    + '<button type="button" data-clear>Clear formatting</button>';
  container.append(toolbar, grid);

  const hot = new FreeSheet(grid, {
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
    // The toolbar works on the selection, so clicking it keeps the cells selected.
    outsideClickDeselects: false,
    contextMenu: ['undo', 'redo', '---------', 'alignment', 'formatting'],
    cell: [
      { row: 0, col: 0, style: { fontWeight: 'bold', color: '#1f2937', background: '#d9e1f2' } },
      { row: 0, col: 1, style: { fontWeight: 'bold', color: '#1f2937', background: '#d9e1f2' } },
      { row: 0, col: 2, style: { fontWeight: 'bold', color: '#1f2937', background: '#d9e1f2' } },
      { row: 0, col: 3, style: { fontWeight: 'bold', color: '#1f2937', background: '#d9e1f2' } },
      { row: 2, col: 3, style: { color: '#c00000', textDecoration: 'line-through' } },
    ],
  });

  hot.selectCell(1, 0, 1, 3);

  toolbar.querySelectorAll('[data-toggle]').forEach((button) => {
    const [property, value] = button.dataset.toggle.split(':');

    button.addEventListener('click', () => {
      const [row, col] = hot.getSelectedLast() || [0, 0];
      const on = (hot.getCellMeta(row, col).style || {})[property] !== value;

      hot.setCellStyle({ [property]: on ? value : null });
    });
  });
  toolbar.querySelectorAll('[data-property]').forEach((input) => {
    input.addEventListener('change', () => hot.setCellStyle({ [input.dataset.property]: input.value }));
  });
  toolbar.querySelector('[data-clear]').addEventListener('click', () => hot.setCellStyle(null));

  return hot;
}
