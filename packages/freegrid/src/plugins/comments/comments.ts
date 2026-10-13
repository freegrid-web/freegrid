import {
  addClass,
  closest,
  isChildOf,
  hasClass,
  offset,
  outerWidth,
  outerHeight,
  getScrollableElement
} from './../../helpers/dom/element';
import { deepClone, deepExtend, isObject } from './../../helpers/object';
import EventManager from './../../eventManager';
import { CellCoords } from './../../3rdparty/walkontable/src';
import { registerPlugin } from './../../plugins';
import BasePlugin from './../_base';
import type { PluginHost } from './../_base';
import type { MenuItem } from './../contextMenu/menuItem';
import CommentEditor from './commentEditor';
import { checkSelectionConsistency, markLabelAsSelected } from './../contextMenu/utils';
import DisplaySwitch from './displaySwitch';
import * as C from './../../i18n/constants';

import './comments.css';

/** A cell's comment (its `comment` cell meta). */
type CommentMeta = { value?: string; readOnly?: boolean; style?: { width?: number; height?: number } };

/** The cell the comment methods use (see `setRange`). */
type CommentRange = { from?: { row: number; col: number } };
const META_COMMENT = 'comment';
const META_COMMENT_VALUE = 'value';
const META_STYLE = 'style';
const META_READONLY = 'readOnly';

/**
 * @plugin Comments
 *
 * @description
 * This plugin allows setting and managing cell comments by either an option in the context menu or with the use of
 * the API.
 *
 * To enable the plugin, you'll need to set the comments property of the config object to `true`:
 * ```js
 * comments: true
 * ```
 *
 * or an object with extra predefined plugin config:
 *
 * ```js
 * comments: {
 *   displayDelay: 1000
 * }
 * ```
 *
 * To add comments at the table initialization, define the `comment` property in the `cell` config array as in an example below.
 *
 * @example
 *
 * ```js
 * const hot = new FreeGrid(document.getElementById('example'), {
 *   date: getData(),
 *   comments: true,
 *   cell: [
 *     {row: 1, col: 1, comment: {value: 'Foo'}},
 *     {row: 2, col: 2, comment: {value: 'Bar'}}
 *   ]
 * });
 *
 * // Access to the Comments plugin instance:
 * const commentsPlugin = hot.getPlugin('comments');
 *
 * // Manage comments programmatically:
 * commentsPlugin.setCommentAtCell(1, 6, 'Comment contents');
 * commentsPlugin.showAtCell(1, 6);
 * commentsPlugin.removeCommentAtCell(1, 6);
 *
 * // You can also set range once and use proper methods:
 * commentsPlugin.setRange({from: {row: 1, col: 6}});
 * commentsPlugin.setComment('Comment contents');
 * commentsPlugin.show();
 * commentsPlugin.removeComment();
 * ```
 */
class Comments extends BasePlugin {
  /**
   * Instance of {@link CommentEditor} (while the plugin is on).
   *
   * @private
   */
  editor: CommentEditor = null!;

  /**
   * Instance of {@link DisplaySwitch}.
   *
   * @private
   */
  displaySwitch: DisplaySwitch = null!;

  /**
   * Instance of {@link EventManager}.
   *
   * @private
   */
  eventManager: EventManager = null!;

  /**
   * Current cell range, an object with `from` property, with `row` and `col` properties (e.q. `{from: {row: 1, col: 6}}`).
   */
  range: CommentRange = {};

  /**
   * Whether the mouse button is down.
   *
   * @private
   */
  mouseDown = false;

  /**
   * Whether the last action came from the context menu (the next mousedown keeps the editor open).
   *
   * @private
   */
  contextMenuEvent = false;

  /**
   * @private
   */
  timer: ReturnType<typeof setTimeout> | null = null;

  /** The editor's size when the mouse went down on it (a different size on mouseup: the user resized it). */
  #tempEditorDimensions: { width?: number; height?: number } = {};

  /** The element under the mouse. */
  #cellBelowCursor: Element | null = null;

  /**
   * Checks if the plugin is enabled in the FreeGrid settings. This method is executed in {@link Hooks#beforeInit}
   * hook and if it returns `true` than the {@link Comments#enablePlugin} method is called.
   */
  isEnabled(): boolean {
    return !!this.hot.getSettings().comments;
  }

