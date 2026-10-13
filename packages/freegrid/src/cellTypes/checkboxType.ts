import { getEditor } from './../editors';
import { getRenderer } from './../renderers';
import type { CellType } from './types';

const CELL_TYPE = 'checkbox';

const cellType: CellType = {
  editor: getEditor(CELL_TYPE),
  renderer: getRenderer(CELL_TYPE),
};

export default cellType;
