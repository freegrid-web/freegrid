import { addClass, outerHeight, outerWidth } from './../helpers/dom/element';
import type { Samples } from './samplesGenerator';

type CellProperties = Record<string, unknown> & { row?: number; col?: number };
type Renderer = (hot: Grid, td: HTMLTableCellElement, row: number, column: number, prop: unknown, value: unknown,
  cellProperties: CellProperties) => void;

/** What GhostTable needs from a grid. */
type Grid = {
  rootElement: HTMLElement;
  table: HTMLTableElement;
  getColHeader(column: number): unknown;
  hasRowHeaders(): boolean;
  getCellMeta(row: number, column: number): CellProperties;
  getCellRenderer(cellProperties: CellProperties): Renderer;
  colToProp(column: number): unknown;
  view: {
    appendColHeader(column: number, th: HTMLTableCellElement): void;
    appendRowHeader(row: number, th: HTMLTableCellElement): void;
    wt: { wtTable: { getStretchedColumnWidth(column: number): number } };
  };
};

type TableParts = {
  fragment: DocumentFragment;
  table: HTMLTableElement;
  tHead: HTMLTableSectionElement;
  tBody: HTMLTableSectionElement;
  colGroup: HTMLTableColElement;
  tr: HTMLTableRowElement;
  th: HTMLTableCellElement;
};
type Container = { fragment: DocumentFragment; container: HTMLDivElement };
type MeasuredRow = { row: number; table?: HTMLTableElement };
type MeasuredColumn = { col: number; table?: HTMLTableElement };
type Settings = Record<string, unknown>;

/**
 * Renders sample cells of some rows or columns in a hidden table, with the grid's renderers and classes, to measure
 * their natural height or width (for the auto-size plugins). One instance measures either rows or columns.
 */
class GhostTable {
  hot: Grid;

  /** Wraps every measured table; in the grid's root element while measuring. */
  container: Container | null = null;

  /** Whether the tables are in the document. */
  injected = false;

  rows: MeasuredRow[] = [];

  columns: MeasuredColumn[] = [];

  /** Samples of the row or column being added. */
  samples: Samples | null = null;

  #settings: Settings | null = { useHeaders: true };

  constructor(hotInstance: Grid) {
    this.hot = hotInstance;
  }

  /** Adds a row to measure, with its sample cells. */
  addRow(row: number, samples: Samples): void {
    if (this.columns.length) {
      throw new Error('Doesn\'t support multi-dimensional table');
    }
    if (!this.rows.length) {
      this.container = this.createContainer(this.hot.rootElement.className);
    }
    const rowObject: MeasuredRow = { row };

    this.rows.push(rowObject);
    this.samples = samples;
    const table = this.createTable(this.hot.table.className);

    table.colGroup.appendChild(this.createColGroupsCol());
    table.tr.appendChild(this.createRow(row));
    this.container!.container.appendChild(table.fragment);
    rowObject.table = table.table;
  }

  /** Adds the row of column headers (row -1) to measure. */
  addColumnHeadersRow(samples: Samples): void {
    const colHeader = this.hot.getColHeader(0);

    if (colHeader === null || colHeader === undefined) {
      return;
    }
    const rowObject: MeasuredRow = { row: -1 };

    this.rows.push(rowObject);
    this.container = this.createContainer(this.hot.rootElement.className);
    this.samples = samples;
    const table = this.createTable(this.hot.table.className);

    table.colGroup.appendChild(this.createColGroupsCol());
    table.tHead.appendChild(this.createColumnHeadersRow());
    this.container.container.appendChild(table.fragment);
    rowObject.table = table.table;
  }

  /** Adds a column to measure, with its sample cells (and its header, unless `useHeaders` is off). */
  addColumn(column: number, samples: Samples): void {
    if (this.rows.length) {
      throw new Error('Doesn\'t support multi-dimensional table');
    }
    if (!this.columns.length) {
      this.container = this.createContainer(this.hot.rootElement.className);
    }
    const columnObject: MeasuredColumn = { col: column };

    this.columns.push(columnObject);
    this.samples = samples;
    const table = this.createTable(this.hot.table.className);

    if (this.getSetting('useHeaders') && this.hot.getColHeader(column) !== null) {
      this.hot.view.appendColHeader(column, table.th);
    }
    table.tBody.appendChild(this.createCol(column));
    this.container!.container.appendChild(table.fragment);
    columnObject.table = table.table;
  }

  /** Measures the rows: `callback(row, height)` for each. */
  getHeights(callback: (row: number, height: number) => void): void {
    if (!this.injected) {
      this.injectTable();
    }
    // -1: without the table's top border.
    this.rows.forEach(({ row, table }) => callback(row, outerHeight(table as HTMLElement) - 1));
  }

  /** Measures the columns: `callback(column, width)` for each. */
  getWidths(callback: (column: number, width: number) => void): void {
    if (!this.injected) {
      this.injectTable();
    }
    this.columns.forEach(({ col, table }) => callback(col, outerWidth(table as HTMLElement)));
  }

  setSettings(settings: Settings | null): void {
    this.#settings = settings;
  }

  setSetting(name: string, value: unknown): void {
    this.#settings ??= {};
    this.#settings[name] = value;
  }

