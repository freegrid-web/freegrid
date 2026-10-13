import { getEditor } from './../editors';
import { getRenderer } from './../renderers';
import { getValidator } from './../validators';
import type { CellType } from './types';

const CELL_TYPE = 'dropdown';

const cellType: CellType = {
  editor: getEditor(CELL_TYPE),
  // displays small gray arrow on right side of the cell
  renderer: getRenderer('autocomplete'),
  validator: getValidator('autocomplete'),
};

export default cellType;
