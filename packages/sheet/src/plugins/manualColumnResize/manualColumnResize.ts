import BasePlugin from './../_base';
import type { PluginHost } from './../_base';
import { addClass, hasClass, removeClass, outerHeight } from './../../helpers/dom/element';
import EventManager from './../../eventManager';
import { pageX } from './../../helpers/dom/event';
import { registerPlugin } from './../../plugins';

// Developer note! Whenever you make a change in this file, make an analogous change in manualRowResize.ts

/**
 * @description
 * This plugin allows to change columns width. To make columns width persistent the {@link Options#persistentState}
 * plugin should be enabled.
 *
 * The plugin creates additional components to make resizing possibly using user interface:
 * - handle - the draggable element that sets the desired width of the column.
 * - guide - the helper guide that shows the desired width as a vertical guide.
 *
 * @plugin ManualColumnResize
 */
class ManualColumnResize extends BasePlugin {
  /** The header the handle is on. */
  currentTH: HTMLTableCellElement | null = null;

  /** The column of that header. */
  currentCol: number | null = null;

  /** The columns that get the new width (the selected ones, when the handle is on one of them). */
  selectedCols: number[] = [];

  /** The width while dragging. */
  currentWidth: number | null = null;

  /** The width the columns get. */
  newSize: number | null = null;

  /** The mouse's position when dragging started. */
  startX: number | null = null;

  startWidth: number | null = null;

  startOffset: number | null = null;

  /** The draggable handle at the header's right edge. */
  handle: HTMLDivElement = document.createElement('DIV') as HTMLDivElement;

  /** The vertical line that shows the new width while dragging. */
  guide: HTMLDivElement = document.createElement('DIV') as HTMLDivElement;

  eventManager: EventManager;

  /** Whether the handle is being dragged. */
  pressed = false;

  /** Mouse downs on the handle within half a second (two: a double click, which fits the width to the content). */
  dblclick = 0;

  autoresizeTimeout: ReturnType<typeof setTimeout> | null = null;

  /** The widths set by resizing, by physical column. */
  manualColumnWidths: (number | undefined)[] = [];

  constructor(hotInstance: PluginHost) {
    super(hotInstance);
    this.eventManager = new EventManager(this);

    addClass(this.handle, 'manualColumnResizer');
    addClass(this.guide, 'manualColumnResizerGuide');
  }

  /**
   * Checks if the plugin is enabled in the FreeSheet settings. This method is executed in {@link Hooks#beforeInit}
   * hook and if it returns `true` than the {@link ManualColumnResize#enablePlugin} method is called.
   */
  isEnabled(): boolean {
    return !!this.hot.getSettings().manualColumnResize;
  }

  /**
   * Enables the plugin functionality for this FreeSheet instance.
   */
  enablePlugin(): void {
    if (this.enabled) {
      return;
    }
    const initialColumnWidth = this.hot.getSettings().manualColumnResize;
    const loadedManualColumnWidths = this.loadManualColumnWidths();

    this.addHook('modifyColWidth', (width: number, col: number) => this.onModifyColWidth(width, col));
    this.addHook('beforeStretchingColumnWidth',
      (stretchedWidth: number, column: number) => this.onBeforeStretchingColumnWidth(stretchedWidth, column));
    this.addHook('beforeColumnResize', () => this.onBeforeColumnResize());

    if (loadedManualColumnWidths !== undefined) {
      this.manualColumnWidths = loadedManualColumnWidths;
    } else if (Array.isArray(initialColumnWidth)) {
      this.manualColumnWidths = initialColumnWidth;
    } else {
      this.manualColumnWidths = [];
    }

    this.bindEvents();

    super.enablePlugin();
  }

  /**
   * Updates the plugin state. This method is executed when {@link Core#updateSettings} is invoked.
   */
  updatePlugin(): void {
    const initialColumnWidth = this.hot.getSettings().manualColumnResize;

    if (Array.isArray(initialColumnWidth)) {
      this.manualColumnWidths = initialColumnWidth;
    } else if (!initialColumnWidth) {
      this.manualColumnWidths = [];
    }
  }

  /**
   * Disables the plugin functionality for this FreeSheet instance.
   */
  disablePlugin(): void {
    super.disablePlugin();
  }

