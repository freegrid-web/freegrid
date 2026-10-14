// The open types of the grid: settings and cell meta take any key with any value (users add their own), and a
// callback may have any signature. `any` lives here, in one place.
/* eslint-disable @typescript-eslint/no-explicit-any */

/** Settings, cell meta and similar user objects: any key, any value. */
export type AnyObject = Record<string, any>;

/** A callback of any signature. */
export type AnyFunction = (...args: any[]) => any;

/** The grid's settings (an instance of the grid's settings chain; see Core). Typed per setting later. */
export type GridSettings = AnyObject;
