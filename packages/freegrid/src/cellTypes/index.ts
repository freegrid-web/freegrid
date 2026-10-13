import staticRegister from './../utils/staticRegister';
import { registerEditor } from './../editors';
import { registerRenderer } from './../renderers';
import { registerValidator } from './../validators';
import type { CellType } from './types';

import autocompleteCellType from './autocompleteType';
import checkboxCellType from './checkboxType';
import dateCellType from './dateType';
import dropdownCellType from './dropdownType';
import handsontableCellType from './handsontableType';
import numericCellType from './numericType';
import passwordCellType from './passwordType';
import textCellType from './textType';
import timeCellType from './timeType';

const {
  register,
  getItem,
  hasItem,
  getNames,
  getValues,
} = staticRegister<CellType>('cellTypes');

/** Registers a cell type, and its editor, renderer and validator under the same name. */
const registerCellType = (name: string, type: CellType): void => {
  const { editor, renderer, validator } = type;

  if (editor) {
    registerEditor(name, editor as Parameters<typeof registerEditor>[1]);
  }
  if (renderer) {
    registerRenderer(name, renderer);
  }
  if (validator) {
    registerValidator(name, validator);
  }
  register(name, type);
};

/** A registered cell type; throws for an unknown name. */
const getCellType = (name: string): CellType => {
  if (!hasItem(name)) {
    throw Error(`You declared cell type "${name}" as a string that is not mapped to a known object.
                 Cell type must be an object or a string mapped to an object registered by "FreeGrid.cellTypes.registerCellType" method`);
  }

  return getItem(name) as CellType;
};

registerCellType('autocomplete', autocompleteCellType);
registerCellType('checkbox', checkboxCellType);
registerCellType('date', dateCellType);
registerCellType('dropdown', dropdownCellType);
registerCellType('handsontable', handsontableCellType);
registerCellType('numeric', numericCellType);
registerCellType('password', passwordCellType);
registerCellType('text', textCellType);
registerCellType('time', timeCellType);

export {
  registerCellType,
  getCellType,
  hasItem as hasCellType,
  getNames as getRegisteredCellTypeNames,
  getValues as getRegisteredCellTypes,
};
