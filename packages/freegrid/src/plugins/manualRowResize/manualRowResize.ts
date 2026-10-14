import BasePlugin from './../_base';
import type { PluginHost } from './../_base';
import { addClass, hasClass, removeClass, outerWidth } from './../../helpers/dom/element';
import EventManager from './../../eventManager';
import { pageY } from './../../helpers/dom/event';
import { registerPlugin } from './../../plugins';

// Developer note! Whenever you make a change in this file, make an analogous change in manualColumnResize.ts

/**
 * @description
 * This plugin allows to change rows height. To make rows height persistent the {@link Options#persistentState}
 * plugin should be enabled.
 *
 * The plugin creates additional components to make resizing possibly using user interface:
 * - handle - the draggable element that sets the desired height of the row.
 * - guide - the helper guide that shows the desired height as a horizontal guide.
 *
 * @plugin ManualRowResize
 */
class ManualRowResize extends BasePlugin {
  /** The header the handle is on. */
  currentTH: HTMLTableCellElement | null = null;

  /** The row of that header. */
  currentRow: number | null = null;

  /** The rows that get the new height (the selected ones, when the handle is on one of them). */
  selectedRows: number[] = [];

  /** The height while dragging. */
  currentHeight: number | null = null;

  /** The height the rows get. */
  newSize: number | null = null;

  /** The mouse's position when dragging started. */
  startY: number | null = null;

  startHeight: number | null = null;

  startOffset: number | null = null;

  /** The draggable handle at the header's bottom edge. */
  handle: HTMLDivElement = document.createElement('DIV') as HTMLDivElement;

  /** The horizontal line that shows the new height while dragging. */
  guide: HTMLDivElement = document.createElement('DIV') as HTMLDivElement;

  eventManager: EventManager;

  /** Whether the handle is being dragged. */
  pressed = false;

  /** Mouse downs on the handle within half a second (two: a double click, which fits the height to the content). */
  dblclick = 0;

  autoresizeTimeout: ReturnType<typeof setTimeout> | null = null;

  /** The heights set by resizing, by physical row. */
  manualRowHeights: (number | undefined)[] = [];

  constructor(hotInstance: PluginHost) {
    super(hotInstance);
    this.eventManager = new EventManager(this);

    addClass(this.handle, 'manualRowResizer');
    addClass(this.guide, 'manualRowResizerGuide');
  }

  /**
   * Checks if the plugin is enabled in the FreeGrid settings. This method is executed in {@link Hooks#beforeInit}
   * hook and if it returns `true` than the {@link ManualRowResize#enablePlugin} method is called.
   */
  isEnabled(): boolean {
    return !!this.hot.getSettings().manualRowResize;
  }

  /**
   * Enables the plugin functionality for this FreeGrid instance.
   */
  enablePlugin(): void {
    if (this.enabled) {
      return;
    }
    const initialRowHeights = this.hot.getSettings().manualRowResize;
    const loadedManualRowHeights = this.loadManualRowHeights();

    if (loadedManualRowHeights !== undefined) {
      this.manualRowHeights = loadedManualRowHeights;
    } else if (Array.isArray(initialRowHeights)) {
      this.manualRowHeights = initialRowHeights;
    } else {
      this.manualRowHeights = [];
    }

    this.addHook('modifyRowHeight', (height: number, row: number) => this.onModifyRowHeight(height, row));

    this.bindEvents();

    super.enablePlugin();
  }

  /**
   * Updates the plugin state. This method is executed when {@link Core#updateSettings} is invoked.
   */
  updatePlugin(): void {
    const initialRowHeights = this.hot.getSettings().manualRowResize;

    if (Array.isArray(initialRowHeights)) {
      this.manualRowHeights = initialRowHeights;
    } else if (!initialRowHeights) {
      this.manualRowHeights = [];
    }
  }

  /**
   * Disables the plugin functionality for this FreeGrid instance.
   */
  disablePlugin(): void {
    super.disablePlugin();
  }

  /**
   * Saves the current sizes using the persistentState plugin (the {@link Options#persistentState} option has to be enabled).
   * @fires Hooks#persistentStateSave
   * @fires Hooks#manualRowHeights
   */
  saveManualRowHeights(): void {
    this.hot.runHooks('persistentStateSave', 'manualRowHeights', this.manualRowHeights);
  }

  /**
   * Loads the previously saved sizes using the persistentState plugin (the {@link Options#persistentState} option has to be enabled).
   *
   * @returns The saved heights, or `undefined`.
   * @fires Hooks#persistentStateLoad
   * @fires Hooks#manualRowHeights
   */
  loadManualRowHeights(): (number | undefined)[] | undefined {
    const storedState: { value?: (number | undefined)[] } = {};

    this.hot.runHooks('persistentStateLoad', 'manualRowHeights', storedState);

    return storedState.value;
  }

