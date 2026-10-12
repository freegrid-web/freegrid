/*! FreeGrid compat: exposes window.Handsontable for code written against Handsontable 6.x. MIT License. */
(function(root) {
  if (!root || typeof root.FreeGrid !== 'function') {
    throw new Error('FreeGrid compat.js: load freegrid.js (or freegrid.full.js) before compat.js.');
  }
  root.Handsontable = root.FreeGrid;
}(typeof self !== 'undefined' ? self : this));