  /**
   * Saves the current sizes using the persistentState plugin (the {@link Options#persistentState} option has to be enabled).
   */
  saveManualColumnWidths(): void {
    this.hot.runHooks('persistentStateSave', 'manualColumnWidths', this.manualColumnWidths);
  }

  /**
   * Loads the previously saved sizes using the persistentState plugin (the {@link Options#persistentState} option has to be enabled).
   *
   * @returns The saved widths, or `undefined`.
   *
   * @fires Hooks#persistentStateLoad
   * @fires Hooks#manualColumnWidths
   */
  loadManualColumnWidths(): (number | undefined)[] | undefined {
    const storedState: { value?: (number | undefined)[] } = {};

    this.hot.runHooks('persistentStateLoad', 'manualColumnWidths', storedState);

    return storedState.value;
  }

  /**
   * Set the resize handle position.
   *
   * @private
   * @param TH TH HTML element.
   */
  setupHandlePosition(TH: HTMLTableCellElement): void {
    if (!TH.parentNode) {
      return;
    }
    this.currentTH = TH;

    const { col } = this.hot.view.wt.wtTable.getCoords(TH)!;
    const headerHeight = outerHeight(this.currentTH);

    // A row header has a negative column.
    if (col < 0) {
      return;
    }
    const box = this.currentTH.getBoundingClientRect();

    this.currentCol = col;
    this.selectedCols = [col];

    if (this.hot.selection.isSelected() && this.hot.selection.isSelectedByColumnHeader()) {
      const { from, to } = this.hot.getSelectedRangeLast()!;
      const start = Math.min(from.col, to.col);
      const end = Math.max(from.col, to.col);

      if (col >= start && col <= end) {
        this.selectedCols = Array.from({ length: end - start + 1 }, (_, index) => start + index);
      }
    }

    this.startOffset = box.left - 6;
    this.startWidth = Math.trunc(box.width);
    this.handle.style.top = `${box.top}px`;
    this.handle.style.left = `${this.startOffset + this.startWidth}px`;
    this.handle.style.height = `${headerHeight}px`;
    this.hot.rootElement.appendChild(this.handle);
  }

  /**
   * Refresh the resize handle position.
   *
   * @private
   */
  refreshHandlePosition(): void {
    this.handle.style.left = `${this.startOffset! + this.currentWidth!}px`;
  }

  /**
   * Sets the resize guide position.
   *
   * @private
   */
  setupGuidePosition(): void {
    const handleHeight = Math.trunc(outerHeight(this.handle));
    const handleBottomPosition = parseInt(this.handle.style.top, 10) + handleHeight;
    const maximumVisibleElementHeight = Math.trunc(this.hot.view.maximumVisibleElementHeight(0));

    addClass(this.handle, 'active');
    addClass(this.guide, 'active');

    this.guide.style.top = `${handleBottomPosition}px`;
    this.guide.style.left = this.handle.style.left;
    this.guide.style.height = `${maximumVisibleElementHeight - handleHeight}px`;
    this.hot.rootElement.appendChild(this.guide);
  }

