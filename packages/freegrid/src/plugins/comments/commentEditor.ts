import { applyTheme } from './../../helpers/dom/theme';
import { addClass } from './../../helpers/dom/element';

/**
 * Comment editor for the Comments plugin.
 *
 * @class CommentEditor
 * @plugin Comments
 */
class CommentEditor {
  static get CLASS_EDITOR_CONTAINER(): string {
    return 'fg-comments-container';
  }

  static get CLASS_EDITOR(): string {
    return 'fg-comments';
  }

  static get CLASS_INPUT(): string {
    return 'fg-comment-text-area';
  }

  static get CLASS_CELL(): string {
    return 'fg-comment-cell';
  }

  /** The editor's element (in a container in `<body>`, shared by the grids). */
  editor: HTMLDivElement;

  editorStyle: CSSStyleDeclaration;

  hidden = true;

  constructor() {
    this.editor = this.createEditor();
    this.editorStyle = this.editor.style;

    this.hide();
  }

  /**
   * Set position of the comments editor according to the  provided x and y coordinates.
   *
   * @param x X position (in pixels).
   * @param y Y position (in pixels).
   */
  setPosition(x: number, y: number): void {
    this.editorStyle.left = `${x}px`;
    this.editorStyle.top = `${y}px`;
  }

  /**
   * Set the editor size according to the provided arguments.
   *
   * @param [width] Width in pixels.
   * @param [height] Height in pixels.
   */
  setSize(width?: number, height?: number): void {
    if (width && height) {
      const input = this.getInputElement();

      input.style.width = `${width}px`;
      input.style.height = `${height}px`;
    }
  }

  /**
   * Reset the editor size to its initial state.
   */
  resetSize(): void {
    const input = this.getInputElement();

    input.style.width = '';
    input.style.height = '';
  }

  /**
   * Set the read-only state for the comments editor.
   *
   * @param state The new read only state.
   */
  setReadOnlyState(state: boolean): void {
    const input = this.getInputElement();

    input.readOnly = state;
  }

  /**
   * Gives the editor the theme of a grid. The editor container is in <body>, outside the grid, and is shared by all
   * grids on the page.
   *
   * @param themeSource The grid's root element.
   */
  setTheme(themeSource: Element): void {
    applyTheme(this.editor.parentNode as HTMLElement, themeSource);
  }

  /**
   * Show the comments editor.
   */
  show(): void {
    this.editorStyle.display = 'block';
    this.hidden = false;
  }

  /**
   * Hide the comments editor.
   */
  hide(): void {
    this.editorStyle.display = 'none';
    this.hidden = true;
  }

  /**
   * Checks if the editor is visible.
   */
  isVisible(): boolean {
    return this.editorStyle.display === 'block';
  }

  /**
   * Set the comment value.
   *
   * @param [value] The value to use.
   */
  setValue(value: string | null = ''): void {
    this.getInputElement().value = value || '';
  }

  /**
   * Get the comment value.
   */
  getValue(): string {
    return this.getInputElement().value;
  }

  /**
   * Checks if the comment input element is focused.
   */
  isFocused(): boolean {
    return document.activeElement === this.getInputElement();
  }

  /**
   * Focus the comments input element.
   */
  focus(): void {
    this.getInputElement().focus();
  }

  /**
   * Create the `textarea` to be used as a comments editor.
   */
  createEditor(): HTMLDivElement {
    const editor = document.createElement('div');
    const textArea = document.createElement('textarea');
    let container = document.querySelector(`.${CommentEditor.CLASS_EDITOR_CONTAINER}`);

    if (!container) {
      container = document.createElement('div');
      addClass(container, CommentEditor.CLASS_EDITOR_CONTAINER);
      document.body.appendChild(container);
    }

    addClass(editor, CommentEditor.CLASS_EDITOR);
    addClass(textArea, CommentEditor.CLASS_INPUT);

    editor.appendChild(textArea);
    container.appendChild(editor);

    return editor;
  }

  /**
   * Get the input element.
   */
  getInputElement(): HTMLTextAreaElement {
    return this.editor.querySelector(`.${CommentEditor.CLASS_INPUT}`) as HTMLTextAreaElement;
  }

  /**
   * Destroy the comments editor.
   */
  destroy(): void {
    this.editor.remove();
    this.editor = null!;
    this.editorStyle = null!;
  }
}

export default CommentEditor;
