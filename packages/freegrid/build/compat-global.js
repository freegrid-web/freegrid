/*! FreeSheet compat: exposes window.Handsontable for code written against Handsontable 6.x. MIT License. */
(function(root) {
  if (!root || typeof root.FreeSheet !== 'function') {
    throw new Error('FreeSheet compat.js: load freesheet.js (or freesheet.full.js) before compat.js.');
  }
  root.Handsontable = root.FreeSheet;
}(typeof self !== 'undefined' ? self : this));
