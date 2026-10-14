import { getEditor } from './../editors';
import { getRenderer } from './../renderers';
import { getValidator } from './../validators';
import type { CellType } from './types';

const CELL_TYPE = 'time';

const cellType: CellType = {
  editor: getEditor('text'),
  // displays small gray arrow on right side of the cell
  renderer: getRenderer('text'),
  validator: getValidator(CELL_TYPE),
};

export default cellType;
