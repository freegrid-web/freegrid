import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

export default function createGrid(container) {
  return new FreeSheet(container, {
    data: [
      { region: 'North', q1: 120, q2: 135, q3: 150, q4: 160, total: 565, q1_27: 170, q2_27: 180 },
      { region: 'South', q1: 90, q2: 95, q3: 110, q4: 105, total: 400, q1_27: 115, q2_27: 120 },
      { region: 'East', q1: 130, q2: 125, q3: 140, q4: 155, total: 550, q1_27: 160, q2_27: 165 },
      { region: 'West', q1: 80, q2: 85, q3: 95, q4: 100, total: 360, q1_27: 105, q2_27: 110 },
    ],
    // A column with `columns` is a group: its title goes in a header row above them.
    columns: [
      { data: 'region', title: 'Region' },
      {
        title: '2026',
        collapsible: true, // − / +
        columns: [
          { data: 'q1', title: 'Q1' },
          { data: 'q2', title: 'Q2' },
          { data: 'q3', title: 'Q3' },
          { data: 'q4', title: 'Q4' },
          { data: 'total', title: 'Total', showWhenCollapsed: true }, // stays when 2026 is collapsed
        ],
      },
      {
        title: '2027',
        collapsible: true,
        collapsed: true, // starts collapsed
        columns: [{ data: 'q1_27', title: 'Q1' }, { data: 'q2_27', title: 'Q2' }],
      },
    ],
    rowHeaders: true,
    stretchH: 'all',
  });
}
