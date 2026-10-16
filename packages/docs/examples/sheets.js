import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

export default function createGrid(container) {
  return new FreeSheet(container, {
    sheetName: 'Team',
    data: [
      ['Name', 'Role', 'Office'],
      ['Ada', 'Engineer', 'Vilnius'],
      ['Linus', 'Engineer', 'Kaunas'],
      ['Grace', 'Manager', 'Vilnius'],
    ],
    rowHeaders: true,
    colHeaders: true,
    contextMenu: true,
    // More sheets, created with the grid; + adds one, a double click renames, a right click opens the menu.
    sheets: [
      { id: 'offices', name: 'Offices', data: [['Office', 'Opened'], ['Vilnius', 2019], ['Kaunas', 2023]] },
      { id: 'notes', name: 'Notes', data: [['Plan the summer trip'], ['Order new laptops']], colHeaders: false },
    ],
  });
}