  /**
   * Enables the plugin functionality for this FreeGrid instance.
   */
  enablePlugin(): void {
    if (this.enabled) {
      return;
    }

    if (!this.editor) {
      this.editor = new CommentEditor();
    }

    if (!this.eventManager) {
      this.eventManager = new EventManager(this);
    }

    if (!this.displaySwitch) {
      this.displaySwitch = new DisplaySwitch(this.getDisplayDelaySetting());
    }

    this.addHook('afterContextMenuDefaultOptions', (options: { items: MenuItem[] }) => this.addToContextMenu(options));
    this.addHook('afterRenderer', (TD: HTMLTableCellElement, row: number, col: number, prop: unknown, value: unknown,
      cellProperties: Record<string, unknown>) => this.onAfterRenderer(TD, cellProperties));
    this.addHook('afterScrollHorizontally', () => this.hide());
    this.addHook('afterScrollVertically', () => this.hide());
    this.addHook('afterBeginEditing', () => this.onAfterBeginEditing());

    this.displaySwitch.addLocalHook('hide', () => this.hide());
    this.displaySwitch.addLocalHook('show', (row: number, col: number) => this.showAtCell(row, col));

    this.registerListeners();

    super.enablePlugin();
  }

  /**
   * Updates the plugin state. This method is executed when {@link Core#updateSettings} is invoked.
   */
  updatePlugin(): void {
    this.disablePlugin();
    this.enablePlugin();
    super.updatePlugin();

    this.displaySwitch.updateDelay(this.getDisplayDelaySetting());
  }

  /**
   * Disables the plugin functionality for this FreeGrid instance.
   */
  disablePlugin(): void {
    super.disablePlugin();
  }

  /**
   * Registers all necessary DOM listeners.
   *
   * @private
   */
  registerListeners(): void {
    this.eventManager.addEventListener(document, 'mouseover', (event: MouseEvent) => this.onMouseOver(event));
    this.eventManager.addEventListener(document, 'mousedown', (event: MouseEvent) => this.onMouseDown(event));
    this.eventManager.addEventListener(document, 'mouseup', () => this.onMouseUp());
    this.eventManager.addEventListener(this.editor.getInputElement(), 'blur', () => this.onEditorBlur());
    this.eventManager.addEventListener(this.editor.getInputElement(), 'mousedown', (event: MouseEvent) => this.onEditorMouseDown(event));
    this.eventManager.addEventListener(this.editor.getInputElement(), 'mouseup', (event: MouseEvent) => this.onEditorMouseUp(event));
  }

  /**
   * Sets the current cell range to be able to use general methods like {@link Comments#setComment}, {@link Comments#removeComment}, {@link Comments#show}.
   *
   * @param range Object with `from` property, each with `row` and `col` properties.
   */
  setRange(range: CommentRange): void {
    this.range = range;
  }

  /**
   * Clears the currently selected cell.
   */
  clearRange(): void {
    this.range = {};
  }

  /**
   * Checks if the event target is a cell containing a comment.
   *
   * @private
   * @param event DOM event
   */
  targetIsCellWithComment(event: Event): boolean {
    const closestCell = closest(event.target as HTMLElement, ['TD']) as HTMLTableCellElement | null;

    return !!(closestCell && hasClass(closestCell, 'fg-comment-cell') && closest(closestCell, [this.hot.rootElement]));
  }

  /**
   * Checks if the event target is a comment textarea.
   *
   * @private
   * @param event DOM event.
   */
  targetIsCommentTextArea(event: Event): boolean {
    return this.editor.getInputElement() === event.target;
  }

  /**
   * Sets a comment for a cell according to the previously set range (see {@link Comments#setRange}).
   *
   * @param [value] Comment contents (without it, the editor's text).
   */
  setComment(value?: string): void {
    if (!this.range.from) {
      throw new Error('Before using this method, first set cell range (hot.getPlugin("comment").setRange())');
    }
    const editorValue = this.editor.getValue();
    const comment = value ?? editorValue ?? '';
    const { row, col } = this.range.from;

    this.updateCommentMeta(row, col, { [META_COMMENT_VALUE]: comment });
    this.hot.render();
  }

  /**
   * Sets a comment for a specified cell.
   *
   * @param row Visual row index.
   * @param column Visual column index.
   * @param value Comment contents.
   */
  setCommentAtCell(row: number, column: number, value: string): void {
    this.setRange({
      from: new CellCoords(row, column)
    });
    this.setComment(value);
  }

