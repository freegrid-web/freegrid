import AutocompleteEditor from './autocompleteEditor';
import Hooks from './../pluginHooks';
import type { EditorGrid } from './_baseEditor';
import type { CellProperties } from '../cellTypes/types';

/** An autocomplete editor that only takes a choice from the list: it shows every choice (`filter: false`, `strict`). */
class DropdownEditor extends AutocompleteEditor {
  prepare(row: number, col: number, prop: string | number, td: HTMLTableCellElement, originalValue: unknown,
    cellProperties: CellProperties): void {
    super.prepare(row, col, prop, td, originalValue, cellProperties);
    this.cellProperties.filter = false;
    this.cellProperties.strict = true;
  }
}

// A cell with this editor is validated as strict, also before the editor was ever opened.
Hooks.getSingleton().add('beforeValidate', function(this: EditorGrid, value: unknown, row: number, col: string | number) {
  const cellMeta = this.getCellMeta(row, this.propToCol(col));

  if (cellMeta.editor === DropdownEditor && cellMeta.strict === undefined) {
    cellMeta.filter = false;
    cellMeta.strict = true;
  }
});

export default DropdownEditor;
