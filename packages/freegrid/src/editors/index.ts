/**
 * Utility to register editors and common namespace for keeping reference to all editor classes
 */
import staticRegister from './../utils/staticRegister';
import Hooks from './../pluginHooks';

import BaseEditor from './_baseEditor';
import type { EditorGrid } from './_baseEditor';
import AutocompleteEditor from './autocompleteEditor';
import CheckboxEditor from './checkboxEditor';
import DateEditor from './dateEditor';
import DropdownEditor from './dropdownEditor';
import HandsontableEditor from './handsontableEditor';
import NumericEditor from './numericEditor';
import PasswordEditor from './passwordEditor';
import SelectEditor from './selectEditor';
import TextEditor from './textEditor';

type EditorClass = new (hotInstance: EditorGrid) => BaseEditor;

/** An editor class and its instance per grid (an editor is a singleton per grid). */
export class RegisteredEditor {
  #editorClass: EditorClass;

  #instances: Record<string, BaseEditor | null> = {};

  constructor(editorClass: EditorClass) {
    this.#editorClass = editorClass;
    const instances = this.#instances;

    // A function, not an arrow: `this` is the destroyed grid.
    Hooks.getSingleton().add('afterDestroy', function(this: EditorGrid) {
      instances[this.guid] = null;
    });
  }

  getConstructor(): EditorClass {
    return this.#editorClass;
  }

  getInstance(hotInstance: EditorGrid): BaseEditor {
    if (!(hotInstance.guid in this.#instances)) {
      this.#instances[hotInstance.guid] = new this.#editorClass(hotInstance);
    }

    return this.#instances[hotInstance.guid] as BaseEditor;
  }
}

const registeredEditorClasses = new WeakMap<EditorClass, RegisteredEditor>();

const {
  register,
  getItem,
  hasItem,
  getNames,
  getValues,
} = staticRegister<RegisteredEditor>('editors');

/** Registers an editor class under `name` (or only as a class, for a `null` name). */
const registerEditor = (name: string | null, editorClass: EditorClass): void => {
  const editorWrapper = new RegisteredEditor(editorClass);

  if (typeof name === 'string') {
    register(name, editorWrapper);
  }
  registeredEditorClasses.set(editorClass, editorWrapper);
};

registerEditor('base', BaseEditor);
registerEditor('autocomplete', AutocompleteEditor);
registerEditor('checkbox', CheckboxEditor);
// The date editor is still JavaScript (its inferred method types differ from the base's); typed in a later step.
registerEditor('date', DateEditor as unknown as EditorClass);
registerEditor('dropdown', DropdownEditor);
registerEditor('handsontable', HandsontableEditor);
registerEditor('numeric', NumericEditor);
registerEditor('password', PasswordEditor);
registerEditor('select', SelectEditor);
registerEditor('text', TextEditor);

/** The grid's instance of an editor, given by name or by class (a class is registered on first use). */
export const getEditorInstance = (name: string | EditorClass, hotInstance: EditorGrid): BaseEditor => {
  let editor: RegisteredEditor | undefined;

  if (typeof name === 'function') {
    if (!registeredEditorClasses.get(name)) {
      registerEditor(null, name);
    }
    editor = registeredEditorClasses.get(name);
  } else if (typeof name === 'string') {
    editor = getItem(name);
  } else {
    throw Error('Only strings and functions can be passed as "editor" parameter');
  }
  if (!editor) {
    throw Error(`No editor registered under name "${name}"`);
  }

  return editor.getInstance(hotInstance);
};

/** A registered editor class; throws for an unknown name. */
const getEditor = (name: string): EditorClass => {
  if (!hasItem(name)) {
    throw Error(`No registered editor found under "${name}" name`);
  }

  return (getItem(name) as RegisteredEditor).getConstructor();
};

export {
  registerEditor,
  getEditor,
  getEditorInstance as _getEditorInstance,
  hasItem as hasEditor,
  getNames as getRegisteredEditorNames,
  getValues as getRegisteredEditors,
};
