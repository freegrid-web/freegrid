import { withLegacyClassNames } from './../helpers/classNames';
import { empty } from './../helpers/dom/element';
import EditorText from './editorText';

/**
 * @private
 * @editor EditorPassword
 * @class EditorPassword
 * @dependencies EditorText
 */
class EditorPassword extends EditorText {
  createElements(): void {
    super.createElements();

    const input = document.createElement('input');

    input.setAttribute('type', 'password');
    // Typed as the textarea it replaces: the text editor uses only what both have.
    this.TEXTAREA = input as unknown as HTMLTextAreaElement;
    this.TEXTAREA.className = withLegacyClassNames('fs-editor-input');
    this.textareaStyle = this.TEXTAREA.style;
    this.textareaStyle.width = '0';
    this.textareaStyle.height = '0';

    empty(this.TEXTAREA_PARENT);
    this.TEXTAREA_PARENT.appendChild(this.TEXTAREA);
  }
}

export default EditorPassword;
