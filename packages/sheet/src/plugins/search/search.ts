import BasePlugin from './../_base';
import { registerPlugin } from './../../plugins';
import { isObject } from './../../helpers/object';
import type { PluginHost } from './../_base';
import type { CellProperties } from '../../cellTypes/types';

/** Called for every cell a query checks, with whether the cell matches. */
export type SearchCallback = (instance: PluginHost, row: number, col: number, data: unknown, testResult: boolean) => void;

/** Whether a cell's value matches the query. */
export type QueryMethod = (query: unknown, value: unknown) => boolean;

/** A cell that matches a query. */
export type SearchResult = { row: number; col: number; data: unknown };

type SearchSettings = { callback?: SearchCallback; queryMethod?: QueryMethod; searchResultClass?: string };

const DEFAULT_SEARCH_RESULT_CLASS = 'fs-search-result';

// Marks the cell, so that the next render gives it the search result class.
const DEFAULT_CALLBACK: SearchCallback = (instance, row, col, data, testResult) => {
  instance.getCellMeta(row, col).isSearchResult = testResult;
};

// Case-insensitive "contains"; an empty query matches nothing.
const DEFAULT_QUERY_METHOD: QueryMethod = (query, value) => {
  if (typeof query !== 'string' || query.length === 0 || value === undefined || value === null) {
    return false;
  }

  return value.toString().toLowerCase().includes(query.toLowerCase());
};

/**
 * @plugin Search
 *
 * @description
 * The search plugin provides an easy interface to search data across FreeSheet.
 *
 * In order to enable search mechanism, {@link Options#search} option must be set to `true`.
 *
 * @example
 * ```js
 * // as boolean
 * search: true
 * // as a object with one or more options
 * search: {
 *   callback: myNewCallbackFunction,
 *   queryMethod: myNewQueryMethod,
 *   searchResultClass: 'customClass'
 * }
 *
 * // Access to search plugin instance:
 * const searchPlugin = hot.getPlugin('search');
 *
 * // Set callback programmatically:
 * searchPlugin.setCallback(myNewCallbackFunction);
 * // Set query method programmatically:
 * searchPlugin.setQueryMethod(myNewQueryMethod);
 * // Set search result cells class programmatically:
 * searchPlugin.setSearchResultClass(customClass);
 * ```
 */
class Search extends BasePlugin {
  /**
   * Function called during querying for each cell from the {@link DataMap}.
   *
   * @private
   */
  callback: SearchCallback = DEFAULT_CALLBACK;

  /**
   * Query function is responsible for determining whether a query matches the value stored in a cell.
   *
   * @private
   */
  queryMethod: QueryMethod = DEFAULT_QUERY_METHOD;

  /**
   * Class name added to each cell that belongs to the searched query.
   *
   * @private
   */
  searchResultClass = DEFAULT_SEARCH_RESULT_CLASS;

  /**
   * Checks if the plugin is enabled in the FreeSheet settings. This method is executed in {@link Hooks#beforeInit}
   * hook and if it returns `true` than the {@link AutoRowSize#enablePlugin} method is called.
   *
   */
  isEnabled(): boolean {
    return !!this.hot.getSettings().search;
  }

  /**
   * Enables the plugin functionality for this FreeSheet instance.
   */
  enablePlugin(): void {
    if (this.enabled) {
      return;
    }

    this.updatePluginSettings(this.hot.getSettings().search);

    this.addHook('beforeRenderer', (...args: Parameters<Search['onBeforeRenderer']>) => this.onBeforeRenderer(...args));

    super.enablePlugin();
  }

  /**
   * Disables the plugin functionality for this FreeSheet instance.
   */
  disablePlugin(): void {
    // The next render takes the search result class off the cells.
    const beforeRendererCallback = (...args: Parameters<Search['onBeforeRenderer']>) => this.onBeforeRenderer(...args);

    this.hot.addHook('beforeRenderer', beforeRendererCallback);
    this.hot.addHookOnce('afterRender', () => {
      this.hot.removeHook('beforeRenderer', beforeRendererCallback);
    });

    super.disablePlugin();
  }

  /**
   * Updates the plugin state. This method is executed when {@link Core#updateSettings} is invoked.
   */
  updatePlugin(): void {
    this.disablePlugin();
    this.enablePlugin();

    super.updatePlugin();
  }

