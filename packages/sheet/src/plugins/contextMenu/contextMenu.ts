import BasePlugin from './../_base';
import type { PluginHost } from './../_base';
import Hooks from './../../pluginHooks';
import CommandExecutor from './commandExecutor';
import EventManager from './../../eventManager';
import ItemsFactory from './itemsFactory';
import Menu from './menu';
import { registerPlugin } from './../../plugins';
import { stopPropagation, pageX, pageY } from './../../helpers/dom/event';
import { getWindowScrollLeft, getWindowScrollTop, hasClass } from './../../helpers/dom/element';
import {
  ROW_ABOVE,
  ROW_BELOW,
  COLUMN_LEFT,
  COLUMN_RIGHT,
  REMOVE_ROW,
  REMOVE_COLUMN,
  UNDO,
  REDO,
  READ_ONLY,
  ALIGNMENT,
  SEPARATOR
} from './predefinedItems';

import type { ItemsPattern } from './itemsFactory';
import { previewCellStyle } from './../../formatting/formatting';

import './contextMenu.css';

/** The `contextMenu` setting: `true`, item keys, or `{ items, callback }`. */
type ContextMenuSettings = ItemsPattern & { callback?: (...params: unknown[]) => void };

/** Where to open the menu: page or viewport coordinates (a mouse event works too). */
type MenuPosition = { pageX?: number; pageY?: number; clientX?: number; clientY?: number };

Hooks.getSingleton().register('afterContextMenuDefaultOptions');
Hooks.getSingleton().register('beforeContextMenuShow');
Hooks.getSingleton().register('afterContextMenuShow');
Hooks.getSingleton().register('afterContextMenuHide');
Hooks.getSingleton().register('afterContextMenuExecute');

/**
 * @description
 * This plugin creates the FreeSheet Context Menu. It allows to create a new row or column at any place in the
 * grid among [other features](https://github.com/freegrid-web/sheet).
 * Possible values:
 * * `true` (to enable default options),
 * * `false` (to disable completely)
 *
 * or array of any available strings:
 * * `'row_above'`
 * * `'row_below'`
 * * `'col_left'`
 * * `'col_right'`
 * * `'remove_row'`
 * * `'remove_col'`
 * * `'undo'`
 * * `'redo'`
 * * `'make_read_only'`
 * * `'alignment'`
 * * `'formatting'` (bold, italic, underline, strikethrough, text and fill colors, clear formatting; not in the default
 *   menu)
 * * `'---------'` (menu item separator)
 * * `'borders'` (with {@link Options#customBorders} turned on)
 * * `'commentsAddEdit'` (with {@link Options#comments} turned on)
 * * `'commentsRemove'` (with {@link Options#comments} turned on)
 *
 * See [the context menu demo](https://github.com/freegrid-web/sheet) for examples.
 *
 * @example
 * ```js
 * // as a boolean
 * contextMenu: true
 * // as a array
 * contextMenu: ['row_above', 'row_below', '---------', 'undo', 'redo']
 * ```
 *
 * @plugin ContextMenu
 */
class ContextMenu extends BasePlugin {
  /**
   * Context menu default items order when `contextMenu` options is set as `true`.
   *
   */
  static get DEFAULT_ITEMS(): string[] {
    return [
      ROW_ABOVE, ROW_BELOW,
      SEPARATOR,
      COLUMN_LEFT, COLUMN_RIGHT,
      SEPARATOR,
      REMOVE_ROW, REMOVE_COLUMN,
      SEPARATOR,
      UNDO, REDO,
      SEPARATOR,
      READ_ONLY,
      SEPARATOR,
      ALIGNMENT,
    ];
  }

  /** A separator item, for `contextMenu.items`. */
  static SEPARATOR = { name: SEPARATOR };

  /**
   * Instance of {@link EventManager}.
   *
   * @private
   */
  eventManager: EventManager;

  /**
   * Instance of {@link CommandExecutor}.
   *
   * @private
   */
  commandExecutor: CommandExecutor;

