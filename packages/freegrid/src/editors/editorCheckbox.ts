import EditorBase from './editorBase';
import { hasClass } from './../helpers/dom/element';

/**
 * @private
 * @editor EditorCheckbox
 * @class EditorCheckbox
 */
class EditorCheckbox extends EditorBase {
  beginEditing(initialValue?: string, event?: Event | null): void {
    // Just some events connected with checkbox editor are delegated here. Some `keydown` events like `enter` and `space` key press
    // are handled inside `rendererCheckbox`. Some events come here from `editorManager`. Below `if` statement was created by author
    // for purpose of handling only `doubleclick` event which may be done on a cell with checkbox.

    if (event && event.type === 'mouseup') {
      const checkbox = this.TD.querySelector<HTMLInputElement>('input[type="checkbox"]');

      if (checkbox && !hasClass(checkbox, 'fg-bad-value')) {
        checkbox.click();
      }
    }
  }

  finishEditing(): void {}

  init(): void {}

  open(): void {}

  close(): void {}

  getValue(): unknown {
    return undefined;
  }

  setValue(): void {}

  focus(): void {}
}

export default EditorCheckbox;
