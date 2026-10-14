import BasePlugin from './../_base';
import { registerPlugin } from './../../plugins';
import freezeColumnItem from './contextMenuItem/freezeColumn';
import unfreezeColumnItem from './contextMenuItem/unfreezeColumn';
import type { MenuItem } from './../contextMenu/menuItem';

import './manualColumnFreeze.css';
import type ManualColumnMove from './../manualColumnMove/manualColumnMove';


/**
 * This plugin allows to manually "freeze" and "unfreeze" a column using an entry in the Context Menu or using API.
 * You can turn it on by setting a {@link Options#manualColumnFreeze} property to `true`.
 *
 * @example
 * ```js
 * // Enables the plugin
 * manualColumnFreeze: true,
 * ```
 *
 * @plugin ManualColumnFreeze
 * @dependencies ManualColumnMove
 */
class ManualColumnFreeze extends BasePlugin {
  /**
   * Original column positions
   *
   * @private
   */
  frozenColumnsBasePositions: (number | undefined)[] = [];

  /**
   * Reference to the `ManualColumnMove` plugin.
   *
   * @private
   */
  manualColumnMovePlugin: ManualColumnMove | undefined = undefined;

  /** Whether the next column move is made by freezing or unfreezing (it may cross the frozen area). */
  #moveByFreeze = false;

  /** Whether a column was frozen or unfrozen (from then on, other moves may not cross the frozen area). */
  #afterFirstUse = false;

  /**
   * Checks if the plugin is enabled in the FreeSheet settings. This method is executed in {@link Hooks#beforeInit}
   * hook and if it returns `true` than the {@link ManualColumnFreeze#enablePlugin} method is called.
   */
  isEnabled(): boolean {
    return !!this.hot.getSettings().manualColumnFreeze;
  }

  /**
   * Enables the plugin functionality for this FreeSheet instance.
   */
  enablePlugin(): void {
    if (this.enabled) {
      return;
    }

    this.addHook('afterContextMenuDefaultOptions', (options: { items: MenuItem[] }) => this.addContextMenuEntry(options));
    this.addHook('afterInit', () => this.onAfterInit());
    this.addHook('beforeColumnMove', (columns: number[], target: number) => this.onBeforeColumnMove(columns, target));

    super.enablePlugin();
  }

  /**
   * Disables the plugin functionality for this FreeSheet instance.
   */
  disablePlugin(): void {
    this.#afterFirstUse = false;
    this.#moveByFreeze = false;

    super.disablePlugin();
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
   * Freezes the given column (add it to fixed columns).
   *
   * @param column Visual column index.
   */
  freezeColumn(column: number): void {
    const settings = this.hot.getSettings();

    this.#afterFirstUse = true;

    if (settings.fixedColumnsLeft === this.hot.countCols() || column <= settings.fixedColumnsLeft - 1) {
      return; // already fixed
    }

    this.#moveByFreeze = true;

    if (column !== this.getMovePlugin().columnsMapper.getValueByIndex(column)) {
      this.frozenColumnsBasePositions[settings.fixedColumnsLeft] = column;
    }

    this.getMovePlugin().moveColumn(column, settings.fixedColumnsLeft);

    settings.fixedColumnsLeft += 1;
  }

  /**
   * Unfreezes the given column (remove it from fixed columns and bring to it's previous position).
   *
   * @param column Visual column index.
   */
  unfreezeColumn(column: number): void {
    const settings = this.hot.getSettings();

    this.#afterFirstUse = true;

    if (settings.fixedColumnsLeft <= 0 || (column > settings.fixedColumnsLeft - 1)) {
      return; // not fixed
    }

    const returnCol = this.getBestColumnReturnPosition(column);

    this.#moveByFreeze = true;
    settings.fixedColumnsLeft -= 1;

    this.getMovePlugin().moveColumn(column, returnCol + 1);
  }

  /**
   * Gets the reference to the ManualColumnMove plugin.
   *
   * @private
   */
  getMovePlugin(): ManualColumnMove {
    if (!this.manualColumnMovePlugin) {
      this.manualColumnMovePlugin = this.hot.getPlugin('manualColumnMove');
    }

    return this.manualColumnMovePlugin;
  }

  /**
   * Estimates the most fitting return position for unfrozen column.
   *
   * @private
   * @param column Visual column index.
   */
  getBestColumnReturnPosition(column: number): number {
    const { columnsMapper } = this.getMovePlugin();
    const basePosition = this.frozenColumnsBasePositions[column];
    const initialCol: number = basePosition ?? columnsMapper.getValueByIndex(column)!;
    let i: number = this.hot.getSettings().fixedColumnsLeft;
    let j: number | null = columnsMapper.getValueByIndex(i);

    while (j !== null && j <= initialCol) {
      i += 1;
      j = columnsMapper.getValueByIndex(i);
    }
    if (basePosition !== null && basePosition !== undefined) {
      this.frozenColumnsBasePositions[column] = undefined;
      i = j as number;
    }

    return i - 1;
  }

  /**
   * Adds the manualColumnFreeze context menu entries.
   *
   * @private
   * @param options Context menu options.
   */
  addContextMenuEntry(options: { items: MenuItem[] }): void {
    options.items.push(
      { name: '---------' },
      freezeColumnItem(this),
      unfreezeColumnItem(this)
    );
  }

  /**
   * Enables `manualColumnMove` plugin on `afterInit` hook.
   *
   * @private
   */
  onAfterInit(): void {
    if (!this.getMovePlugin().isEnabled()) {
      this.getMovePlugin().enablePlugin();
    }
  }

  /**
   * Prevents moving the columns from/to fixed area.
   *
   * @private
   * @param columns The columns to move.
   * @param target Where they move to.
   * @returns `false` cancels the move.
   */
  onBeforeColumnMove(columns: number[], target: number): false | void {
    if (this.#afterFirstUse && !this.#moveByFreeze) {
      const frozenLen: number = this.hot.getSettings().fixedColumnsLeft;

      if (target < frozenLen || columns.some(column => column < frozenLen)) {
        return false;
      }
    }

    this.#moveByFreeze = false;
  }

  /**
   * Destroys the plugin instance.
   */
  destroy(): void {
    super.destroy();
  }
}

registerPlugin('manualColumnFreeze', ManualColumnFreeze);

export default ManualColumnFreeze;