  getSettings(): Settings | null {
    return this.#settings;
  }

  getSetting(name: string): unknown {
    return this.#settings ? this.#settings[name] : null;
  }

  /** The `<col>`s of a row table: the row header's and one per sample cell. */
  createColGroupsCol(): DocumentFragment {
    const fragment = document.createDocumentFragment();

    if (this.hot.hasRowHeaders()) {
      fragment.appendChild(this.createColElement(-1));
    }
    this.#sampled().forEach(({ col }) => fragment.appendChild(this.createColElement(col as number)));

    return fragment;
  }

  /** The cells of a row: its header and one rendered cell per sample. */
  createRow(row: number): DocumentFragment {
    const fragment = document.createDocumentFragment();

    if (this.hot.hasRowHeaders()) {
      const th = document.createElement('th');

      this.hot.view.appendRowHeader(row, th);
      fragment.appendChild(th);
    }
    this.#sampled().forEach(({ col, value }) => {
      fragment.appendChild(this.#renderCell(row, col as number, value));
    });

    return fragment;
  }

  /** The column headers of the sampled columns (and the corner, with row headers). */
  createColumnHeadersRow(): DocumentFragment {
    const fragment = document.createDocumentFragment();

    if (this.hot.hasRowHeaders()) {
      const th = document.createElement('th');

      this.hot.view.appendColHeader(-1, th);
      fragment.appendChild(th);
    }
    this.#sampled().forEach(({ col }) => {
      const th = document.createElement('th');

      this.hot.view.appendColHeader(col as number, th);
      fragment.appendChild(th);
    });

    return fragment;
  }

  /** The rows of a column table: one rendered cell per sample. */
  createCol(column: number): DocumentFragment {
    const fragment = document.createDocumentFragment();

    this.#sampled().forEach(({ row, value }) => {
      const td = document.createElement('td');
      const tr = document.createElement('tr');

      // Marks cells of the ghost table before rendering, so that renderers can skip logic that is costly or does not
      // work in a hidden table.
      td.setAttribute('ghost-table', '1');
      this.#renderCell(row as number, column, value, td);
      tr.appendChild(td);
      fragment.appendChild(tr);
    });

    return fragment;
  }

  /** Removes the tables and forgets what was measured. */
  clean(): void {
    this.rows.length = 0;
    (this.rows as unknown as Record<number, undefined>)[-1] = undefined;
    this.columns.length = 0;
    this.samples?.clear();
    this.samples = null;
    this.removeTable();
  }

  /** Puts the tables into the document (into the grid's root element by default), to measure them. */
  injectTable(parent: HTMLElement | null = null): void {
    if (!this.injected) {
      (parent || this.hot.rootElement).appendChild(this.container!.fragment);
      this.injected = true;
    }
  }

  removeTable(): void {
    if (this.injected && this.container?.container.parentNode) {
      this.container.container.remove();
      this.container = null;
      this.injected = false;
    }
  }

  /** A `<col>` as wide as the grid's column. */
  createColElement(column: number): HTMLTableColElement {
    const col = document.createElement('col');

    col.style.width = `${this.hot.view.wt.wtTable.getStretchedColumnWidth(column)}px`;

    return col;
  }

  createTable(className = ''): TableParts {
    const fragment = document.createDocumentFragment();
    const table = document.createElement('table');
    const tHead = document.createElement('thead');
    const tBody = document.createElement('tbody');
    const colGroup = document.createElement('colgroup');
    const tr = document.createElement('tr');
    const th = document.createElement('th');

    if (this.isVertical()) {
      table.appendChild(colGroup);
    }
    if (this.isHorizontal()) {
      tr.appendChild(th);
      tHead.appendChild(tr);
      table.style.tableLayout = 'auto';
      table.style.width = 'auto';
    }
    table.appendChild(tHead);

    if (this.isVertical()) {
      tBody.appendChild(tr);
    }
    table.appendChild(tBody);
    addClass(table, className);
    fragment.appendChild(table);

    return { fragment, table, tHead, tBody, colGroup, tr, th };
  }

  createContainer(className = ''): Container {
    const fragment = document.createDocumentFragment();
    const container = document.createElement('div');

    addClass(container, `fg-ghost-table fg-auto-size ${className.trim()}`);
    fragment.appendChild(container);

    return { fragment, container };
  }

  /** Whether rows are measured. */
  isVertical(): boolean {
    return !!(this.rows.length && !this.columns.length);
  }

  /** Whether columns are measured. */
  isHorizontal(): boolean {
    return !!(this.columns.length && !this.rows.length);
  }

  /** Every sampled value of the current samples, in order. */
  #sampled() {
    return [...(this.samples as Samples).values()].flatMap(sample => sample.strings);
  }

  /** A cell (a new one or `td`) rendered by the grid's renderer for that cell. */
  #renderCell(row: number, column: number, value: unknown, td = document.createElement('td')): HTMLTableCellElement {
    const cellProperties = this.hot.getCellMeta(row, column);

    cellProperties.col = column;
    cellProperties.row = row;

    this.hot.getCellRenderer(cellProperties)(this.hot, td, row, column, this.hot.colToProp(column), value, cellProperties);

    return td;
  }
}

export default GhostTable;
