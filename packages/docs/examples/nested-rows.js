import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

export default function createGrid(container) {
  return new FreeSheet(container, {
    data: [
      { task: 'Plan', owner: 'Ada', hours: 12, __children: [
        { task: 'Goals', owner: 'Ada', hours: 4 },
        { task: 'Budget', owner: 'Grace', hours: 8, __children: [
          { task: 'Hardware', owner: 'Grace', hours: 5 },
          { task: 'Licences', owner: 'Linus', hours: 3 },
        ] },
      ] },
      { task: 'Build', owner: 'Linus', hours: 40, __children: [
        { task: 'API', owner: 'Linus', hours: 24 },
        { task: 'Interface', owner: 'Ada', hours: 16 },
      ] },
      { task: 'Launch', owner: 'Grace', hours: 6 },
    ],
    columns: [{ data: 'task' }, { data: 'owner' }, { data: 'hours', type: 'numeric' }],
    colHeaders: ['Task', 'Owner', 'Hours'],
    rowHeaders: true,
    stretchH: 'all',
    contextMenu: true, // Insert child row, Indent, Outdent, Expand/Collapse
    columnSorting: true, // sorts the children of each parent
    filters: true,
    dropdownMenu: true,
    nestedRows: { numbering: 'outline' }, // row numbers 1, 1.1, 1.2, 1.2.1, 2
  });
}