  /**
   * Refresh the resize guide position.
   *
   * @private
   */
  refreshGuidePosition(): void {
    this.guide.style.left = this.handle.style.left;
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
   * Checks if provided element is considered a column header.
   *
   * @private
   * @param element HTML element.
   */
  checkIfColumnHeader(element: HTMLElement): boolean {
    for (let current = element; current !== this.hot.rootElement && current.parentElement;) {
      current = current.parentElement;

      if (current.tagName === 'THEAD') {
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

    if (!this.checkIfColumnHeader(target)) {
      return;
    }
    const th = this.getTHFromTargetElement(target);
    const colspan = th?.getAttribute('colspan');

    // Headers over several columns have no handle.
    if (th && (colspan === null || colspan === '1') && !this.pressed) {
      this.setupHandlePosition(th);
    }
  }

  /**
   * After a double click on the handle: fits the columns to their content.
   *
   * @private
   *
   * @fires Hooks#beforeColumnResize
   * @fires Hooks#afterColumnResize
   */
  afterMouseDownTimeout(): void {
    if (this.dblclick >= 2) {
      this.#resizeSelected((selectedCol) => {
        const hookNewSize = this.hot.runHooks('beforeColumnResize', selectedCol, this.newSize, true);

        if (hookNewSize !== undefined) {
          this.newSize = hookNewSize;
        }
        if (this.hot.getSettings().stretchH === 'all') {
          this.clearManualSize(selectedCol);
        } else {
          // The new size comes from the autoColumnSize plugin (through beforeColumnResize).
          this.setManualSize(selectedCol, this.newSize!);
        }
      }, true);
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
    if (!hasClass(event.target as HTMLElement, 'manualColumnResizer')) {
      return;
    }
    this.setupGuidePosition();
    this.pressed = true;

    if (this.autoresizeTimeout === null) {
      this.autoresizeTimeout = setTimeout(() => this.afterMouseDownTimeout(), 500);
      this.hot._registerTimeout(this.autoresizeTimeout);
    }
    this.dblclick += 1;

    this.startX = pageX(event);
    this.newSize = this.startWidth;
  }

  /**
   * 'mousemove' event callback - refresh the handle and guide positions, cache the new column width.
   *
   * @private
   */
  onMouseMove(event: MouseEvent): void {
    if (!this.pressed) {
      return;
    }
    this.currentWidth = this.startWidth! + (pageX(event) - this.startX!);
    this.selectedCols.forEach((selectedCol) => {
      this.newSize = this.setManualSize(selectedCol, this.currentWidth!);
    });

    this.refreshHandlePosition();
    this.refreshGuidePosition();
  }

  /**
   * 'mouseup' event callback - apply the column resizing.
   *
   * @private
   *
   * @fires Hooks#beforeColumnResize
   * @fires Hooks#afterColumnResize
   */
  onMouseUp(): void {
    if (!this.pressed) {
      return;
    }
    this.hideHandleAndGuide();
    this.pressed = false;

    if (this.newSize !== this.startWidth) {
      this.#resizeSelected((selectedCol) => {
        this.hot.runHooks('beforeColumnResize', selectedCol, this.newSize, false);
      }, false);
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
   * Sets the new width for specified column index.
   *
   * @param column Visual column index.
   * @param width Column width (no less than 20px).
   * @returns Returns new width.
   */
  setManualSize(column: number, width: number): number {
    const newWidth = Math.max(width, 20);
    // The physical column: the order may differ from the data source's (e.g. after manualColumnMove).
    const physicalColumn = this.hot.toPhysicalColumn(column);

    this.manualColumnWidths[physicalColumn] = newWidth;

    return newWidth;
  }

  /**
   * Clears the cache for the specified column index.
   *
   * @param column Visual column index.
   */
  clearManualSize(column: number): void {
    const physicalColumn = this.hot.toPhysicalColumn(column);

    this.manualColumnWidths[physicalColumn] = undefined;
  }

  /**
   * Modifies the provided column width, based on the plugin settings
   *
   * @private
   * @param width Column width.
   * @param column Visual column index.
   */
  onModifyColWidth(width: number, column: number): number {
    if (!this.enabled || !this.hot.getSettings().manualColumnResize) {
      return width;
    }
    const columnWidth = this.manualColumnWidths[this.hot.toPhysicalColumn(column)];

    return columnWidth || width;
  }

  /**
   * Modifies the provided column stretched width. This hook decides if specified column should be stretched or not.
   *
   * @private
   * @param stretchedWidth Stretched width.
   * @param column Physical column index.
   */
  onBeforeStretchingColumnWidth(stretchedWidth: number, column: number): number {
    const width = this.manualColumnWidths[column];

    return width === undefined ? stretchedWidth : width;
  }

  /**
   * `beforeColumnResize` hook callback.
   *
   * @private
   */
  onBeforeColumnResize(): void {
    // clear the header height cache information
    this.hot.view.wt.wtViewport.hasOversizedColumnHeadersMarked = {};
  }

  /**
   * Resizes each selected column with `resize`, saves the widths, runs `afterColumnResize` and renders the grid
   * (once, after all of them).
   */
  #resizeSelected(resize: (column: number) => void, isDoubleClick: boolean): void {
    const single = this.selectedCols.length === 1;
    const many = this.selectedCols.length > 1;

    this.selectedCols.forEach((selectedCol) => {
      resize(selectedCol);

      if (single) {
        this.#renderAll();
      }
      this.saveManualColumnWidths();

      if (isDoubleClick) {
        this.hot.runHooks('afterColumnResize', selectedCol, this.newSize, true);
      } else {
        this.hot.runHooks('afterColumnResize', selectedCol, this.newSize);
      }
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

registerPlugin('manualColumnResize', ManualColumnResize);

export default ManualColumnResize;
