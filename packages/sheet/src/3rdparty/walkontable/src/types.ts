import type Walkontable from './core';
import type Highlight from '../../../selection/highlight/highlight';
import type Overlays from './overlays';
import type ViewportRowsCalculator from './calculator/viewportRows';
import type ViewportColumnsCalculator from './calculator/viewportColumns';

export type Coordinates = { row: number; col: number };
export type HeaderRenderer = (index: number, cell: HTMLTableCellElement, level?: number) => void;
export type HeaderSize = number | number[] | null | undefined;
export interface SelectionSurface {
  settings: { highlightHeaderClassName?: string; highlightRowClassName?: string; highlightColumnClassName?: string };
  classNames: string[];
  draw(instance: Walkontable, fastDraw?: boolean): void;
}
export type SelectionCollection = Iterable<SelectionSurface> & Pick<Highlight, 'getCell' | 'createOrGetArea'>;

/** Text nodes have been removed, so table sections contain rows and rows contain cells. */
export type TableWrapper = HTMLDivElement & { parentNode: HTMLElement };
export type TableRow = HTMLTableRowElement & {
  childNodes: NodeListOf<HTMLTableCellElement>;
  firstChild: HTMLTableCellElement | null;
  nextSibling: TableRow | null;
};
export type TableSection = HTMLTableSectionElement & {
  childNodes: NodeListOf<TableRow>;
  firstChild: TableRow | null;
};
export type TableColumnGroup = HTMLTableColElement & { childNodes: NodeListOf<HTMLTableColElement> };

/** Results after Settings has invoked a callback or returned a value. Custom settings remain unknown. */
export interface SettingResults {
  table: HTMLTableElement;
  debug: boolean;
  externalRowCalculator: boolean;
  stretchH: string;
  preventOverflow: boolean | string;
  freezeOverlays: boolean;
  fixedColumnsLeft: number;
  fixedRowsTop: number;
  fixedRowsBottom: number;
  minSpareRows: number;
  rowHeaders: HeaderRenderer[];
  columnHeaders: HeaderRenderer[];
  totalRows: number;
  totalColumns: number;
  defaultRowHeight: number;
  defaultColumnWidth: number;
  rowHeight: number | undefined;
  columnWidth: number | undefined;
  selections: SelectionCollection;
  rowHeaderWidth: HeaderSize;
  columnHeaderHeight: HeaderSize;
  onModifyRowHeaderWidth: HeaderSize;
  onModifyGetCellCoords: number[] | undefined;
  onBeforeStretchingColumnWidth: number | undefined;
  onBeforeRemoveCellClassNames: string[] | undefined;
  renderAllRows: boolean;
}

/** The normalized settings fields the rendering modules access directly. */
export interface RawSettings extends Record<string, unknown> {
  rowHeight: (row: number) => number | undefined;
  columnWidth: number | number[] | ((column: number) => number | undefined) | null | undefined;
  rowHeaderWidth: HeaderSize | (() => HeaderSize);
  defaultRowHeight: number;
  defaultColumnWidth: number;
  cellRenderer: (row: number, column: number, cell: HTMLTableCellElement) => void;
  renderAllRows: boolean;
  viewportRowCalculatorOverride: ((calculator: ViewportRowsCalculator) => void) | null;
  viewportColumnCalculatorOverride: ((calculator: ViewportColumnsCalculator) => void) | null;
}

export interface EngineSettings {
  settings: RawSettings;
  defaults: RawSettings;
  instance: Walkontable;
  getSetting(key: string, ...params: unknown[]): unknown;
  update(settings: Record<string, unknown> | string, value?: unknown): Walkontable;
  has(key: string): boolean;
}

/** Overlay rendering and scrolling surface; the implementation is converted in stage A, PR 3. */
export interface OverlaySurface {
  type: string;
  clone: Walkontable;
  needFullRender: boolean;
  mainTableScrollableElement: HTMLElement | Window;
  trimmingContainer: HTMLElement | Window;
  holder: HTMLElement;
  getScrollPosition(): number;
  getTableParentOffset(): number;
  sumCellSizes(from: number, to: number): number;
  scrollTo(index: number, bottomOrRight?: boolean): boolean;
  resetFixedPosition(): boolean | void;
  refresh(fastDraw?: boolean): void;
}

type OverlayMembers = 'topOverlay' | 'bottomOverlay' | 'leftOverlay' | 'topLeftCornerOverlay' |
  'bottomLeftCornerOverlay' | 'getParentOverlay';
export type OverlayManager = Omit<Overlays, OverlayMembers> & {
  topOverlay: OverlaySurface;
  bottomOverlay: OverlaySurface;
  leftOverlay: OverlaySurface;
  topLeftCornerOverlay: OverlaySurface;
  bottomLeftCornerOverlay: OverlaySurface;
  getParentOverlay(element: HTMLElement): Walkontable | null;
};

export interface WalkontableOptions extends Record<string, unknown> {
  table: HTMLTableElement;
  cloneSource?: Walkontable;
  cloneOverlay?: OverlaySurface;
  wtRootElement?: HTMLElement;
}