  /**
   * Instance of {@link ItemsFactory}.
   *
   * @private
   */
  itemsFactory: ItemsFactory | null = null;

  /**
   * Instance of {@link Menu}.
   *
   * @private
   */
  menu: Menu | null = null;

  constructor(hotInstance: PluginHost) {
    super(hotInstance);
    this.eventManager = new EventManager(this);
    this.commandExecutor = new CommandExecutor(this.hot);
  }

  /**
   * Checks if the plugin is enabled in the FreeSheet settings. This method is executed in {@link Hooks#beforeInit}
   * hook and if it returns `true` than the {@link ContextMenu#enablePlugin} method is called.
   *
   */
  isEnabled(): boolean {
    return !!this.hot.getSettings().contextMenu;
  }

  /**
   * Enables the plugin functionality for this FreeSheet instance.
   */
  enablePlugin(): void {
    if (this.enabled) {
      return;
    }
    const itemsFactory = new ItemsFactory(this.hot, ContextMenu.DEFAULT_ITEMS);
    const settings: ContextMenuSettings = this.hot.getSettings().contextMenu;
    const predefinedItems = {
      items: itemsFactory.getItems(settings),
    };

    this.itemsFactory = itemsFactory;

    if (typeof settings?.callback === 'function') {
      this.commandExecutor.setCommonCallback(settings.callback);
    }
    super.enablePlugin();

    const delayedInitialization = () => {
      if (!this.hot) {
        return;
      }

      this.hot.runHooks('afterContextMenuDefaultOptions', predefinedItems);

      this.itemsFactory!.setPredefinedItems(predefinedItems.items);
      const menuItems = this.itemsFactory!.getItems(settings);
      const menu = new Menu(this.hot, {
        className: 'fs-context-menu',
        keepInViewport: true,
      });

      this.menu = menu;
      this.hot.runHooks('beforeContextMenuSetItems', menuItems);

      menu.setMenuItems(menuItems);

      menu.addLocalHook('beforeOpen', () => this.onMenuBeforeOpen());
      menu.addLocalHook('afterOpen', () => this.onMenuAfterOpen());
      menu.addLocalHook('afterClose', () => this.onMenuAfterClose());
      menu.addLocalHook('executeCommand', (commandName: string, ...params: unknown[]) => this.executeCommand(commandName, ...params));

      this.addHook('afterOnCellContextMenu', (event: MouseEvent & { realTarget: HTMLElement }) => this.onAfterOnCellContextMenu(event));

      // Register all commands. Predefined and added by user or by plugins
      menuItems.forEach(command => this.commandExecutor.registerCommand(command.key!, command));
    };

    this.callOnPluginsReady(() => {
      if (this.isPluginsReady) {
        setTimeout(delayedInitialization, 0);
      } else {
        delayedInitialization();
      }
    });
  }

  /**
   * Updates the plugin state. This method is executed when {@link Core#updateSettings} is invoked.
   */
  updatePlugin(): void {
    this.disablePlugin();
    this.enablePlugin();

    super.updatePlugin();
  }

  /**
   * Disables the plugin functionality for this FreeSheet instance.
   */
  disablePlugin(): void {
    this.close();

    if (this.menu) {
      this.menu.destroy();
      this.menu = null;
    }
    super.disablePlugin();
  }

  /**
   * Opens menu and re-position it based on the passed coordinates.
   *
   * @param position An object with `pageX` and `pageY` properties which contains values relative to
   *                                the top left of the fully rendered content area in the browser or with `clientX`
   *                                and `clientY`  properties which contains values relative to the upper left edge
   *                                of the content area (the viewport) of the browser window. This object is structurally
   *                                compatible with native mouse event so it can be used either.
   */
  open(position: MenuPosition): void {
    if (!this.menu) {
      return;
    }
    this.menu.open();

    if (!this.menu.isOpened()) {
      return;
    }
    this.menu.setPosition({
      top: parseInt(String(pageY(position as MouseEvent)), 10) - getWindowScrollTop(),
      left: parseInt(String(pageX(position as MouseEvent)), 10) - getWindowScrollLeft(),
    });

    // ContextMenu is not detected HotTableEnv correctly because is injected outside hot-table
    this.menu.hotMenu!.isHotTableEnv = this.hot.isHotTableEnv;
    // FreeSheet.eventManager.isHotTableEnv = this.hot.isHotTableEnv;
  }

