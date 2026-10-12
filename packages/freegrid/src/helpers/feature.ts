export function isTouchSupported() {
  return ('ontouchstart' in window);
}

let comparisonFunction;

/**
 * Get string comparison function for sorting purposes. It supports multilingual string comparison base on Internationalization API.
 * The first call decides the language and options; later calls return the same function.
 *
 * @param {String} [language]
 * @param {Object} [options]
 * @returns {Function}
 */
export function getComparisonFunction(language, options = {}) {
  if (!comparisonFunction) {
    comparisonFunction = new Intl.Collator(language, options).compare;
  }

  return comparisonFunction;
}
