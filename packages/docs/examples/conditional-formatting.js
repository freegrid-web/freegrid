import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

export default function createGrid(container) {
  return new FreeSheet(container, {
    data: [
      ['North', 120, 135, 150, 160, 92, 'On track'],
      ['South', 90, 95, 110, 105, 64, 'Late'],
      ['East', 130, 125, 140, 155, 88, 'On track'],
      ['West', 80, 85, 95, 100, 41, 'Late'],
      ['Central', 110, 70, 60, 50, 23, 'At risk'],
    ],
    colHeaders: ['Region', 'Q1', 'Q2', 'Q3', 'Q4', 'Score', 'Status'],
    columns: [
      {},
      { type: 'numeric' }, { type: 'numeric' }, { type: 'numeric' }, { type: 'numeric' },
      { type: 'numeric', format: [{ dataBar: '#9fc2ea' }] }, // a bar as long as the score
      { format: [{ when: 'eq', value: 'Late', style: { background: '#f8d7da', color: '#842029' } }] },
    ],
    rowHeaders: true,
    stretchH: 'all',
    contextMenu: true, // right-click: Conditional formatting ▸
    sidePanel: true, // the rule editor and Manage Rules open at the right
    conditionalFormatting: [
      { range: 'B1:E5', colorScale: ['#f8696b', '#ffeb84', '#63be7b'] }, // red to green
      { range: 'A1:A5', when: 'eq', value: 'Central', style: { fontWeight: 'bold' } },
    ],
  });
}