  /**
   * Closes the menu.
   */
  close(): void {
    if (!this.menu) {
      return;
    }
    this.menu.close();
  }

  /**
   * Execute context menu command.
   *
   * You can execute all predefined commands:
   *  * `'row_above'` - Insert row above
   *  * `'row_below'` - Insert row below
   *  * `'col_left'` - Insert column left
   *  * `'col_right'` - Insert column right
   *  * `'clear_column'` - Clear selected column
   *  * `'remove_row'` - Remove row
   *  * `'remove_col'` - Remove column
   *  * `'undo'` - Undo last action
   *  * `'redo'` - Redo last action
   *  * `'make_read_only'` - Make cell read only
   *  * `'alignment:left'` - Alignment to the left
   *  * `'alignment:top'` - Alignment to the top
   *  * `'alignment:right'` - Alignment to the right
   *  * `'alignment:bottom'` - Alignment to the bottom
   *  * `'alignment:middle'` - Alignment to the middle
   *  * `'alignment:center'` - Alignment to the center (justify)
   *  * `'formatting:bold'`, `'formatting:italic'`, `'formatting:underline'`, `'formatting:strikethrough'` - Toggle
   *  * `'formatting:text_color:text_color_<n>'`, `'formatting:fill_color:fill_color_<n>'` - A color (`_none` removes it)
   *  * `'formatting:clear'` - Clear formatting
   *
   * Or you can execute command registered in settings where `key` is your command name.
   *
   * @param commandName The command name to be executed.
   * @param params Arguments of the command.
   */
  executeCommand(commandName: string, ...params: unknown[]): void {
    this.commandExecutor.execute(commandName, ...params);
  }

  /**
   * On contextmenu listener.
   *
   * @private
   * @param event The `contextmenu` event.
   */
  onAfterOnCellContextMenu(event: MouseEvent & { realTarget: HTMLElement }): void {
    const settings = this.hot.getSettings();
    const showRowHeaders = settings.rowHeaders;
    const showColHeaders = settings.colHeaders;
    const isValidElement = (element: HTMLElement) => element.nodeName === 'TD' || element.parentNode!.nodeName === 'TD';
    // if event is from hot-table we must get web component element not element inside him
    const element = event.realTarget;
    this.close();

    if (hasClass(element, 'fs-editor-input')) {
      return;
    }

    event.preventDefault();
    stopPropagation(event);

    if (!(showRowHeaders || showColHeaders)) {
      if (!isValidElement(element) && !(hasClass(element, 'current') && hasClass(element, 'fs-selection-border'))) {
        return;
      }
    }

    this.open(event);
  }

  /**
   * On menu before open listener.
   *
   * @private
   */
  onMenuBeforeOpen(): void {
    this.hot.runHooks('beforeContextMenuShow', this);
  }

  /**
   * On menu after open listener.
   *
   * @private
   */
  onMenuAfterOpen(): void {
    this.hot.runHooks('afterContextMenuShow', this);
  }

  /**
   * On menu after close listener.
   *
   * @private
   */
  onMenuAfterClose(): void {
    // A palette may be showing a color on the cells.
    previewCellStyle(this.hot as unknown as Parameters<typeof previewCellStyle>[0], void 0);
    this.hot.listen();
    this.hot.runHooks('afterContextMenuHide', this);
  }

  /**
   * Destroys the plugin instance.
   */
  destroy(): void {
    this.close();
    this.menu?.destroy();
    super.destroy();
  }
}

registerPlugin('contextMenu', ContextMenu);

export default ContextMenu;
