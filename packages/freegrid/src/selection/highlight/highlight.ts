import { createHighlight } from './types';
import type { Selection } from './../../3rdparty/walkontable/src';
import type { CustomSelectionOptions, HighlightOptions } from './types/options';

export const ACTIVE_HEADER_TYPE = 'active-header';
export const AREA_TYPE = 'area';
export const CELL_TYPE = 'cell';
export const FILL_TYPE = 'fill';
export const HEADER_TYPE = 'header';
export const CUSTOM_SELECTION = 'custom-selection';

/**
 * The visual highlights of the selection, as Walkontable Selections:
 * - `cell`: the current cell (one);
 * - `fill`: the cells the fill handle is dragged over (one);
 * - `area`: a range of selected cells, one per layer of a non-consecutive selection;
 * - `header`: the headers of the selected cells, one per layer;
 * - `active-header`: the headers of fully selected rows and columns, one per layer;
 * - custom selections, e.g. custom borders.
 */
class Highlight {
  options: HighlightOptions;

  /** The layer whose `area` and `header` highlights the `createOrGet…` methods return. */
  layerLevel = 0;

  cell: Selection;

  fill: Selection;

  areas = new Map<number, Selection>();

  headers = new Map<number, Selection>();

  activeHeaders = new Map<number, Selection>();

  customSelections: Selection[] = [];

  constructor(options: HighlightOptions) {
    this.options = options;
    this.cell = createHighlight(CELL_TYPE, options);
    this.fill = createHighlight(FILL_TYPE, options);
  }

  /** Whether a highlight type is drawn (`disableHighlight` does not list it). `current` means `cell`. */
  isEnabledFor(highlightType: string): boolean {
    const type = highlightType === 'current' ? CELL_TYPE : highlightType;
    const { disableHighlight } = this.options;
    const disabled = typeof disableHighlight === 'string' ? [disableHighlight] : disableHighlight;

    return disabled === false || (Array.isArray(disabled) && !disabled.includes(type));
  }

  useLayerLevel(level = 0): this {
    this.layerLevel = level;

    return this;
  }

  getCell(): Selection {
    return this.cell;
  }

  getFill(): Selection {
    return this.fill;
  }

  /** The `area` highlight of the current layer (created when missing). */
  createOrGetArea(): Selection {
    return this.#createOrGet(this.areas, AREA_TYPE, { layerLevel: this.layerLevel, ...this.options });
  }

  getAreas(): Selection[] {
    return [...this.areas.values()];
  }

  /** The `header` highlight of the current layer (created when missing). */
  createOrGetHeader(): Selection {
    return this.#createOrGet(this.headers, HEADER_TYPE, { ...this.options });
  }

  getHeaders(): Selection[] {
    return [...this.headers.values()];
  }

  /** The `active-header` highlight of the current layer (created when missing). */
  createOrGetActiveHeader(): Selection {
    return this.#createOrGet(this.activeHeaders, ACTIVE_HEADER_TYPE, { ...this.options });
  }

  getActiveHeaders(): Selection[] {
    return [...this.activeHeaders.values()];
  }

  getCustomSelections(): Selection[] {
    return [...this.customSelections];
  }

  addCustomSelection(options: CustomSelectionOptions): void {
    this.customSelections.push(createHighlight(CUSTOM_SELECTION, { ...options }));
  }

  /**
   * New class names (from `updateSettings`): the highlights made later use them, and so do the header highlights that
   * exist already.
   */
  setClassNames(classNames: Pick<HighlightOptions, 'headerClassName' | 'activeHeaderClassName' | 'rowClassName'
    | 'columnClassName'>): void {
    Object.assign(this.options, classNames);
    this.headers.forEach((highlight) => {
      Object.assign((highlight as unknown as { settings: Record<string, unknown> }).settings, {
        highlightHeaderClassName: this.options.headerClassName,
        highlightRowClassName: this.options.rowClassName,
        highlightColumnClassName: this.options.columnClassName,
      });
    });
    this.activeHeaders.forEach((highlight) => {
      (highlight as unknown as { settings: Record<string, unknown> }).settings.highlightHeaderClassName =
        this.options.activeHeaderClassName;
    });
  }

  /** Clears every highlight except the custom selections. */
  clear(): void {
    this.cell.clear();
    this.fill.clear();
    [...this.areas.values(), ...this.headers.values(), ...this.activeHeaders.values()]
      .forEach(highlight => highlight.clear());
  }

  [Symbol.iterator](): Iterator<Selection> {
    return [
      this.cell,
      this.fill,
      ...this.areas.values(),
      ...this.headers.values(),
      ...this.activeHeaders.values(),
      ...this.customSelections,
    ][Symbol.iterator]();
  }

  #createOrGet(layers: Map<number, Selection>, type: string, options: HighlightOptions): Selection {
    let highlight = layers.get(this.layerLevel);

    if (!highlight) {
      highlight = createHighlight(type, options);
      layers.set(this.layerLevel, highlight);
    }

    return highlight;
  }
}

export default Highlight;
