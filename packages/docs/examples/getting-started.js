import FreeGrid from '@freegrid/sheet';
import '@freegrid/sheet/dist/freegrid.full.css';

export default function createGrid(container) {
  return new FreeGrid(container, {
    data: [
      ['Name', 'City', 'Score'],
      ['Ona', 'Vilnius', 92],
      ['Jonas', 'Kaunas', 87],
      ['Marta', 'Riga', 95],
    ],
    rowHeaders: true,
    colHeaders: true,
  });
}
