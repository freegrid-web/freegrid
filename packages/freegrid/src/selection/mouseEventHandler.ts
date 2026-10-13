import { isRightClick as isRightClickEvent, isLeftClick as isLeftClickEvent } from './../helpers/dom/event';
import { CellCoords } from './../3rdparty/walkontable/src';
import type Selection from './selection';

/** Which kinds of selection a mouse action may change (`true`: leave it to later stages). */
type Controller = { row?: boolean; column?: boolean; cell?: boolean; cells?: boolean };
type MouseAction = {
  isShiftKey?: boolean;
  isLeftClick?: boolean;
  isRightClick?: boolean;
  coords: CellCoords;
  selection: Selection;
  controller: Controller;
};

/**
 * Mouse down on a cell or a header: starts a selection (cells, rows, columns, all), or with Shift extends the
 * current one. A right click inside the selection keeps it.
 */
export const mouseDown = ({ isShiftKey, isLeftClick, isRightClick, coords, selection, controller }: MouseAction): void => {
  const currentSelection = selection.isSelected() ? selection.getSelectedRange().current() : null;
  const selectedCorner = selection.isSelectedByCorner();
  const selectedRow = selection.isSelectedByRowHeader();

  if (isShiftKey && currentSelection) {
    if (coords.row >= 0 && coords.col >= 0 && !controller.cells) {
      selection.setRangeEnd(coords);
    } else if (selectedCorner && coords.row < 0 && !controller.column) {
      selection.setRangeEnd(new CellCoords(currentSelection.to.row, coords.col));
    } else if (selectedRow && coords.col < 0 && !controller.row) {
      selection.setRangeEnd(new CellCoords(coords.row, currentSelection.to.col));
    } else if (((!selectedCorner && !selectedRow && coords.col < 0)
      || (selectedCorner && coords.col < 0)) && !controller.row) {
      selection.selectRows(currentSelection.from.row, coords.row);
    } else if (((!selectedCorner && !selectedRow && coords.row < 0)
      || (selectedRow && coords.row < 0)) && !controller.column) {
      selection.selectColumns(currentSelection.from.col, coords.col);
    }

    return;
  }
  const newCoord = new CellCoords(Math.max(coords.row, 0), Math.max(coords.col, 0));
  const allowRightClickSelection = !selection.inInSelection(newCoord);
  const performSelection = isLeftClick || (isRightClick && allowRightClickSelection);

  if (coords.row < 0 && coords.col >= 0 && !controller.column) {
    // A column header.
    if (performSelection) {
      selection.selectColumns(coords.col);
    }
  } else if (coords.col < 0 && coords.row >= 0 && !controller.row) {
    // A row header.
    if (performSelection) {
      selection.selectRows(coords.row);
    }
  } else if (coords.col >= 0 && coords.row >= 0 && !controller.cells) {
    if (performSelection) {
      selection.setRangeStart(coords);
    }
  } else if (coords.col < 0 && coords.row < 0) {
    // The corner: selects all.
    selection.setRangeStart(coords);
  }
};

/** Mouse over a cell or a header while the left button is down: extends the selection. */
export const mouseOver = ({ isLeftClick, coords, selection, controller }: MouseAction): void => {
  if (!isLeftClick) {
    return;
  }
  const selectedRow = selection.isSelectedByRowHeader();
  const selectedColumn = selection.isSelectedByColumnHeader();
  const countCols = selection.tableProps.countCols();
  const countRows = selection.tableProps.countRows();

  if (selectedColumn && !controller.column) {
    selection.setRangeEnd(new CellCoords(countRows - 1, coords.col));
  } else if (selectedRow && !controller.row) {
    selection.setRangeEnd(new CellCoords(coords.row, countCols - 1));
  } else if (!controller.cell) {
    selection.setRangeEnd(coords);
  }
};

const handlers = new Map([
  ['mousedown', mouseDown],
  ['mouseover', mouseOver],
  ['touchstart', mouseDown],
]);

/** Changes the selection for a mousedown, mouseover or touchstart on a cell or a header. */
export const handleMouseEvent = (event: MouseEvent | TouchEvent,
  { coords, selection, controller }: Pick<MouseAction, 'coords' | 'selection' | 'controller'>): void => {
  handlers.get(event.type)!({
    coords,
    selection,
    controller,
    isShiftKey: event.shiftKey,
    isLeftClick: isLeftClickEvent(event as MouseEvent) || event.type === 'touchstart',
    isRightClick: isRightClickEvent(event as MouseEvent),
  });
};
