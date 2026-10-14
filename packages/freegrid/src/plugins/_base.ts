import { defineGetter, objectEach } from './../helpers/object';
import { getTranslator } from './../utils/recordTranslator';
import { getRegistredPluginNames, getPluginName } from './../plugins';
import type EventManager from './../eventManager';
import type Core from './../core';

/** The grid, as plugins use it. */
export type PluginHost = Core;

type HookCallback = (...args: never[]) => unknown;

/** The plugins of the grid being initialized that have not run `init()` yet (shared by all plugins). */
let initializedPlugins: string[] | null = null;

/**
 * @util
 *
 * The base of every plugin. A plugin is created with the grid; when the grid initializes, `init()` enables it if
 * `isEnabled()` says so. `updateSettings` enables, disables or updates it. Hooks added with `addHook()` are removed
 * when the plugin is disabled.
 */
class BasePlugin {
  /** The grid. */
  declare readonly hot: PluginHost;

  /** Translates between visual and physical indexes. */
  declare readonly t: ReturnType<typeof getTranslator>;

  /** Set by subclasses that listen to DOM events; cleared when the plugin is disabled. */
  declare eventManager?: EventManager;

  /** Whether the grid's settings enable the plugin (subclasses that can be switched on and off define it). */
  isEnabled?(): boolean;

  pluginName: string | null = null;

  pluginsInitializedCallbacks: (() => void)[] = [];

  isPluginsReady = false;

  enabled = false;

  initialized = false;

  /** The callbacks added with `addHook()`, by hook name. */
  #hooks: Record<string, HookCallback[]> = {};

  constructor(hotInstance: PluginHost) {
    defineGetter(this, 'hot', hotInstance, { writable: false });
    defineGetter(this, 't', getTranslator(hotInstance), { writable: false });

    initializedPlugins = null;

    this.hot.addHook('afterPluginsInitialized', () => this.onAfterPluginsInitialized());
    this.hot.addHook('afterUpdateSettings', (newSettings: unknown) => this.onUpdateSettings(newSettings));
    this.hot.addHook('beforeInit', () => this.init());
  }

  /** Enables the plugin if the settings say so; the last plugin to initialize runs `afterPluginsInitialized`. */
  init(): void {
    this.pluginName = getPluginName(this.hot, this);

    if (this.isEnabled?.()) {
      this.enablePlugin();
    }
    if (!initializedPlugins) {
      initializedPlugins = getRegistredPluginNames(this.hot);
    }
    const index = initializedPlugins.indexOf(this.pluginName as string);

    if (index >= 0) {
      initializedPlugins.splice(index, 1);
    }
    if (!initializedPlugins.length) {
      this.hot.runHooks('afterPluginsInitialized');
    }
    this.initialized = true;
  }

  /**
   * Enable plugin for this FreeSheet instance.
   */
  enablePlugin(): void {
    this.enabled = true;
  }

  /**
   * Disable plugin for this FreeSheet instance.
   */
  disablePlugin(): void {
    this.eventManager?.clear();
    this.clearHooks();
    this.enabled = false;
  }

  /**
   * Add listener to plugin hooks system.
   *
   * @param name The hook's name.
   * @param callback The listener.
   */
  addHook(name: string, callback: HookCallback): void {
    this.#hooks[name] ??= [];
    this.hot.addHook(name, callback);
    this.#hooks[name].push(callback);
  }

  /**
   * Remove all hooks listeners by hook name.
   *
   * @param name The hook's name.
   */
  removeHooks(name: string): void {
    (this.#hooks[name] || []).forEach((callback) => {
      this.hot.removeHook(name, callback);
    });
  }

  /**
   * Clear all hooks.
   */
  clearHooks(): void {
    Object.keys(this.#hooks).forEach(name => this.removeHooks(name));
    this.#hooks = {};
  }

  /**
   * Register function which will be immediately called after all plugins initialized.
   *
   * @param callback Called once every plugin has initialized.
   */
  callOnPluginsReady(callback: () => void): void {
    if (this.isPluginsReady) {
      callback();
    } else {
      this.pluginsInitializedCallbacks.push(callback);
    }
  }

  /**
   * On after plugins initialized listener.
   *
   * @private
   */
  onAfterPluginsInitialized(): void {
    this.pluginsInitializedCallbacks.forEach(callback => callback());
    this.pluginsInitializedCallbacks.length = 0;
    this.isPluginsReady = true;
  }

  /**
   * On update settings listener: enables, disables or updates the plugin.
   *
   * @private
   */
  onUpdateSettings(_newSettings?: unknown): void {
    if (!this.isEnabled) {
      return;
    }
    if (this.enabled && !this.isEnabled()) {
      this.disablePlugin();
    }
    if (!this.enabled && this.isEnabled()) {
      this.enablePlugin();
    }
    if (this.enabled && this.isEnabled()) {
      this.updatePlugin();
    }
  }

  /**
   * Updates the plugin to use the latest options you have specified.
   *
   * @private
   */
  updatePlugin(): void {}

  /**
   * Destroy plugin.
   */
  destroy(): void {
    this.eventManager?.destroy();
    this.clearHooks();

    // Releases everything the plugin holds.
    objectEach(this, (value: unknown, property: string) => {
      if (property !== 'hot' && property !== 't') {
        (this as unknown as Record<string, unknown>)[property] = null;
      }
    });
    delete (this as { t?: unknown }).t;
    delete (this as { hot?: unknown }).hot;
  }
}

export default BasePlugin;
