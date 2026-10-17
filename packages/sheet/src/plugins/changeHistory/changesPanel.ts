import './changesPanel.css';
import { registerPanelView, documentGrids, activeGrid } from './../../sidePanel/sidePanel';
import { getWorkbookOf } from './../../workbook/workbook';
import { spreadsheetColumnLabel } from './../../helpers/data';
import * as C from './../../i18n/constants';
import type Core from './../../core';
import type { SidePanel } from './../../sidePanel/sidePanel';
import type { ChangeEntry } from './changeHistory';

type Item = { grid: Core; sheetId: string | null; sheetName: string | null; entry: ChangeEntry };
type History = { enabled: boolean; getChanges(): ChangeEntry[] };

/** Every recorded change of the document, newest first. */
const items = (root: Core): Item[] => documentGrids(root).flatMap(({ instance, id, name }) => {
  const history = instance.getPlugin('changeHistory') as unknown as History | undefined;

  return history?.enabled ? history.getChanges().map(entry => ({ grid: instance, sheetId: id, sheetName: name, entry }))
    : [];
}).sort((a, b) => b.entry.time - a.entry.time || b.entry.id - a.entry.id);

const cellName = (row: number, col: number): string => `${spreadsheetColumnLabel(col)}${row + 1}`;

/** The cells of an edit as a range (A1 or A1:C4). */
const rangeOf = (entry: ChangeEntry): { r1: number; c1: number; r2: number; c2: number } => ({
  r1: Math.min(...entry.cells.map(cell => cell.row)),
  c1: Math.min(...entry.cells.map(cell => cell.col)),
  r2: Math.max(...entry.cells.map(cell => cell.row)),
  c2: Math.max(...entry.cells.map(cell => cell.col)),
});

const shown = (value: unknown): string => (value === null || value === void 0 || value === '' ? '∅' : String(value));

/** The day a change belongs to: Today, Yesterday, or its date. */
const dayOf = (time: number, today: string, yesterday: string): string => {
  const date = new Date(time);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  if (time >= start) {
    return today;
  }
  if (time >= start - 86400000) {
    return yesterday;
  }

  return date.toLocaleDateString();
};

/**
 * The Changes panel ("Show Changes"): the recorded changes of the document, newest first and grouped by day, each with
 * its user, time, cells and old → new values. A click selects the changed cells (switching the sheet). "Selection"
 * shows only the changes of the selected cells.
 */
