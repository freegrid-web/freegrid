import { getEditor } from './../editors';
import { getRenderer } from './../renderers';
import { getValidator } from './../validators';
import type { CellType } from './types';

const CELL_TYPE = 'numeric';

const cellType: CellType = {
  editor: getEditor(CELL_TYPE),
  renderer: getRenderer(CELL_TYPE),
  validator: getValidator(CELL_TYPE),
  dataType: 'number',
};

export default cellType;