  /**
   * Sets the resize handle position.
   *
   * @private
   * @param TH TH HTML element.
   */
  setupHandlePosition(TH: HTMLTableCellElement): void {
    this.currentTH = TH;

    const { row } = this.hot.view.wt.wtTable.getCoords(TH)!;
    const headerWidth = outerWidth(this.currentTH);

    // A column header has a negative row.
    if (row < 0) {
      return;
    }
    const box = this.currentTH.getBoundingClientRect();

    this.currentRow = row;
    this.selectedRows = [row];

    if (this.hot.selection.isSelected() && this.hot.selection.isSelectedByRowHeader()) {
      const { from, to } = this.hot.getSelectedRangeLast()!;
      const start = Math.min(from.row, to.row);
      const end = Math.max(from.row, to.row);

      if (row >= start && row <= end) {
        this.selectedRows = Array.from({ length: end - start + 1 }, (_, index) => start + index);
      }
    }

    this.startOffset = box.top - 6;
    this.startHeight = Math.trunc(box.height);
    this.handle.style.left = `${box.left}px`;
    this.handle.style.top = `${this.startOffset + this.startHeight}px`;
    this.handle.style.width = `${headerWidth}px`;
    this.hot.rootElement.appendChild(this.handle);
  }

  /**
   * Refresh the resize handle position.
   *
   * @private
   */
  refreshHandlePosition(): void {
    this.handle.style.top = `${this.startOffset! + this.currentHeight!}px`;
  }

  /**
   * Sets the resize guide position.
   *
   * @private
   */
  setupGuidePosition(): void {
    const handleWidth = Math.trunc(outerWidth(this.handle));
    const handleRightPosition = parseInt(this.handle.style.left, 10) + handleWidth;
    const maximumVisibleElementWidth = Math.trunc(this.hot.view.maximumVisibleElementWidth(0));

    addClass(this.handle, 'active');
    addClass(this.guide, 'active');

    this.guide.style.top = this.handle.style.top;
    this.guide.style.left = `${handleRightPosition}px`;
    this.guide.style.width = `${maximumVisibleElementWidth - handleWidth}px`;
    this.hot.rootElement.appendChild(this.guide);
  }

  /**
   * Refresh the resize guide position.
   *
   * @private
   */
  refreshGuidePosition(): void {
    this.guide.style.top = this.handle.style.top;
  }

  /**
   * Hides both the resize handle and resize guide.
   *
   * @private
   */
  hideHandleAndGuide(): void {
    removeClass(this.handle, 'active');
    removeClass(this.guide, 'active');
  }

  /**
   * Checks if provided element is considered as a row header.
   *
   * @private
   * @param element HTML element.
   */
  checkIfRowHeader(element: HTMLElement): boolean {
    for (let current = element; current !== this.hot.rootElement && current.parentElement;) {
      current = current.parentElement;

      if (current.tagName === 'TBODY') {
        return true;
      }
    }

    return false;
  }

  /**
   * Gets the TH element from the provided element.
   *
   * @private
   * @param element HTML element.
   */
  getTHFromTargetElement(element: HTMLElement): HTMLTableCellElement | null {
    for (let current: HTMLElement | null = element; current && current.tagName !== 'TABLE'; current = current.parentElement) {
      if (current.tagName === 'TH') {
        return current as HTMLTableCellElement;
      }
    }

    return null;
  }

  /**
   * 'mouseover' event callback - set the handle position.
   *
   * @private
   */
  onMouseOver(event: MouseEvent): void {
    const target = event.target as HTMLElement;

    if (!this.checkIfRowHeader(target)) {
      return;
    }
    const th = this.getTHFromTargetElement(target);

    if (th && !this.pressed) {
      this.setupHandlePosition(th);
    }
  }

