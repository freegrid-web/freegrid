import type * as plugins from './index';
import type BasePlugin from './_base';

/** The plugin classes by name (`AutoFill`, …; `Base` is the base class, not a plugin). */
type PluginClasses = Omit<typeof plugins, 'Base'>;

/**
 * The plugin `getPlugin(name)` returns: the class for a known name (`'mergeCells'` or `'MergeCells'`), otherwise
 * `BasePlugin | undefined` (a custom plugin, or a name no plugin has).
 */
export type PluginByName<Name extends string> = Name extends keyof PluginClasses
  ? InstanceType<PluginClasses[Name]>
  : Capitalize<Name> extends keyof PluginClasses
    ? InstanceType<PluginClasses[Capitalize<Name>]>
    : BasePlugin | undefined;
