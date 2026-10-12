// The plugin is registered as $.fn.freegrid; $.fn.handsontable is kept as a compatibility name for code
// written against FreeGrid 6.x. Both names share one instance per element.
const PLUGIN_NAMES = ['freegrid', 'handsontable'];

export default function jQueryWrapper(FreeGrid) {
  const jQuery = typeof window === 'undefined' ? false : window.jQuery;

  if (!jQuery) {
    return;
  }

  function plugin(action, ...args) {
    const $this = this.first(); // Use only first element from list
    let instance = $this.data('freegrid') || $this.data('handsontable');

    // Init case
    if (typeof action !== 'string') {
      const userSettings = action || {};

      if (instance) {
        instance.updateSettings(userSettings);

      } else {
        instance = new FreeGrid.Core($this[0], userSettings);
        PLUGIN_NAMES.forEach(name => $this.data(name, instance));
        instance.init();
      }

      return $this;
    }

    let output;

    // Action case
    if (instance) {
      if (typeof instance[action] !== 'undefined') {
        output = instance[action].call(instance, ...args);

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
}
