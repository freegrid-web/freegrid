import { withLegacyClassNames } from './../../../helpers/classNames';
import {
  addClass,
  hasClass,
  removeClass,
  getComputedStyle,
  getTrimmingContainer,
  innerWidth,
  innerHeight,
  offset,
  outerHeight,
  outerWidth,
} from './../../../helpers/dom/element';
import { stopImmediatePropagation } from './../../../helpers/dom/event';
import { objectEach } from './../../../helpers/object';
import { isMobileBrowser } from './../../../helpers/browser';
import EventManager from './../../../eventManager';
import CellCoords from './cell/coords';
import type Walkontable from './core';
import type { ExtendedEvent } from './../../../eventManager';

/** Border fragments that custom borders can style individually. */
export type BorderSide = 'top' | 'left' | 'bottom' | 'right';
type SideStyle = { hide?: boolean; color?: string; width?: number };
export type BorderSettings = Partial<Record<BorderSide | 'corner', SideStyle>> & {
  className?: string;
  layerLevel?: number;
  border: { color: string; width: number; cornerVisible?: boolean | ((layerLevel?: number) => boolean) };
};
type BorderEngine = Walkontable & { wtTable: Walkontable['wtTable'] & { bordersHolder?: HTMLDivElement } };
// The JavaScript table has a narrower inferred row-header signature than its callers use.
type HeaderGetter = (index: number, level?: number) => HTMLTableCellElement | null | undefined;
type HandlePosition = 'topLeft' | 'topLeftHitArea' | 'bottomRight' | 'bottomRightHitArea';
type SelectionHandles = Record<HandlePosition, HTMLElement> & { styles: Record<HandlePosition, CSSStyleDeclaration> };

/**
 *
 */
class Border {
  #eventManager!: EventManager;
  #mouseDown!: boolean;
  #wot!: BorderEngine;
  #settings!: BorderSettings;
  #main!: HTMLDivElement;
  // The constructor creates these fragments before registering listeners or drawing.
  declare top: HTMLDivElement;
  declare left: HTMLDivElement;
  declare bottom: HTMLDivElement;
  declare right: HTMLDivElement;
  declare corner: HTMLDivElement;
  #topStyle!: CSSStyleDeclaration;
  #leftStyle!: CSSStyleDeclaration;
  #bottomStyle!: CSSStyleDeclaration;
  #rightStyle!: CSSStyleDeclaration;
  #cornerStyle!: CSSStyleDeclaration;
  #cornerDefaultStyle!: { width: string; height: string; borderWidth: string; borderStyle: string; borderColor: string };
  #selectionHandles!: SelectionHandles;
  declare disabled?: boolean;

  /**
   * @param {Walkontable} wotInstance
   * @param {Object} settings
   */
  constructor(wotInstance: Walkontable, settings?: BorderSettings) {
    if (!settings) {
      return;
    }
    this.#eventManager = new EventManager(wotInstance);
    this.#wot = wotInstance as BorderEngine;
    this.#settings = settings;
    this.#mouseDown = false;
    this.#main = null!;

    this.top = null!;
    this.left = null!;
    this.bottom = null!;
    this.right = null!;

    this.#topStyle = null!;
    this.#leftStyle = null!;
    this.#bottomStyle = null!;
    this.#rightStyle = null!;

    this.#cornerDefaultStyle = {
      width: '6px',
      height: '6px',
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: 'var(--fs-fill-handle-border-color)', // see src/css/variables.css
    };
    this.corner = null!;
    this.#cornerStyle = null!;

