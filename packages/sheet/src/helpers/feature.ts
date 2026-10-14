/**
 * Checks if the browser supports touch events.
 */
export const isTouchSupported = (): boolean => ('ontouchstart' in window);

let comparisonFunction: ((a: string, b: string) => number) | undefined;

/**
 * Returns a string comparison function for sorting (`Intl.Collator`). The first call decides the language and
 * options; later calls return the same function.
 */
export const getComparisonFunction = (language?: string, options: Intl.CollatorOptions = {}): (a: string, b: string) => number => {
  if (!comparisonFunction) {
    comparisonFunction = new Intl.Collator(language, options).compare;
  }

  return comparisonFunction;
};
