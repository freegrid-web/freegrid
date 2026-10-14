import { getEditor } from './../editors';
import { getRenderer } from './../renderers';
import type { CellType } from './types';

const CELL_TYPE = 'handsontable';

const cellType: CellType = {
  editor: getEditor(CELL_TYPE),
  // displays small gray arrow on right side of the cell
  renderer: getRenderer('autocomplete'),
};

export default cellType;