    this.createBorders(settings);
    this.registerListeners();
  }

  /**
   * Register all necessary events
   */
  registerListeners() {
    this.#eventManager.addEventListener(document.body, 'mousedown', () => this.onMouseDown());
    this.#eventManager.addEventListener(document.body, 'mouseup', () => this.onMouseUp());

    for (let c = 0, len = this.#main.childNodes.length; c < len; c++) {
      this.#eventManager.addEventListener(this.#main.childNodes[c], 'mouseenter', event => this.onMouseEnter(event, this.#main.childNodes[c] as HTMLElement));
    }
  }

  /**
   * Mouse down listener
   *
   * @private
   */
  onMouseDown() {
    this.#mouseDown = true;
  }

  /**
   * Mouse up listener
   *
   * @private
   */
  onMouseUp() {
    this.#mouseDown = false;
  }

  /**
   * Mouse enter listener for fragment selection functionality.
   *
   * @private
   * @param {Event} event Dom event
   * @param {HTMLElement} parentElement Part of border element.
   */
  onMouseEnter(event: ExtendedEvent, parentElement: HTMLElement) {
    if (!this.#mouseDown || !this.#wot.getSetting('hideBorderOnMouseDownOver')) {
      return;
    }
    event.preventDefault();
    stopImmediatePropagation(event);

    const bounds = parentElement.getBoundingClientRect();
    // Hide border to prevents selection jumping when fragmentSelection is enabled.
    parentElement.style.display = 'none';

    const isOutside = (mouseEvent: MouseEvent) => {
      if (mouseEvent.clientY < Math.floor(bounds.top)) {
        return true;
      }
      if (mouseEvent.clientY > Math.ceil(bounds.top + bounds.height)) {
        return true;
      }
      if (mouseEvent.clientX < Math.floor(bounds.left)) {
        return true;
      }
      if (mouseEvent.clientX > Math.ceil(bounds.left + bounds.width)) {
        return true;
      }
    };

    const handler = (handlerEvent: MouseEvent) => {
      if (isOutside(handlerEvent)) {
        this.#eventManager.removeEventListener(document.body, 'mousemove', handler);
        parentElement.style.display = 'block';
      }
    };

    this.#eventManager.addEventListener(document.body, 'mousemove', handler);
  }

  /**
   * Create border elements
   *
   * @param {Object} settings
   */
  createBorders(settings: BorderSettings) {
    this.#main = document.createElement('div');

    const borderDivs: (BorderSide | 'corner')[] = ['top', 'left', 'bottom', 'right', 'corner'];
    let style = this.#main.style;
    style.position = 'absolute';
    // Keep the original numeric CSS writes and let the DOM perform the coercion.
    style.top = 0 as unknown as string;
    style.left = 0 as unknown as string;

    for (let i = 0; i < 5; i++) {
      const position = borderDivs[i];
      const div = document.createElement('div');

      div.className = `${withLegacyClassNames('fs-selection-border')} ${this.#settings.className || ''}`; // + borderDivs[i];

      if (this.#settings[position] && this.#settings[position]!.hide) {
        div.className += ' hidden';
      }
      style = div.style;
      style.backgroundColor = ((this.#settings[position] && this.#settings[position]!.color) ? this.#settings[position]!.color : settings.border.color) as string;
      style.height = (this.#settings[position] && this.#settings[position]!.width) ? `${this.#settings[position]!.width}px` : `${settings.border.width}px`;
      style.width = (this.#settings[position] && this.#settings[position]!.width) ? `${this.#settings[position]!.width}px` : `${settings.border.width}px`;

      this.#main.appendChild(div);
    }
    this.top = this.#main.childNodes[0] as HTMLDivElement;
    this.left = this.#main.childNodes[1] as HTMLDivElement;
    this.bottom = this.#main.childNodes[2] as HTMLDivElement;
    this.right = this.#main.childNodes[3] as HTMLDivElement;

    this.#topStyle = this.top.style;
    this.#leftStyle = this.left.style;
    this.#bottomStyle = this.bottom.style;
    this.#rightStyle = this.right.style;

    this.corner = this.#main.childNodes[4] as HTMLDivElement;
    this.corner.className += ' corner';
    this.#cornerStyle = this.corner.style;
    this.#cornerStyle.width = this.#cornerDefaultStyle.width;
    this.#cornerStyle.height = this.#cornerDefaultStyle.height;
    this.#cornerStyle.border = [
      this.#cornerDefaultStyle.borderWidth,
      this.#cornerDefaultStyle.borderStyle,
      this.#cornerDefaultStyle.borderColor
    ].join(' ');

    if (isMobileBrowser()) {
      this.createMultipleSelectorHandles();
    }
    this.disappear();

    let bordersHolder = this.#wot.wtTable.bordersHolder;

    if (!bordersHolder) {
      bordersHolder = document.createElement('div');
      bordersHolder.className = withLegacyClassNames('fs-borders');
      this.#wot.wtTable.bordersHolder = bordersHolder;
      this.#wot.wtTable.spreader.appendChild(bordersHolder);
    }
    bordersHolder.appendChild(this.#main);
  }

  /**
   * Create multiple selector handler for mobile devices
   */
  createMultipleSelectorHandles() {
    this.#selectionHandles = {
      topLeft: document.createElement('DIV'),
      topLeftHitArea: document.createElement('DIV'),
      bottomRight: document.createElement('DIV'),
      bottomRightHitArea: document.createElement('DIV')
    } as SelectionHandles;
    const width = 10;
    const hitAreaWidth = 40;

    this.#selectionHandles.topLeft.className = 'topLeftSelectionHandle';
    this.#selectionHandles.topLeftHitArea.className = 'topLeftSelectionHandle-HitArea';
    this.#selectionHandles.bottomRight.className = 'bottomRightSelectionHandle';
    this.#selectionHandles.bottomRightHitArea.className = 'bottomRightSelectionHandle-HitArea';

    this.#selectionHandles.styles = {
      topLeft: this.#selectionHandles.topLeft.style,
      topLeftHitArea: this.#selectionHandles.topLeftHitArea.style,
      bottomRight: this.#selectionHandles.bottomRight.style,
      bottomRightHitArea: this.#selectionHandles.bottomRightHitArea.style
    };

    const hitAreaStyle = {
      position: 'absolute',
      height: `${hitAreaWidth}px`,
      width: `${hitAreaWidth}px`,
      'border-radius': `${parseInt((hitAreaWidth / 1.5) as unknown as string, 10)}px`,
    };

    objectEach(hitAreaStyle, (value, key) => {
      (this.#selectionHandles.styles.bottomRightHitArea as unknown as Record<string, string>)[key] = value;
      (this.#selectionHandles.styles.topLeftHitArea as unknown as Record<string, string>)[key] = value;
    });

    const handleStyle = {
      position: 'absolute',
      height: `${width}px`,
      width: `${width}px`,
      'border-radius': `${parseInt((width / 1.5) as unknown as string, 10)}px`,
      background: 'var(--fs-mobile-handle-background)',
      border: '1px solid var(--fs-mobile-handle-border-color)',
    };

    objectEach(handleStyle, (value, key) => {
      (this.#selectionHandles.styles.bottomRight as unknown as Record<string, string>)[key] = value;
      (this.#selectionHandles.styles.topLeft as unknown as Record<string, string>)[key] = value;
    });

    this.#main.appendChild(this.#selectionHandles.topLeft);
    this.#main.appendChild(this.#selectionHandles.bottomRight);
    this.#main.appendChild(this.#selectionHandles.topLeftHitArea);
    this.#main.appendChild(this.#selectionHandles.bottomRightHitArea);
  }

  isPartRange(row: number | undefined, col: number | undefined) {
    const areaSelection = this.#wot.selections.createOrGetArea();

    if (areaSelection.cellRange) {
      if (row !== areaSelection.cellRange.to.row || col !== areaSelection.cellRange.to.col) {
        return true;
      }
    }

    return false;
  }

  updateMultipleSelectionHandlesPosition(row: number | undefined, col: number | undefined, top: number, left: number, width: number, height: number) {
    const handleWidth = parseInt(this.#selectionHandles.styles.topLeft.width, 10);
    const hitAreaWidth = parseInt(this.#selectionHandles.styles.topLeftHitArea.width, 10);

    this.#selectionHandles.styles.topLeft.top = `${parseInt((top - handleWidth) as unknown as string, 10)}px`;
    this.#selectionHandles.styles.topLeft.left = `${parseInt((left - handleWidth) as unknown as string, 10)}px`;

    this.#selectionHandles.styles.topLeftHitArea.top = `${parseInt((top - ((hitAreaWidth / 4) * 3)) as unknown as string, 10)}px`;
    this.#selectionHandles.styles.topLeftHitArea.left = `${parseInt((left - ((hitAreaWidth / 4) * 3)) as unknown as string, 10)}px`;

    this.#selectionHandles.styles.bottomRight.top = `${parseInt((top + height) as unknown as string, 10)}px`;
    this.#selectionHandles.styles.bottomRight.left = `${parseInt((left + width) as unknown as string, 10)}px`;

    this.#selectionHandles.styles.bottomRightHitArea.top = `${parseInt((top + height - (hitAreaWidth / 4)) as unknown as string, 10)}px`;
    this.#selectionHandles.styles.bottomRightHitArea.left = `${parseInt((left + width - (hitAreaWidth / 4)) as unknown as string, 10)}px`;

    if (this.#settings.border.cornerVisible && (this.#settings.border.cornerVisible as () => boolean)()) {
      this.#selectionHandles.styles.topLeft.display = 'block';
      this.#selectionHandles.styles.topLeftHitArea.display = 'block';

      if (this.isPartRange(row, col)) {
        this.#selectionHandles.styles.bottomRight.display = 'none';
        this.#selectionHandles.styles.bottomRightHitArea.display = 'none';
      } else {
        this.#selectionHandles.styles.bottomRight.display = 'block';
        this.#selectionHandles.styles.bottomRightHitArea.display = 'block';
      }
    } else {
      this.#selectionHandles.styles.topLeft.display = 'none';
      this.#selectionHandles.styles.bottomRight.display = 'none';
      this.#selectionHandles.styles.topLeftHitArea.display = 'none';
      this.#selectionHandles.styles.bottomRightHitArea.display = 'none';
    }

    if (row === this.#wot.wtSettings.getSetting('fixedRowsTop') || col === this.#wot.wtSettings.getSetting('fixedColumnsLeft')) {
      this.#selectionHandles.styles.topLeft.zIndex = '9999';
      this.#selectionHandles.styles.topLeftHitArea.zIndex = '9999';
    } else {
      this.#selectionHandles.styles.topLeft.zIndex = '';
      this.#selectionHandles.styles.topLeftHitArea.zIndex = '';
    }
  }

  /**
   * Show border around one or many cells
   *
   * @param {Array} corners
   */
  appear(corners: [number, number, number, number]) {
    if (this.disabled) {
      return;
    }

    let fromRow: number | undefined;
    let toRow: number | undefined;
    let fromColumn: number | undefined;
    let toColumn: number | undefined;

    const rowsCount = this.#wot.wtTable.getRenderedRowsCount();

    for (let i = 0; i < rowsCount; i += 1) {
      const s = this.#wot.wtTable.rowFilter!.renderedToSource(i);

      if (s >= corners[0] && s <= corners[2]) {
        fromRow = s;
        break;
      }
    }

    for (let i = rowsCount - 1; i >= 0; i -= 1) {
      const s = this.#wot.wtTable.rowFilter!.renderedToSource(i);

      if (s >= corners[0] && s <= corners[2]) {
        toRow = s;
        break;
      }
    }

    const columnsCount = this.#wot.wtTable.getRenderedColumnsCount();

    for (let i = 0; i < columnsCount; i += 1) {
      const s = this.#wot.wtTable.columnFilter!.renderedToSource(i);

      if (s >= corners[1] && s <= corners[3]) {
        fromColumn = s;
        break;
      }
    }

    for (let i = columnsCount - 1; i >= 0; i -= 1) {
      const s = this.#wot.wtTable.columnFilter!.renderedToSource(i);

      if (s >= corners[1] && s <= corners[3]) {
        toColumn = s;
        break;
      }
    }
    if (fromRow === void 0 || fromColumn === void 0) {
      this.disappear();

      return;
    }
    let fromTD = this.#wot.wtTable.getCell(new CellCoords(fromRow, fromColumn)) as HTMLTableCellElement;
    const isMultiple = (fromRow !== toRow || fromColumn !== toColumn);
    const toTD = isMultiple ? this.#wot.wtTable.getCell(new CellCoords(toRow!, toColumn!)) as HTMLTableCellElement : fromTD;
    const fromOffset = offset(fromTD);
    const toOffset = isMultiple ? offset(toTD) : fromOffset;
    const containerOffset = offset(this.#wot.wtTable.TABLE);
    const minTop = fromOffset.top;
    const minLeft = fromOffset.left;

    let left = minLeft - containerOffset.left - 1;
    let width = toOffset.left + outerWidth(toTD) - minLeft;

    if (this.isEntireColumnSelected(fromRow, toRow)) {
      const modifiedValues = this.getDimensionsFromHeader('columns', fromColumn, toColumn!, containerOffset);
      let fromTH = null;

      if (modifiedValues) {
        [fromTH, left, width] = modifiedValues;
      }

      if (fromTH) {
        fromTD = fromTH;
      }
    }

    let top = minTop - containerOffset.top - 1;
    let height = toOffset.top + outerHeight(toTD) - minTop;

    if (this.isEntireRowSelected(fromColumn, toColumn)) {
      const modifiedValues = this.getDimensionsFromHeader('rows', fromRow, toRow!, containerOffset);
      let fromTH = null;

      if (modifiedValues) {
        [fromTH, top, height] = modifiedValues;
      }

      if (fromTH) {
        fromTD = fromTH;
      }
    }

    const style = getComputedStyle(fromTD);

    if (parseInt(style.borderTopWidth, 10) > 0) {
      top += 1;
      height = height > 0 ? height - 1 : 0;
    }
    if (parseInt(style.borderLeftWidth, 10) > 0) {
      left += 1;
      width = width > 0 ? width - 1 : 0;
    }

    this.#topStyle.top = `${top}px`;
    this.#topStyle.left = `${left}px`;
    this.#topStyle.width = `${width}px`;
    this.#topStyle.display = 'block';

    this.#leftStyle.top = `${top}px`;
    this.#leftStyle.left = `${left}px`;
    this.#leftStyle.height = `${height}px`;
    this.#leftStyle.display = 'block';

    const delta = Math.floor(this.#settings.border.width / 2);

    this.#bottomStyle.top = `${top + height - delta}px`;
    this.#bottomStyle.left = `${left}px`;
    this.#bottomStyle.width = `${width}px`;
    this.#bottomStyle.display = 'block';

    this.#rightStyle.top = `${top}px`;
    this.#rightStyle.left = `${left + width - delta}px`;
    this.#rightStyle.height = `${height + 1}px`;
    this.#rightStyle.display = 'block';

    let cornerVisibleSetting = this.#settings.border.cornerVisible;
    cornerVisibleSetting = typeof cornerVisibleSetting === 'function' ? cornerVisibleSetting(this.#settings.layerLevel) : cornerVisibleSetting;

    const hookResult = this.#wot.getSetting('onModifyGetCellCoords', toRow, toColumn);
    let [checkRow, checkCol] = [toRow, toColumn];

    if (hookResult && Array.isArray(hookResult)) {
      [,, checkRow, checkCol] = hookResult;
    }

    if (isMobileBrowser() || !cornerVisibleSetting || this.isPartRange(checkRow, checkCol)) {
      this.#cornerStyle.display = 'none';

    } else {
      this.#cornerStyle.top = `${top + height - 4}px`;
      this.#cornerStyle.left = `${left + width - 4}px`;
      this.#cornerStyle.borderRightWidth = this.#cornerDefaultStyle.borderWidth;
      this.#cornerStyle.width = this.#cornerDefaultStyle.width;

      // Hide the fill handle, so the possible further adjustments won't force unneeded scrollbars.
      this.#cornerStyle.display = 'none';

      let trimmingContainer = getTrimmingContainer(this.#wot.wtTable.TABLE);
      const trimToWindow = trimmingContainer === window;

      if (trimToWindow) {
        trimmingContainer = document.documentElement;
      }

      if (toColumn === this.#wot.getSetting('totalColumns') - 1) {
        const toTdOffsetLeft = trimToWindow ? toTD.getBoundingClientRect().left : toTD.offsetLeft;
        const cornerRightEdge = toTdOffsetLeft + outerWidth(toTD) + (parseInt(this.#cornerDefaultStyle.width, 10) / 2);
        const cornerOverlappingContainer = cornerRightEdge >= innerWidth(trimmingContainer as HTMLElement);

        if (cornerOverlappingContainer) {
          this.#cornerStyle.left = `${Math.floor(left + width - 3 - (parseInt(this.#cornerDefaultStyle.width, 10) / 2))}px`;
          this.#cornerStyle.borderRightWidth = 0 as unknown as string;
        }
      }

      if (toRow === this.#wot.getSetting('totalRows') - 1) {
        const toTdOffsetTop = trimToWindow ? toTD.getBoundingClientRect().top : toTD.offsetTop;
        const cornerBottomEdge = toTdOffsetTop + outerHeight(toTD) + (parseInt(this.#cornerDefaultStyle.height, 10) / 2);
        const cornerOverlappingContainer = cornerBottomEdge >= innerHeight(trimmingContainer as HTMLElement);

        if (cornerOverlappingContainer) {
          this.#cornerStyle.top = `${Math.floor(top + height - 3 - (parseInt(this.#cornerDefaultStyle.height, 10) / 2))}px`;
          this.#cornerStyle.borderBottomWidth = 0 as unknown as string;
        }
      }

      this.#cornerStyle.display = 'block';
    }

    if (isMobileBrowser()) {
      this.updateMultipleSelectionHandlesPosition(toRow, toColumn, top, left, width, height);
    }
  }

  /**
   * Check whether an entire column of cells is selected.
   *
   * @private
   * @param {Number} startRowIndex Start row index.
   * @param {Number} endRowIndex End row index.
   */
  isEntireColumnSelected(startRowIndex: number, endRowIndex: number | undefined) {
    return startRowIndex === this.#wot.wtTable.getFirstRenderedRow() && endRowIndex === this.#wot.wtTable.getLastRenderedRow();
  }

  /**
   * Check whether an entire row of cells is selected.
   *
   * @private
   * @param {Number} startColumnIndex Start column index.
   * @param {Number} endColumnIndex End column index.
   */
  isEntireRowSelected(startColumnIndex: number, endColumnIndex: number | undefined) {
    return startColumnIndex === this.#wot.wtTable.getFirstRenderedColumn() && endColumnIndex === this.#wot.wtTable.getLastRenderedColumn();
  }

  /**
   * Get left/top index and width/height depending on the `direction` provided.
   *
   * @private
   * @param {String} direction `rows` or `columns`, defines if an entire column or row is selected.
   * @param {Number} fromIndex Start index of the selection.
   * @param {Number} toIndex End index of the selection.
   * @param {Number} containerOffset offset of the container.
   * @return {Array|Boolean} Returns an array of [headerElement, left, width] or [headerElement, top, height], depending on `direction` (`false` in case of an error getting the headers).
   */
  getDimensionsFromHeader(direction: 'rows' | 'columns', fromIndex: number, toIndex: number, containerOffset: {top: number; left: number}): [HTMLTableCellElement, number, number] | false {
    const rootHotElement = this.#wot.wtTable.wtRootElement!.parentNode as HTMLElement;
    let getHeaderFn: ((index: number, level: number) => HTMLTableCellElement | null | undefined) | null = null;
    let dimensionFn: ((element: HTMLElement) => number) | null = null;
    let entireSelectionClassname: string | null = null;
    let index: number | null = null;
    let dimension: number | null = null;
    let dimensionProperty: 'top' | 'left' | null = null;
    let startHeader = null;
    let endHeader = null;

    switch (direction) {
      case 'rows':
        getHeaderFn = (...args) => (this.#wot.wtTable.getRowHeader as HeaderGetter)(...args);
        dimensionFn = (...args) => outerHeight(...args);
        entireSelectionClassname = 'fs-selection--rows';
        dimensionProperty = 'top';

        break;

      case 'columns':
        getHeaderFn = (...args) => (this.#wot.wtTable.getColumnHeader as HeaderGetter)(...args);
        dimensionFn = (...args) => outerWidth(...args);
        entireSelectionClassname = 'fs-selection--columns';
        dimensionProperty = 'left';
        break;
      default:
    }

    if (rootHotElement.className.includes(entireSelectionClassname!)) {
      const columnHeaderLevelCount = this.#wot.getSetting('columnHeaders').length;

      startHeader = getHeaderFn!(fromIndex, columnHeaderLevelCount - 1);
      endHeader = getHeaderFn!(toIndex, columnHeaderLevelCount - 1);

      if (!startHeader || !endHeader) {
        return false;
      }

      const startHeaderOffset = offset(startHeader);
      const endOffset = offset(endHeader);

      if (startHeader && endHeader) {
        index = startHeaderOffset[dimensionProperty!] - containerOffset[dimensionProperty!] - 1;
        dimension = endOffset[dimensionProperty!] + dimensionFn!(endHeader) - startHeaderOffset[dimensionProperty!];
      }

      return [startHeader, index!, dimension!];
    }

    return false;
  }

  /**
   * Change border style.
   *
   * @private
   * @param {String} borderElement Coordinate where add/remove border: top, right, bottom, left.
   */
  changeBorderStyle(borderElement: BorderSide, border: Partial<Record<BorderSide, SideStyle>>) {
    const style = this[borderElement].style;
    const borderStyle = border[borderElement];

    if (!borderStyle || borderStyle.hide) {
      addClass(this[borderElement], 'hidden');

    } else {
      if (hasClass(this[borderElement], 'hidden')) {
        removeClass(this[borderElement], 'hidden');
      }

      style.backgroundColor = borderStyle.color as string;

      if (borderElement === 'top' || borderElement === 'bottom') {
        style.height = `${borderStyle.width}px`;
      }

      if (borderElement === 'right' || borderElement === 'left') {
        style.width = `${borderStyle.width}px`;
      }
    }
  }

  /**
   * Change border style to default.
   *
   * @private
   * @param {HTMLElement} position
   */
  changeBorderToDefaultStyle(position: BorderSide) {
    const defaultBorder = {
      width: 1,
      color: 'var(--fs-custom-border-color)',
    };
    const style = this[position].style;

    style.backgroundColor = defaultBorder.color;
    style.width = `${defaultBorder.width}px`;
    style.height = `${defaultBorder.width}px`;
  }

  /**
   * Toggle class 'hidden' to element.
   *
   * @private
   * @param {String} borderElement Coordinate where add/remove border: top, right, bottom, left.
   * @return {Boolean}
   */
  toggleHiddenClass(borderElement: BorderSide, remove?: boolean) {
    this.changeBorderToDefaultStyle(borderElement);

    if (remove) {
      addClass(this[borderElement], 'hidden');
    } else {
      removeClass(this[borderElement], 'hidden');
    }
  }

  /**
   * Hide border
   */
  disappear() {
    this.#topStyle.display = 'none';
    this.#leftStyle.display = 'none';
    this.#bottomStyle.display = 'none';
    this.#rightStyle.display = 'none';
    this.#cornerStyle.display = 'none';

    if (isMobileBrowser()) {
      this.#selectionHandles.styles.topLeft.display = 'none';
      this.#selectionHandles.styles.bottomRight.display = 'none';
    }
  }
}

export default Border;
