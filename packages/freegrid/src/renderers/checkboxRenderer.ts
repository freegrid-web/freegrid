import { withLegacyClassNames } from './../helpers/classNames';
import { empty, addClass } from './../helpers/dom/element';
import { equalsIgnoreCase } from './../helpers/string';
import EventManager from './../eventManager';
import { isKey } from './../helpers/unicode';
import { stopImmediatePropagation, isImmediatePropagationStopped } from './../helpers/dom/event';
import { getRenderer } from './index';
import type { CellProperties, GridInstance, Renderer } from '../cellTypes/types';

const isListeningKeyDownEvent = new WeakMap<GridInstance, true>();
const isCheckboxListenerAdded = new WeakMap<GridInstance, EventManager>();
const BAD_VALUE_CLASS = 'fg-bad-value';

const isCheckboxInput = (element: EventTarget | null): element is HTMLInputElement => element instanceof HTMLElement
  && element.tagName === 'INPUT' && element.getAttribute('type') === 'checkbox';

const createInput = (): HTMLInputElement => {
  const input = document.createElement('input');

  input.className = withLegacyClassNames('fg-checkbox-renderer-input');
  input.type = 'checkbox';
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('tabindex', '-1');

  return input;
};

const createLabel = (text: unknown): HTMLLabelElement => {
  const label = document.createElement('label');

  label.className = withLegacyClassNames('fg-checkbox-renderer-label');
  label.appendChild(document.createTextNode(text as string));

  return label;
};

/** The checkbox of the event's cell, with its cell settings; nothing for other targets. */
const checkboxTarget = (event: Event, instance: GridInstance) => {
  if (!isCheckboxInput(event.target)) {
    return null;
  }
  const row = parseInt(event.target.getAttribute('data-row') as string, 10);
  const col = parseInt(event.target.getAttribute('data-col') as string, 10);

  return { input: event.target, row, col, cellProperties: instance.getCellMeta(row, col) };
};

// A click on a read-only checkbox does not change it.
const onClick = (event: MouseEvent, instance: GridInstance): void => {
  if (checkboxTarget(event, instance)?.cellProperties.readOnly) {
    event.preventDefault();
  }
};

// The grid listens to the keyboard again after a checkbox took the focus.
const onMouseUp = (event: MouseEvent, instance: GridInstance): void => {
  if (isCheckboxInput(event.target)) {
    setTimeout(instance.listen, 10);
  }
};

// Writes the checked or unchecked template to the data.
const onChange = (event: Event, instance: GridInstance): void => {
  const target = checkboxTarget(event, instance);

  if (!target || target.cellProperties.readOnly) {
    return;
  }
  const { input, row, col, cellProperties } = target;
  let newCheckboxValue;

  if (input.checked) {
    newCheckboxValue = cellProperties.uncheckedTemplate === undefined ? true : cellProperties.checkedTemplate;
  } else {
    newCheckboxValue = cellProperties.uncheckedTemplate === undefined ? false : cellProperties.uncheckedTemplate;
  }
  instance.setDataAtCell(row, col, newCheckboxValue);
};

/** Click, mouseup and change listeners on the grid (once per grid). */
const registerEvents = (instance: GridInstance): EventManager => {
  let eventManager = isCheckboxListenerAdded.get(instance);

  if (!eventManager) {
    eventManager = new EventManager(instance);
    eventManager.addEventListener(instance.rootElement, 'click', (event: MouseEvent) => onClick(event, instance));
    eventManager.addEventListener(instance.rootElement, 'mouseup', (event: MouseEvent) => onMouseUp(event, instance));
    eventManager.addEventListener(instance.rootElement, 'change', (event: Event) => onChange(event, instance));
    isCheckboxListenerAdded.set(instance, eventManager);
  }

  return eventManager;
};

/** The cell's templates, defaulting to `true` and `false` (written back to the cell settings, as before). */
const applyDefaultTemplates = (cellProperties: CellProperties): void => {
  if (cellProperties.checkedTemplate === undefined) {
    cellProperties.checkedTemplate = true;
  }
  if (cellProperties.uncheckedTemplate === undefined) {
    cellProperties.uncheckedTemplate = false;
  }
};

/**
 * Space or Enter toggles the selected checkboxes; Delete or Backspace unchecks them. The keys are handled once per
 * grid (the first rendered checkbox adds the hook).
 */