  /**
   * Makes the query.
   *
   * @param queryStr Value to be search.
   * @param [callback] Callback function performed on cells with values which matches to the searched query.
   * @param [queryMethod] Query function responsible for determining whether a query matches the value stored in a cell.
   * @returns Return an array of objects with `row`, `col`, `data` properties or empty array.
   */
  query(queryStr: string, callback: SearchCallback = this.getCallback(),
    queryMethod: QueryMethod = this.getQueryMethod()): SearchResult[] {
    const rowCount: number = this.hot.countRows();
    const colCount: number = this.hot.countCols();
    const queryResult: SearchResult[] = [];

    for (let row = 0; row < rowCount; row += 1) {
      for (let col = 0; col < colCount; col += 1) {
        const data = this.hot.getDataAtCell(row, col);
        // A cell's own `search` settings win.
        const cellSearch = (this.hot.getCellMeta(row, col).search || {}) as SearchSettings;
        const testResult = (cellSearch.queryMethod || queryMethod)(queryStr, data);

        if (testResult) {
          queryResult.push({ row, col, data });
        }
        (cellSearch.callback || callback)?.(this.hot, row, col, data, testResult);
      }
    }

    return queryResult;
  }

  /**
   * Gets the callback function.
   *
   * @returns Return the callback function.
   */
  getCallback(): SearchCallback {
    return this.callback;
  }

  /**
   * Sets the callback function. This function will be called during querying for each cell.
   *
   * @param newCallback Called for every cell a query checks.
   */
  setCallback(newCallback: SearchCallback): void {
    this.callback = newCallback;
  }

  /**
   * Gets the query method function.
   *
   * @returns Return the query method.
   */
  getQueryMethod(): QueryMethod {
    return this.queryMethod;
  }

  /**
   * Sets the query method function. The function is responsible for determining whether a query matches the value stored in a cell.
   *
   * @param newQueryMethod Whether a cell's value matches the query.
   */
  setQueryMethod(newQueryMethod: QueryMethod): void {
    this.queryMethod = newQueryMethod;
  }

  /**
   * Gets search result cells class name.
   *
   * @returns Return the cell class name.
   */
  getSearchResultClass(): string {
    return this.searchResultClass;
  }

  /**
   * Sets search result cells class name. This class name will be added to each cell that belongs to the searched query.
   *
   * @param newElementClass The class name.
   */
  setSearchResultClass(newElementClass: string): void {
    this.searchResultClass = newElementClass;
  }

  /**
   * Updates the settings of the plugin.
   *
   * @param searchSettings The plugin settings, taken from FreeSheet configuration.
   * @private
   */
  updatePluginSettings(searchSettings: boolean | SearchSettings): void {
    if (isObject(searchSettings)) {
      if (searchSettings.searchResultClass) {
        this.setSearchResultClass(searchSettings.searchResultClass);
      }

      if (searchSettings.queryMethod) {
        this.setQueryMethod(searchSettings.queryMethod);
      }

      if (searchSettings.callback) {
        this.setCallback(searchSettings.callback);
      }
    }
  }

  /**
   * The `beforeRenderer` hook callback: gives search results the search result class.
   *
   * @private
   * @param TD The rendered `TD` element.
   * @param row Visual row index.
   * @param col Visual column index.
   * @param prop Column property name or a column index, if datasource is an array of arrays.
   * @param value Value of the rendered cell.
   * @param cellProperties Object containing the cell's properties.
   */
  onBeforeRenderer(TD: HTMLTableCellElement, row: number, col: number, prop: string | number, value: unknown,
    cellProperties: CellProperties): void {
    const { className = [] } = cellProperties;
    const classArray = typeof className === 'string' ? className.split(' ') : [...className];

    if (this.isEnabled() && cellProperties.isSearchResult) {
      if (!classArray.includes(this.searchResultClass)) {
        classArray.push(`${this.searchResultClass}`);
      }

    } else if (classArray.includes(this.searchResultClass)) {
      classArray.splice(classArray.indexOf(this.searchResultClass), 1);
    }

    cellProperties.className = classArray.join(' ');
  }

  /**
   * Destroys the plugin instance.
   */
  destroy(): void {
    super.destroy();
  }
}

registerPlugin('search', Search);

export default Search;
