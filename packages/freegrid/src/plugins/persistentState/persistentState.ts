import BasePlugin from './../_base';
import { registerPlugin } from './../../plugins';
import Storage from './storage';
import Hooks from './../../pluginHooks';

Hooks.getSingleton().register('persistentStateSave');
Hooks.getSingleton().register('persistentStateLoad');
Hooks.getSingleton().register('persistentStateReset');

/**
 * @plugin PersistentState
 *
 * @description
 * Save the state of column sorting, column positions and column sizes in local storage to preserve table state
 * between page reloads.
 *
 * In order to enable data storage mechanism, {@link Options#persistentState} option must be set to `true`.
 *
 * When persistentState is enabled it exposes 3 hooks:
 * - {@link Hooks#persistentStateSave} - Saves value under given key in browser local storage.
 * - {@link Hooks#persistentStateLoad} - Loads value, saved under given key, from browser local storage. The loaded
 * value will be saved in `saveTo.value`.
 * - {@link Hooks#persistentStateReset} - Clears the value saved under key. If no key is given, all values associated
 * with table will be cleared.
 */
class PersistentState extends BasePlugin {
  /**
   * Instance of {@link Storage}.
   *
   * @private
   */
  storage: Storage | undefined = undefined;

  /**
   * Checks if the plugin is enabled in the FreeGrid settings. This method is executed in {@link Hooks#beforeInit}
   * hook and if it returns `true` than the {@link PersistentState#enablePlugin} method is called.
   */
  isEnabled(): boolean {
    return !!this.hot.getSettings().persistentState;
  }

  /**
   * Enables the plugin functionality for this FreeGrid instance.
   */
  enablePlugin(): void {
    if (this.enabled) {
      return;
    }

    if (!this.storage) {
      this.storage = new Storage(this.hot.rootElement.id);
    }

    this.addHook('persistentStateSave', (key: string, value: unknown) => this.saveValue(key, value));
    this.addHook('persistentStateLoad', (key: string, saveTo: { value?: unknown }) => this.loadValue(key, saveTo));
    this.addHook('persistentStateReset', (key?: string) => this.resetValue(key));

    super.enablePlugin();
  }

  /**
   * Disables the plugin functionality for this FreeGrid instance.
   */
  disablePlugin(): void {
    this.storage = undefined;

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
   * Loads the value from local storage.
   *
   * @param key Storage key.
   * @param saveTo Gets the loaded value in its `value` property.
   */
  loadValue(key: string, saveTo: { value?: unknown }): void {
    saveTo.value = this.storage!.loadValue(key);
  }

  /**
   * Saves the data to local storage.
   *
   * @param key Storage key.
   * @param value Value to save.
   */
  saveValue(key: string, value: unknown): void {
    this.storage!.saveValue(key, value);
  }

  /**
   * Resets the data or all data from local storage.
   *
   * @param [key] Storage key. Without it, every value of the grid is removed.
   */
  resetValue(key?: string): void {
    if (key === undefined) {
      this.storage!.resetAll();
    } else {
      this.storage!.reset(key);
    }
  }

  /**
   * Destroys the plugin instance.
   */
  destroy(): void {
    super.destroy();
  }
}

registerPlugin('persistentState', PersistentState);

export default PersistentState;
