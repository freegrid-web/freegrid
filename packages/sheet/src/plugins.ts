/**
 * The plugin registry: a plugin class registered under a name gets an instance in every grid.
 */
import Hooks from './pluginHooks';
import { toUpperCaseFirst } from './helpers/string';
import type BasePlugin from './plugins/_base';
import type { PluginHost } from './plugins/_base';

type PluginClass = new (hotInstance: PluginHost) => BasePlugin;

/** Each grid's plugins by name (`ColumnSorting`, …). */
const registeredPlugins = new WeakMap<PluginHost, Record<string, BasePlugin>>();

/**
 * Registers a plugin class under `pluginName` (its first letter is made upper case): each grid created afterwards
 * gets an instance of it.
 */
export const registerPlugin = (pluginName: string, PluginClass: PluginClass): void => {
  const correctedPluginName = toUpperCaseFirst(pluginName);

  // Functions, not arrows: `this` is the grid.
  Hooks.getSingleton().add('construct', function(this: PluginHost) {
    if (!registeredPlugins.has(this)) {
      registeredPlugins.set(this, {});
    }
    const holder = registeredPlugins.get(this)!;

    if (!holder[correctedPluginName]) {
      holder[correctedPluginName] = new PluginClass(this);
    }
  });
  Hooks.getSingleton().add('afterDestroy', function(this: PluginHost) {
    const pluginsHolder = registeredPlugins.get(this);

    if (pluginsHolder) {
      Object.values(pluginsHolder).forEach(plugin => plugin.destroy());
      registeredPlugins.delete(this);
    }
  });
};

/** The grid's instance of a plugin (`undefined` when there is none). */
export const getPlugin = (instance: PluginHost, pluginName: string): BasePlugin | undefined => {
  if (typeof pluginName !== 'string') {
    throw Error('Only strings can be passed as "plugin" parameter');
  }

  return registeredPlugins.get(instance)?.[toUpperCaseFirst(pluginName)];
};

/** The names of the grid's plugins. */
export const getRegistredPluginNames = (hotInstance: PluginHost): string[] => Object.keys(
  registeredPlugins.get(hotInstance) ?? {});

/** The name `plugin` is registered under in the grid, or `null`. */
export const getPluginName = (hotInstance: PluginHost, plugin: BasePlugin): string | null => {
  const entry = Object.entries(registeredPlugins.get(hotInstance) ?? {})
    .find(([, pluginInstance]) => pluginInstance === plugin);

  return entry ? entry[0] : null;
};
