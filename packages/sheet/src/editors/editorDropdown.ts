import EditorAutocomplete from './editorAutocomplete';
import Hooks from './../pluginHooks';
import type { EditorHost } from './editorBase';
import type { CellProperties } from '../cellTypes/types';

/** An autocomplete editor that only takes a choice from the list: it shows every choice (`filter: false`, `strict`). */
class EditorDropdown extends EditorAutocomplete {
  prepare(row: number, col: number, prop: string | number, td: HTMLTableCellElement, originalValue: unknown,
    cellProperties: CellProperties): void {
    super.prepare(row, col, prop, td, originalValue, cellProperties);
    this.cellProperties.filter = false;
    this.cellProperties.strict = true;
  }
}

// A cell with this editor is validated as strict, also before the editor was ever opened.
Hooks.getSingleton().add('beforeValidate', function(this: EditorHost, value: unknown, row: number, col: string | number) {
  const cellMeta = this.getCellMeta(row, this.propToCol(col));

  if (cellMeta.editor === EditorDropdown && cellMeta.strict === undefined) {
    cellMeta.filter = false;
    cellMeta.strict = true;
  }
});

export default EditorDropdown;
