import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';
import init, { Model } from '@ironcalc/wasm';

export default async function createGrid(container) {
  await init(); // loads IronCalc's WebAssembly once

  const book = new FreeSheet(container, {
    sheetName: 'Income',
    data: [
      ['Month', 'Amount'],
      ['January', 4200],
      ['February', 3900],
      ['March', 4600],
    ],
    rowHeaders: true,
    colHeaders: true,
    contextMenu: true,
    formulas: { engine: Model },
    formulaBar: true,
    sheets: [
      { id: 'costs', name: 'Costs', data: [['Item', 'Amount'], ['Rent', 1800], ['Food', 950], ['Transport', 240]] },
      {
        id: 'summary',
        name: 'Summary',
        data: [
          ['Income', '=SUM(Income!B2:B4)'],
          ['Costs', '=SUM(Costs!B2:B4)'],
          ['Saved', '=B1-B2'],
          ['Saved, %', '=ROUND(B3/B1*100, 1)'],
        ],
      },
    ],
  });

  book.activateSheet('summary');

  return book;
}