const listenToKeys = (instance: GridInstance): void => {
  if (isListeningKeyDownEvent.has(instance)) {
    return;
  }
  isListeningKeyDownEvent.set(instance, true);

  // Calls `callback` while the selection's cells are checkboxes (stops at the first other cell).
  const eachSelectedCheckboxCell = (callback: () => void): void => {
    const selRange = instance.getSelectedRangeLast();

    if (!selRange) {
      return;
    }
    const topLeft = selRange.getTopLeftCorner();
    const bottomRight = selRange.getBottomRightCorner();

    for (let visualRow = topLeft.row; visualRow <= bottomRight.row; visualRow += 1) {
      for (let visualColumn = topLeft.col; visualColumn <= bottomRight.col; visualColumn += 1) {
        const cachedCellProperties = instance.getCellMeta(visualRow, visualColumn);

        if (cachedCellProperties.type !== 'checkbox') {
          return;
        }
        const cell = instance.getCell(visualRow, visualColumn);

        if (cell === null || cell === undefined) {
          callback();
        } else if (cell.querySelectorAll('input[type=checkbox]').length > 0 && !cachedCellProperties.readOnly) {
          callback();
        }
      }
    }
  };

  const changeSelectedCheckboxesState = (uncheckCheckbox = false): void => {
    const selRange = instance.getSelectedRangeLast();

    if (!selRange) {
      return;
    }
    const { row: startRow, col: startColumn } = selRange.getTopLeftCorner();
    const { row: endRow, col: endColumn } = selRange.getBottomRightCorner();
    const changes: [number, number, unknown][] = [];

    for (let visualRow = startRow; visualRow <= endRow; visualRow += 1) {
      for (let visualColumn = startColumn; visualColumn <= endColumn; visualColumn += 1) {
        const cachedCellProperties = instance.getCellMeta(visualRow, visualColumn);

        if (cachedCellProperties.type !== 'checkbox') {
          return;
        }
        // eslint-disable-next-line no-continue
        if (cachedCellProperties.readOnly === true) {
          continue;
        }
        applyDefaultTemplates(cachedCellProperties);
        const { checkedTemplate, uncheckedTemplate } = cachedCellProperties;
        const dataAtCell = instance.getDataAtCell(visualRow, visualColumn);

        if (uncheckCheckbox) {
          changes.push([visualRow, visualColumn, uncheckedTemplate]);
        } else if ([checkedTemplate, String(checkedTemplate)].includes(dataAtCell)) {
          changes.push([visualRow, visualColumn, uncheckedTemplate]);
        } else if ([uncheckedTemplate, String(uncheckedTemplate), null, undefined].includes(dataAtCell)) {
          changes.push([visualRow, visualColumn, checkedTemplate]);
        }
      }
    }
    if (changes.length > 0) {
      instance.setDataAtCell(changes);
    }
  };

  instance.addHook('beforeKeyDown', (event: KeyboardEvent) => {
    const toggleKeys = 'SPACE|ENTER';
    const switchOffKeys = 'DELETE|BACKSPACE';
    const isKeyCode = (keys: string) => isKey(event.keyCode, keys);

    if (!instance.getSettings().enterBeginsEditing && isKeyCode('ENTER')) {
      return;
    }
    if (isKeyCode(`${toggleKeys}|${switchOffKeys}`) && !isImmediatePropagationStopped(event)) {
      eachSelectedCheckboxCell(() => {
        stopImmediatePropagation(event);
        event.preventDefault();
      });
    }
    if (isKeyCode(toggleKeys)) {
      changeSelectedCheckboxesState();
    }
    if (isKeyCode(switchOffKeys)) {
      changeSelectedCheckboxesState(true);
    }
  });
};

/**
 * A checkbox: checked for `checkedTemplate` (default `true`), unchecked for `uncheckedTemplate` (default `false`),
 * hidden with `#bad-value#` for other values. `label` adds a label from a value, a function or a data property.
 */
const checkboxRenderer: Renderer = (instance, TD, row, col, prop, value, cellProperties) => {
  getRenderer('base')(instance, TD, row, col, prop, value, cellProperties);
  registerEvents(instance);
  applyDefaultTemplates(cellProperties);

  const input = createInput();
  const labelOptions = cellProperties.label;
  let element: HTMLElement = input;
  let badValue = false;

  // TODO identify under what circumstances this line can be removed
  empty(TD);

  if (value === cellProperties.checkedTemplate || equalsIgnoreCase(value, cellProperties.checkedTemplate)) {
    input.checked = true;
  } else if (value === cellProperties.uncheckedTemplate || equalsIgnoreCase(value, cellProperties.uncheckedTemplate)) {
    input.checked = false;
  } else if (value === null) {
    // No value yet.
    addClass(input, 'noValue');
  } else {
    input.style.display = 'none';
    addClass(input, BAD_VALUE_CLASS);
    badValue = true;
  }
  input.setAttribute('data-row', String(row));
  input.setAttribute('data-col', String(col));

  if (!badValue && labelOptions) {
    let labelText: unknown = '';

    if (labelOptions.value) {
      labelText = typeof labelOptions.value === 'function'
        ? labelOptions.value(row, col, prop, value)
        : labelOptions.value;
    } else if (labelOptions.property) {
      labelText = instance.getDataAtRowProp(row, labelOptions.property);
    }
    const label = createLabel(labelText);

    if (labelOptions.position === 'before') {
      label.appendChild(input);
    } else {
      label.insertBefore(input, label.firstChild);
    }
    element = label;
  }
  TD.appendChild(element);

  if (badValue) {
    TD.appendChild(document.createTextNode('#bad-value#'));
  }
  listenToKeys(instance);
};

export default checkboxRenderer;
