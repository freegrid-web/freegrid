/* eslint-disable no-console */
/* eslint-disable no-restricted-globals */

// These helpers do nothing (instead of throwing) where no `console` object is exposed.

import { isDefined } from './mixed';

/**
 * Logs a message to the console.
 */
export const log = (...args: unknown[]): void => {
  if (isDefined(console)) {
    console.log(...args);
  }
};

/**
 * Logs a warning to the console.
 */
export const warn = (...args: unknown[]): void => {
  if (isDefined(console)) {
    console.warn(...args);
  }
};

/**
 * Logs information to the console.
 */
export const info = (...args: unknown[]): void => {
  if (isDefined(console)) {
    console.info(...args);
  }
};

/**
 * Logs an error to the console.
 */
export const error = (...args: unknown[]): void => {
  if (isDefined(console)) {
    console.error(...args);
  }
};
