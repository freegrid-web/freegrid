/**
 * Utility to register editors and common namespace for keeping reference to all editor classes
 */
import staticRegister from './../utils/staticRegister';
import Hooks from './../pluginHooks';

import EditorBase from './editorBase';
import type { EditorHost } from './editorBase';
import EditorAutocomplete from './editorAutocomplete';
import EditorCheckbox from './editorCheckbox';
import EditorDate from './editorDate';
import EditorDropdown from './editorDropdown';
import EditorHandsontable from './editorHandsontable';
import EditorNumeric from './editorNumeric';
import EditorPassword from './editorPassword';
import EditorSelect from './editorSelect';
import EditorText from './editorText';

type EditorClass = new (hotInstance: EditorHost) => EditorBase;

/** An editor class and its instance per grid (an editor is a singleton per grid). */
export class RegisteredEditor {
  #editorClass: EditorClass;

  #instances: Record<string, EditorBase | null> = {};

  constructor(editorClass: EditorClass) {
    this.#editorClass = editorClass;
    const instances = this.#instances;

    // A function, not an arrow: `this` is the destroyed grid.
    Hooks.getSingleton().add('afterDestroy', function(this: EditorHost) {
      instances[this.guid] = null;
    });
  }

  getConstructor(): EditorClass {
    return this.#editorClass;
  }

  getInstance(hotInstance: EditorHost): EditorBase {
    if (!(hotInstance.guid in this.#instances)) {
      this.#instances[hotInstance.guid] = new this.#editorClass(hotInstance);
    }

    return this.#instances[hotInstance.guid] as EditorBase;
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

registerEditor('base', EditorBase);
registerEditor('autocomplete', EditorAutocomplete);
registerEditor('checkbox', EditorCheckbox);
registerEditor('date', EditorDate);
registerEditor('dropdown', EditorDropdown);
registerEditor('handsontable', EditorHandsontable);
registerEditor('numeric', EditorNumeric);
registerEditor('password', EditorPassword);
registerEditor('select', EditorSelect);
registerEditor('text', EditorText);

/** The grid's instance of an editor, given by name or by class (a class is registered on first use). */
export const getEditorInstance = (name: string | EditorClass, hotInstance: EditorHost): EditorBase => {
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
