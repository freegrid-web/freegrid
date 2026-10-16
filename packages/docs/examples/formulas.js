import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';
import init, { Model } from '@ironcalc/wasm';

export default async function createGrid(container) {
  await init(); // loads IronCalc's WebAssembly once

  return new FreeSheet(container, {
    data: [
      ['Item', 'Price', 'Quantity', 'Total'],
      ['Apples', 1.2, 10, '=B2*C2'],
      ['Pears', 1.5, 6, '=B3*C3'],
      ['Plums', 2.4, 4, '=B4*C4'],
      ['', '', 'Sum', '=SUM(D2:D4)'],
      ['', '', 'Average price', '=ROUND(AVERAGE(B2:B4), 2)'],
    ],
    rowHeaders: true,
    colHeaders: true,
    contextMenu: true,
    formulas: { engine: Model },
    formulaBar: true,
  });
}