  /**
   * Removes a comment from a cell according to previously set range (see {@link Comments#setRange}).
   *
   * @param [forceRender=true] If set to `true`, the table will be re-rendered at the end of the operation.
   */
  removeComment(forceRender = true): void {
    if (!this.range.from) {
      throw new Error('Before using this method, first set cell range (hot.getPlugin("comment").setRange())');
    }

    this.hot.setCellMeta(this.range.from.row, this.range.from.col, META_COMMENT, undefined);

    if (forceRender) {
      this.hot.render();
    }

    this.hide();
  }

  /**
   * Removes a comment from a specified cell.
   *
   * @param row Visual row index.
   * @param column Visual column index.
   * @param [forceRender=true] If `true`, the table will be re-rendered at the end of the operation.
   */
  removeCommentAtCell(row: number, column: number, forceRender = true): void {
    this.setRange({
      from: new CellCoords(row, column)
    });
    this.removeComment(forceRender);
  }

  /**
   * Gets comment from a cell according to previously set range (see {@link Comments#setRange}).
   *
   * @returns Returns a content of the comment.
   */
  getComment(): string | undefined {
    const { row, col } = this.range.from!;

    return this.getCommentMeta(row, col, META_COMMENT_VALUE) as string | undefined;
  }

  /**
   * Gets comment from a cell at the provided coordinates.
   *
   * @param row Visual row index.
   * @param column Visual column index.
   * @returns Returns a content of the comment.
   */
  getCommentAtCell(row: number, column: number): string | undefined {
    return this.getCommentMeta(row, column, META_COMMENT_VALUE) as string | undefined;
  }

  /**
   * Shows the comment editor accordingly to the previously set range (see {@link Comments#setRange}).
   *
   * @returns Returns `true` if comment editor was shown.
   */
  show(): boolean {
    if (!this.range.from) {
      throw new Error('Before using this method, first set cell range (hot.getPlugin("comment").setRange())');
    }
    const meta = this.hot.getCellMeta(this.range.from.row, this.range.from.col);

    this.refreshEditor(true);
    this.editor.setValue(meta[META_COMMENT]?.[META_COMMENT_VALUE]);

    // Every time: the editor may already be open for another cell or grid, and the theme may have changed.
    this.editor.setTheme(this.hot.rootElement);

    if (this.editor.hidden) {
      this.editor.show();
    }

    return true;
  }

  /**
   * Shows comment editor according to cell coordinates.
   *
   * @param row Visual row index.
   * @param column Visual column index.
   * @returns Returns `true` if comment editor was shown.
   */
  showAtCell(row: number, column: number): boolean {
    this.setRange({
      from: new CellCoords(row, column)
    });

    return this.show();
  }

  /**
   * Hides the comment editor.
   */
  hide(): void {
    if (!this.editor.hidden) {
      this.editor.hide();
    }
  }

  /**
   * Refreshes comment editor position and styling.
   *
   * @param [force=false] If `true` then recalculation will be forced.
   */
  refreshEditor(force = false): void {
    if (!force && (!this.range.from || !this.editor.isVisible())) {
      return;
    }
    const scrollableElement = getScrollableElement(this.hot.view.wt.wtTable.TABLE);
    const TD = this.hot.view.wt.wtTable.getCell(this.range.from);
    const { row, col: column } = this.range.from!;
    const cellOffset = offset(TD);
    const lastColWidth = this.hot.view.wt.wtTable.getStretchedColumnWidth(column);
    let cellTopOffset = cellOffset.top < 0 ? 0 : cellOffset.top;
    let cellLeftOffset = cellOffset.left;

    if (this.hot.view.wt.wtViewport.hasVerticalScroll() && (scrollableElement as unknown) !== window) {
      cellTopOffset -= this.hot.view.wt.wtOverlays.topOverlay.getScrollPosition();
    }

    if (this.hot.view.wt.wtViewport.hasHorizontalScroll() && (scrollableElement as unknown) !== window) {
      cellLeftOffset -= this.hot.view.wt.wtOverlays.leftOverlay.getScrollPosition();
    }

    const x = cellLeftOffset + lastColWidth;
    const y = cellTopOffset;

    const commentStyle = this.getCommentMeta(row, column, META_STYLE) as CommentMeta['style'];
    const readOnly = this.getCommentMeta(row, column, META_READONLY) as boolean;

    if (commentStyle) {
      this.editor.setSize(commentStyle.width, commentStyle.height);
    } else {
      this.editor.resetSize();
    }

    this.editor.setReadOnlyState(readOnly);

    this.editor.setPosition(x, y);
  }

