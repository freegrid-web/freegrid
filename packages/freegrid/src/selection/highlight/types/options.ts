import type { CellRange } from './../../../3rdparty/walkontable/src';

/** Options of the selection highlights (given by Selection, from the grid's settings). */
export type HighlightOptions = {
  headerClassName?: string;
  activeHeaderClassName?: string;
  rowClassName?: string;
  columnClassName?: string;
  /** Highlight types not to draw: `true`/`false`, a type, or a list of types. */
  disableHighlight?: boolean | string | string[];
  cellCornerVisible?: (layerLevel?: number) => boolean;
  areaCornerVisible?: (layerLevel?: number) => boolean;
  layerLevel?: number;
};

/** Options of a custom selection (e.g. a custom border). */
export type CustomSelectionOptions = { border?: object; cellRange?: CellRange };
