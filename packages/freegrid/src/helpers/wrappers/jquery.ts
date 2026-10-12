// The plugin is registered as $.fn.freegrid; $.fn.handsontable is kept as a compatibility name for code
// written against FreeGrid 6.x. Both names share one instance per element.
const PLUGIN_NAMES = ['freegrid', 'handsontable'];

type Instance = Record<string, unknown> & {
  updateSettings(settings: object): void;
  init(): void;
};
type JQueryObject = {
  first(): JQueryObject;
  data(key?: string, value?: unknown): unknown;
  removeData(): void;
  [index: number]: Element;
};
type FreeGridLike = { Core: new (element: Element, settings: object) => Instance };
type JQueryLike = { fn: Record<string, unknown> };

/**
 * Registers `$(element).freegrid(settings | action, ...args)` (and `.handsontable`) when jQuery is on the page.
 */
const jQueryWrapper = (FreeGrid: FreeGridLike): void => {
  const jQuery = typeof window === 'undefined' ? false : (window as unknown as { jQuery?: JQueryLike }).jQuery;

  if (!jQuery) {
    return;
  }

  // A function, not an arrow: jQuery calls it with `this` set to the jQuery object.
  function plugin(this: JQueryObject, action?: string | object, ...args: unknown[]): unknown {
    const $this = this.first(); // Use only first element from list
    let instance = ($this.data('freegrid') || $this.data('handsontable')) as Instance | undefined;

    // Init case
    if (typeof action !== 'string') {
      const userSettings = action || {};

      if (instance) {
        instance.updateSettings(userSettings);

      } else {
        const created = new FreeGrid.Core($this[0], userSettings);

        PLUGIN_NAMES.forEach(name => $this.data(name, created));
        created.init();
        instance = created;
      }

      return $this;
    }

    let output: unknown;

    // Action case
    if (instance) {
      const method = instance[action];

      if (typeof method !== 'undefined') {
        output = (method as (...methodArgs: unknown[]) => unknown).call(instance, ...args);

        if (action === 'destroy') {
          $this.removeData();
        }

      } else {
        throw new Error(`FreeGrid does not provide action: ${action}`);
      }
    }

    return output;
  }

  PLUGIN_NAMES.forEach((name) => {
    jQuery.fn[name] = plugin;
  });
};

export default jQueryWrapper;