  /**
   * Checks if there is a comment for selected range.
   *
   * @private
   */
  checkSelectionCommentsConsistency(): boolean {
    const selected = this.hot.getSelectedRangeLast();

    if (!selected) {
      return false;
    }
    // As in spreadsheets, only the selection's first cell counts.
    const cell = selected.from;

    return !!this.getCommentMeta(cell.row, cell.col, META_COMMENT_VALUE);
  }

  /**
   * Sets or update the comment-related cell meta.
   *
   * @param row Visual row index.
   * @param column Visual column index.
   * @param metaObject Object defining all the comment-related meta information.
   */
  updateCommentMeta(row: number, column: number, metaObject: CommentMeta): void {
    const oldComment: CommentMeta | undefined = this.hot.getCellMeta(row, column)[META_COMMENT];
    let newComment = metaObject;

    if (oldComment) {
      newComment = deepClone(oldComment);
      deepExtend(newComment, metaObject);
    }

    this.hot.setCellMeta(row, column, META_COMMENT, newComment);
  }

  /**
   * Gets the comment related meta information.
   *
   * @param row Visual row index.
   * @param column Visual column index.
   * @param property Cell meta property.
   * @returns The property of the cell's comment.
   */
  getCommentMeta(row: number, column: number, property: keyof CommentMeta): unknown {
    const comment: CommentMeta | undefined = this.hot.getCellMeta(row, column)[META_COMMENT];

    return comment ? comment[property] : undefined;
  }

  /**
   * `mousedown` event callback.
   *
   * @private
   * @param event The `mousedown` event.
   */
  onMouseDown(event: MouseEvent): void {
    this.mouseDown = true;

    if (!this.hot.view || !this.hot.view.wt) {
      return;
    }

    if (!this.contextMenuEvent && !this.targetIsCommentTextArea(event)) {
      const eventCell = closest(event.target as HTMLElement, ['TD']);
      const coordinates = eventCell ? this.hot.view.wt.wtTable.getCoords(eventCell) : null;

      if (!eventCell || ((this.range.from && coordinates) && (this.range.from.row !== coordinates.row || this.range.from.col !== coordinates.col))) {
        this.hide();
      }
    }
    this.contextMenuEvent = false;
  }

  /**
   * `mouseover` event callback.
   *
   * @private
   * @param event The `mouseover` event.
   */
  onMouseOver(event: MouseEvent): void {
    this.#cellBelowCursor = document.elementFromPoint(event.clientX, event.clientY);

    if (this.mouseDown || this.editor.isFocused() || hasClass(event.target as HTMLElement, 'fg-selection-border')
        || this.#cellBelowCursor !== event.target || !this.editor) {
      return;
    }

    if (this.targetIsCellWithComment(event)) {
      const coordinates = this.hot.view.wt.wtTable.getCoords(event.target);
      const range = {
        from: new CellCoords(coordinates.row, coordinates.col)
      };

      this.displaySwitch.show(range);

    } else if (isChildOf(event.target as HTMLElement, document) && !this.targetIsCommentTextArea(event)) {
      this.displaySwitch.hide();
    }
  }

  /**
   * `mouseup` event callback.
   *
   * @private
   */
  onMouseUp(): void {
    this.mouseDown = false;
  }

  /**
   * The `afterRenderer` hook callback: marks cells with a comment.
   *
   * @private
   * @param TD The rendered `TD` element.
   * @param cellProperties The rendered cell's property object.
   */
  onAfterRenderer(TD: HTMLTableCellElement, cellProperties: Record<string, unknown>): void {
    if ((cellProperties[META_COMMENT] as CommentMeta | undefined)?.[META_COMMENT_VALUE]) {
      addClass(TD, cellProperties.commentedCellClassName as string);
    }
  }

  /**
   * `blur` event callback for the comment editor.
   *
   * @private
   */
  onEditorBlur(): void {
    this.setComment();
  }

