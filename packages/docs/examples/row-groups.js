import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

export default function createGrid(container) {
  const grid = new FreeSheet(container, {
    data: [
      ['Costs', 'Q1', 'Q2'],
      ['Rent', 5400, 5400],
      ['Energy', 900, 640],
      ['Water', 210, 190],
      ['Utilities', 1110, 830],
      ['Laptops', 3600, 0],
      ['Software', 1200, 1200],
      ['Equipment', 4800, 1200],
      ['Total', 11310, 7430],
    ],
    rowHeaders: true,
    colHeaders: true,
    stretchH: 'all',
    contextMenu: true,
    rowGroups: true,
    columnOutline: true,
  });
  const groups = grid.getPlugin('rowGroups');

  // Each group's −/+ is on its sum row; the corner's 1, 2, 3 show the outline down to a level.
  groups.groupRows(1, 7);
  groups.groupRows(2, 3);
  groups.groupRows(5, 6);
  groups.collapseGroup(5);
  // The quarters as a group of columns.
  grid.getPlugin('columnOutline').groupColumns(1, 2);

  return grid;
}
