import { getEditor } from './../editors';
import { getRenderer } from './../renderers';
import { getValidator } from './../validators';
import type { CellType } from './types';

const CELL_TYPE = 'autocomplete';

const cellType: CellType = {
  editor: getEditor(CELL_TYPE),
  renderer: getRenderer(CELL_TYPE),
  validator: getValidator(CELL_TYPE),
};

export default cellType;