  /**
   * `mousedown` hook. Along with `onEditorMouseUp` used to simulate the textarea resizing event.
   *
   * @private
   * @param event The `mousedown` event.
   */
  onEditorMouseDown(event: MouseEvent): void {
    this.#tempEditorDimensions = {
      width: outerWidth(event.target as HTMLElement),
      height: outerHeight(event.target as HTMLElement),
    };
  }

  /**
   * `mouseup` hook. Along with `onEditorMouseDown` used to simulate the textarea resizing event.
   *
   * @private
   * @param event The `mouseup` event.
   */
  onEditorMouseUp(event: MouseEvent): void {
    const currentWidth = outerWidth(event.target as HTMLElement);
    const currentHeight = outerHeight(event.target as HTMLElement);
    const { width = NaN, height = NaN } = this.#tempEditorDimensions;

    if (currentWidth !== width + 1 || currentHeight !== height + 2) {
      this.updateCommentMeta(this.range.from!.row, this.range.from!.col, {
        [META_STYLE]: {
          width: currentWidth,
          height: currentHeight
        }
      });
    }
  }

  /**
   * Context Menu's "Add comment" callback. Results in showing the comment editor.
   *
   * @private
   */
  onContextMenuAddComment(): void {
    this.displaySwitch.cancelHiding();
    const coords = this.hot.getSelectedRangeLast();

    this.contextMenuEvent = true;
    this.setRange({
      from: coords.from
    });
    this.show();
    setTimeout(() => {
      if (this.hot) {
        this.hot.deselectCell();
        this.editor.focus();
      }
    }, 10);
  }

  /**
   * Context Menu's "remove comment" callback.
   *
   * @private
   */
  onContextMenuRemoveComment(): void {
    const { from, to } = this.hot.getSelectedRangeLast();

    this.contextMenuEvent = true;

    for (let i = from.row; i <= to.row; i += 1) {
      for (let j = from.col; j <= to.col; j += 1) {
        this.removeCommentAtCell(i, j, false);
      }
    }

    this.hot.render();
  }

  /**
   * Context Menu's "make comment read-only" callback.
   *
   * @private
   */
  onContextMenuMakeReadOnly(): void {
    const { from, to } = this.hot.getSelectedRangeLast();

    this.contextMenuEvent = true;

    for (let i = from.row; i <= to.row; i += 1) {
      for (let j = from.col; j <= to.col; j += 1) {
        const currentState = !!this.getCommentMeta(i, j, META_READONLY);

        this.updateCommentMeta(i, j, { [META_READONLY]: !currentState });
      }
    }
  }

  /**
   * Add Comments plugin options to the Context Menu.
   *
   * @private
   * @param defaultOptions The context menu's items.
   */
  addToContextMenu(defaultOptions: { items: MenuItem[] }): void {
    defaultOptions.items.push(
      {
        name: '---------',
      },
      {
        key: 'commentsAddEdit',
        name: () => {
          if (this.checkSelectionCommentsConsistency()) {
            return this.hot.getTranslatedPhrase(C.CONTEXTMENU_ITEMS_EDIT_COMMENT);
          }

          return this.hot.getTranslatedPhrase(C.CONTEXTMENU_ITEMS_ADD_COMMENT);
        },
        callback: () => this.onContextMenuAddComment(),
        disabled(this: PluginHost) {
          return !(this.getSelectedLast() && !this.selection.isSelectedByCorner());
        }
      },
      {
        key: 'commentsRemove',
        name(this: PluginHost) {
          return this.getTranslatedPhrase(C.CONTEXTMENU_ITEMS_REMOVE_COMMENT);
        },
        callback: () => this.onContextMenuRemoveComment(),
        disabled: () => this.hot.selection.isSelectedByCorner()
      },
      {
        key: 'commentsReadOnly',
        name(this: PluginHost) {
          const label = this.getTranslatedPhrase(C.CONTEXTMENU_ITEMS_READ_ONLY_COMMENT);
          const hasProperty = checkSelectionConsistency(this.getSelectedRangeLast(), (row: number, col: number) => (
            (this.getCellMeta(row, col)[META_COMMENT] as CommentMeta | undefined)?.[META_READONLY] ? true : undefined));

          return hasProperty ? markLabelAsSelected(label) : label;
        },
        callback: () => this.onContextMenuMakeReadOnly(),
        disabled: () => this.hot.selection.isSelectedByCorner() || !this.checkSelectionCommentsConsistency()
      }
    );
  }

  /**
   * Get `displayDelay` setting of comment plugin.
   *
   * @private
   */
  getDisplayDelaySetting(): number | undefined {
    const commentSetting = this.hot.getSettings().comments;

    return isObject(commentSetting) ? (commentSetting as { displayDelay?: number }).displayDelay : undefined;
  }

  /**
   * `afterBeginEditing` hook callback.
   *
   * @private
   */
  onAfterBeginEditing(): void {
    this.hide();
  }

  /**
   * Destroys the plugin instance.
   */
  destroy(): void {
    this.editor?.destroy();
    this.displaySwitch?.destroy();

    super.destroy();
  }
}

registerPlugin('comments', Comments);

export default Comments;