registerPanelView('changes', (root: Core, panel: SidePanel) => {
  const phrase = (key: string) => String(root.getTranslatedPhrase(key, 0));
  const watched: Core[] = [];
  let onlySelection = false;
  const onChange = () => {
    panel.refresh();
  };
  const onSelection = () => {
    if (onlySelection) {
      panel.refresh();
    }
  };

  const select = ({ grid, sheetId, entry }: Item) => {
    const workbook = getWorkbookOf(root);

    if (workbook && sheetId && workbook.activeId !== sheetId) {
      root.activateSheet(sheetId);
    }
    if (entry.kind !== 'edit') {
      return;
    }
    const range = rangeOf(entry);
    const from = [grid.toVisualRow(range.r1), grid.toVisualColumn(range.c1)];
    const to = [grid.toVisualRow(range.r2), grid.toVisualColumn(range.c2)];

    if ([...from, ...to].every(index => index !== null && index >= 0)) {
      grid.selectCell(from[0]!, from[1]!, to[0]!, to[1]!);
    }
  };

  /** Whether an edit touches the active grid's selection. */
  const inSelection = ({ grid, entry }: Item): boolean => {
    const active = activeGrid(root);
    const ranges = active.getSelectedRange();

    if (grid !== active || !ranges || entry.kind !== 'edit') {
      return false;
    }

    return entry.cells.some(cell => ranges.some((range) => {
      const from = range.getTopLeftCorner();
      const to = range.getBottomRightCorner();
      const row = grid.toVisualRow(cell.row);
      const col = grid.toVisualColumn(cell.col);

      return row !== null && col !== null && row >= from.row && row <= to.row && col >= from.col && col <= to.col;
    }));
  };

  const describe = ({ entry }: Item): string => {
    const amount = String(entry.amount || 1);
    const at = String((entry.index || 0) + 1);

    switch (entry.kind) {
      case 'insert_row':
        return phrase(C.CHANGES_INSERT_ROWS).replace('{amount}', amount).replace('{index}', at);
      case 'remove_row':
        return phrase(C.CHANGES_REMOVE_ROWS).replace('{amount}', amount).replace('{index}', at);
      case 'insert_col':
        return phrase(C.CHANGES_INSERT_COLUMNS).replace('{amount}', amount).replace('{index}', spreadsheetColumnLabel(
          entry.index || 0));
      case 'remove_col':
        return phrase(C.CHANGES_REMOVE_COLUMNS).replace('{amount}', amount).replace('{index}', spreadsheetColumnLabel(
          entry.index || 0));
      default: {
        const range = rangeOf(entry);
        const cells = range.r1 === range.r2 && range.c1 === range.c2 ? cellName(range.r1, range.c1) :
          `${cellName(range.r1, range.c1)}:${cellName(range.r2, range.c2)}`;

        return entry.cells.length === 1 ? cells :
          phrase(C.CHANGES_CELLS).replace('{amount}', String(entry.cells.length)).replace('{cells}', cells);
      }
    }
  };

  return {
    title: () => phrase(C.CHANGES_TITLE),
    render(body: HTMLElement) {
      documentGrids(root).forEach(({ instance }) => {
        if (watched.indexOf(instance) === -1) {
          watched.push(instance);
          instance.addHook('afterChangeRecorded', onChange);
          instance.addHook('afterSelectionEnd', onSelection);
        }
      });
      const sheets = documentGrids(root).length;
      const toolbar = document.createElement('div');
      const filter = document.createElement('select');

      toolbar.className = 'fs-side-panel__row';
      filter.className = 'fs-changes-panel__filter';
      filter.setAttribute('aria-label', phrase(C.CHANGES_FILTER));
      [[phrase(C.CHANGES_ALL), 'all'], [phrase(C.CHANGES_SELECTION), 'selection']].forEach(([label, value]) => {
        const option = document.createElement('option');

        option.value = value;
        option.textContent = label;
        filter.appendChild(option);
      });
      filter.value = onlySelection ? 'selection' : 'all';
      filter.addEventListener('change', () => {
        onlySelection = filter.value === 'selection';
        panel.refresh();
      });
      toolbar.append(filter);
      body.append(toolbar);

      const list = items(root).filter(item => !onlySelection || inSelection(item));

      if (!list.length) {
        const empty = document.createElement('p');

        empty.className = 'fs-side-panel__muted';
        empty.textContent = phrase(C.CHANGES_EMPTY);
        body.append(empty);
      }
      let day = '';

      list.forEach((item) => {
        const { entry } = item;
        const itemDay = dayOf(entry.time, phrase(C.CHANGES_TODAY), phrase(C.CHANGES_YESTERDAY));

        if (itemDay !== day) {
          const heading = document.createElement('h3');

          day = itemDay;
          heading.className = 'fs-changes-panel__day';
          heading.textContent = day;
          body.append(heading);
        }
        const card = document.createElement('div');
        const header = document.createElement('div');
        const who = document.createElement('span');
        const when = document.createElement('span');
        const what = document.createElement('div');

        card.className = 'fs-side-panel__card fs-side-panel__card--link fs-changes-panel__change';
        card.tabIndex = 0;
        header.className = 'fs-side-panel__row';
        who.className = 'fs-side-panel__label';
        who.textContent = entry.user || phrase(C.CHANGES_SOMEONE);
        when.className = 'fs-side-panel__muted';
        when.textContent = new Date(entry.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        header.append(who, when);
        what.className = 'fs-changes-panel__what';
        what.textContent = sheets > 1 && item.sheetName ? `${item.sheetName}!${describe(item)}` : describe(item);
        card.append(header, what);
        // The values of a few cells: old → new.
        entry.cells.slice(0, 5).forEach((cell) => {
          const line = document.createElement('div');

          line.className = 'fs-changes-panel__value';
          line.textContent = `${entry.cells.length > 1 ? `${cellName(cell.row, cell.col)}: ` : ''}${shown(cell.before)} → ${
            shown(cell.after)}`;
          card.append(line);
        });
        if (entry.cells.length > 5) {
          const more = document.createElement('div');

          more.className = 'fs-side-panel__muted';
          more.textContent = phrase(C.CHANGES_MORE).replace('{amount}', String(entry.cells.length - 5));
          card.append(more);
        }
        card.addEventListener('click', () => select(item));
        card.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') {
            select(item);
          }
        });
        body.append(card);
      });
    },
    destroy() {
      watched.filter(instance => !instance.isDestroyed).forEach((instance) => {
        instance.removeHook('afterChangeRecorded', onChange);
        instance.removeHook('afterSelectionEnd', onSelection);
      });
    },
  };
});