  /**
   * After a double click on the handle: fits the rows to their content.
   *
   * @private
   * @fires Hooks#beforeRowResize
   * @fires Hooks#afterRowResize
   */
  afterMouseDownTimeout(): void {
    if (this.dblclick >= 2) {
      this.#resizeSelected((selectedRow) => {
        const hookNewSize = this.hot.runHooks('beforeRowResize', selectedRow, this.newSize, true);

        if (hookNewSize !== undefined) {
          this.newSize = hookNewSize;
        }
        // The new size comes from the autoRowSize plugin (through beforeRowResize).
        this.setManualSize(selectedRow, this.newSize!);
      }, (selectedRow) => {
        this.hot.runHooks('afterRowResize', selectedRow, this.newSize, true);
      });
    }
    this.dblclick = 0;
    this.autoresizeTimeout = null;
  }

  /**
   * 'mousedown' event callback.
   *
   * @private
   */
  onMouseDown(event: MouseEvent): void {
    if (!hasClass(event.target as HTMLElement, 'manualRowResizer')) {
      return;
    }
    this.setupGuidePosition();
    this.pressed = true;

    if (this.autoresizeTimeout === null) {
      this.autoresizeTimeout = setTimeout(() => this.afterMouseDownTimeout(), 500);
      this.hot._registerTimeout(this.autoresizeTimeout);
    }
    this.dblclick += 1;
    this.startY = pageY(event);
    this.newSize = this.startHeight;
  }

  /**
   * 'mousemove' event callback - refresh the handle and guide positions, cache the new row height.
   *
   * @private
   */
  onMouseMove(event: MouseEvent): void {
    if (!this.pressed) {
      return;
    }
    this.currentHeight = this.startHeight! + (pageY(event) - this.startY!);
    this.selectedRows.forEach((selectedRow) => {
      this.newSize = this.setManualSize(selectedRow, this.currentHeight!);
    });

    this.refreshHandlePosition();
    this.refreshGuidePosition();
  }

  /**
   * 'mouseup' event callback - apply the row resizing.
   *
   * @private
   *
   * @fires Hooks#beforeRowResize
   * @fires Hooks#afterRowResize
   */
  onMouseUp(): void {
    if (!this.pressed) {
      return;
    }
    this.hideHandleAndGuide();
    this.pressed = false;

    if (this.newSize !== this.startHeight) {
      this.#resizeSelected((selectedRow) => {
        this.hot.runHooks('beforeRowResize', selectedRow, this.newSize);
      }, (selectedRow) => {
        this.saveManualRowHeights();
        this.hot.runHooks('afterRowResize', selectedRow, this.newSize, false);
      });
    }

    this.setupHandlePosition(this.currentTH!);
  }

  /**
   * Binds the mouse events.
   *
   * @private
   */
  bindEvents(): void {
    this.eventManager.addEventListener(this.hot.rootElement, 'mouseover', (event: MouseEvent) => this.onMouseOver(event));
    this.eventManager.addEventListener(this.hot.rootElement, 'mousedown', (event: MouseEvent) => this.onMouseDown(event));
    this.eventManager.addEventListener(window, 'mousemove', (event: MouseEvent) => this.onMouseMove(event));
    this.eventManager.addEventListener(window, 'mouseup', () => this.onMouseUp());
  }

  /**
   * Sets the new height for specified row index.
   *
   * @param row Visual row index.
   * @param height Row height.
   * @returns Returns new height.
   *
   * @fires Hooks#modifyRow
   */
  setManualSize(row: number, height: number): number {
    const physicalRow = this.hot.runHooks('modifyRow', row);

    this.manualRowHeights[physicalRow] = height;

    return height;
  }

  /**
   * Modifies the provided row height, based on the plugin settings.
   *
   * @private
   * @param height Row height.
   * @param row Visual row index.
   *
   * @fires Hooks#modifyRow
   */
  onModifyRowHeight(height: number, row: number): number {
    if (!this.enabled) {
      return height;
    }
    const autoRowSizePlugin = this.hot.getPlugin('autoRowSize');
    const autoRowHeightResult = autoRowSizePlugin ? autoRowSizePlugin.heights[row] : null;
    const manualRowHeight = this.manualRowHeights[this.hot.runHooks('modifyRow', row)];

    // A height set by resizing wins unless the row's content needs more.
    if (manualRowHeight !== undefined && (manualRowHeight === autoRowHeightResult || manualRowHeight > (height || 0))) {
      return manualRowHeight;
    }

    return height;
  }

  /**
   * Resizes each selected row with `resize` and calls `after` for it; renders the grid after the row (one row) or after
   * all of them.
   */
  #resizeSelected(resize: (row: number) => void, after: (row: number) => void): void {
    const single = this.selectedRows.length === 1;
    const many = this.selectedRows.length > 1;

    this.selectedRows.forEach((selectedRow) => {
      resize(selectedRow);

      if (single) {
        this.#renderAll();
      }
      after(selectedRow);
    });
    if (many) {
      this.#renderAll();
    }
  }

  #renderAll(): void {
    this.hot.forceFullRender = true;
    this.hot.view.render();
    this.hot.view.wt.wtOverlays.adjustElementsSize(true);
  }
}

registerPlugin('manualRowResize', ManualRowResize);

export default ManualRowResize;
