import { inherit } from './object';

export type SettingsConstructor = { new (): unknown; prototype: Record<PropertyKey, unknown> };

/**
 * Creates the column settings constructor: it inherits from `GridSettings`, with the `conflictList` settings
 * cleared so they do not leak from the grid level to columns.
 */
export const columnFactory = (GridSettings: SettingsConstructor, conflictList: readonly string[]): SettingsConstructor => {
  // A function, not an arrow: it is a constructor (`new ColumnSettings()`).
  function ColumnSettings() {}

  inherit(ColumnSettings as unknown as SettingsConstructor, GridSettings);

  // Clear conflict settings
  conflictList.forEach((name) => {
    ColumnSettings.prototype[name] = void 0;
  });

  return ColumnSettings as unknown as SettingsConstructor;
};
