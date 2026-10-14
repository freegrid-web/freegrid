/* Test-page only: upstream's webpack 3 test bundles injected a setImmediate polyfill that the
 * walkontable test helpers rely on. */
(function() {
  if (typeof window.setImmediate === 'function') return;
  window.setImmediate = function(callback) {
    var args = Array.prototype.slice.call(arguments, 1);

    return setTimeout(function() { callback.apply(null, args); }, 0);
  };
  window.clearImmediate = function(id) { clearTimeout(id); };
}());
