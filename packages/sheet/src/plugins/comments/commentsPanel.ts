import { registerPanelView, documentGrids, activeGrid } from './../../sidePanel/sidePanel';
import { getWorkbookOf } from './../../workbook/workbook';
import { spreadsheetColumnLabel } from './../../helpers/data';
import * as C from './../../i18n/constants';
import type Core from './../../core';
import type { SidePanel } from './../../sidePanel/sidePanel';

type Comment = { value?: string; author?: string; date?: string; readOnly?: boolean };
type Entry = { grid: Core; sheetId: string | null; sheetName: string | null; row: number; column: number;
  comment: Comment };

const button = (text: string, className: string, onClick: () => void): HTMLButtonElement => {
  const element = document.createElement('button');

  element.type = 'button';
  element.className = className;
  element.textContent = text;
  element.addEventListener('click', onClick);

  return element;
};

/** Every comment of the document, sheet by sheet, row by row. */
const entries = (root: Core): Entry[] => documentGrids(root).flatMap(({ instance, id, name }) =>
  (instance.getCellsMeta() as { row: number; col: number; comment?: Comment }[])
    .filter(meta => meta.comment && meta.comment.value)
    .map(meta => ({ grid: instance, sheetId: id, sheetName: name, row: meta.row, column: meta.col,
      comment: meta.comment! }))
    .sort((a, b) => a.row - b.row || a.column - b.column));

/** A cell's address as A1 (data row and column, as formulas use), with the sheet when there are several. */
const address = (entry: Entry, sheets: number): string => {
  const cell = `${spreadsheetColumnLabel(entry.column)}${entry.row + 1}`;

  return sheets > 1 && entry.sheetName ? `${entry.sheetName}!${cell}` : cell;
};

/** Writes a cell's comment (no comment: removes it). */
const writeComment = (entry: Pick<Entry, 'grid' | 'row' | 'column'>, comment: Comment | undefined): void => {
  const { grid } = entry;
  const visualRow = grid.toVisualRow(entry.row);
  const visualColumn = grid.toVisualColumn(entry.column);

  if (visualRow !== null && visualColumn !== null && visualRow >= 0 && visualColumn >= 0) {
    grid.setCellMeta(visualRow, visualColumn, 'comment', comment);
  } else {
    // A hidden cell: its meta, by the data row and column.
    const meta = (grid.getCellsMeta() as { row: number; col: number; comment?: Comment }[])
      .find(item => item.row === entry.row && item.col === entry.column);

    if (meta) {
      meta.comment = comment;
    }
  }
  grid.render();
};

/**
 * The Comments panel: every comment of the document with its cell; a click selects the cell (switching the sheet),
 * comments are edited and deleted in place, New adds one to the selected cell.
 */
registerPanelView('comments', (root: Core, panel: SidePanel) => {
  const phrase = (key: string) => root.getTranslatedPhrase(key, 0) as string;
  let editing: Entry | 'new' | null = null;
  const watched: Core[] = [];
  const onMetaChange = () => {
    // Not while a comment is being written in the panel.
    if (!editing) {
      panel.refresh();
    }
  };

  const select = (entry: Entry) => {
    const workbook = getWorkbookOf(root);

    if (workbook && entry.sheetId && workbook.activeId !== entry.sheetId) {
      root.activateSheet(entry.sheetId);
    }
    const row = entry.grid.toVisualRow(entry.row);
    const column = entry.grid.toVisualColumn(entry.column);

    if (row !== null && column !== null && row >= 0 && column >= 0) {
      entry.grid.selectCell(row, column);
    }
  };

  const editor = (text: string, onSave: (value: string) => void): HTMLElement => {
    const box = document.createElement('div');
    const textarea = document.createElement('textarea');
    const actions = document.createElement('div');

    box.className = 'fs-side-panel__card fs-comments-panel__editor';
    textarea.value = text;
    textarea.placeholder = phrase(C.COMMENTS_PANEL_PLACEHOLDER);
    textarea.setAttribute('aria-label', phrase(C.COMMENTS_PANEL_PLACEHOLDER));
    actions.className = 'fs-side-panel__footer';
    actions.append(
      button(phrase(C.COMMENTS_PANEL_CANCEL), 'fs-side-panel__button', () => {
        editing = null;
        panel.refresh();
      }),
      button(phrase(C.COMMENTS_PANEL_SAVE), 'fs-side-panel__button fs-side-panel__button--primary', () => {
        editing = null;
        onSave(textarea.value);
        panel.refresh();
      }),
    );
    box.append(textarea, actions);
    setTimeout(() => textarea.focus());

    return box;
  };

  return {
    title: () => phrase(C.COMMENTS_PANEL_TITLE),
    render(body: HTMLElement) {
      // Comments changed in a grid show in the panel.
      documentGrids(root).forEach(({ instance }) => {
        if (watched.indexOf(instance) === -1) {
          watched.push(instance);
          instance.addHook('afterSetCellMeta', onMetaChange);
        }
      });
      const list = entries(root);
      const sheets = documentGrids(root).length;
      const toolbar = document.createElement('div');

      toolbar.className = 'fs-side-panel__row';
      toolbar.append(button(phrase(C.COMMENTS_PANEL_NEW), 'fs-side-panel__button fs-comments-panel__new', () => {
        editing = 'new';
        panel.refresh();
      }));
      body.append(toolbar);

      if (editing === 'new') {
        body.append(editor('', (value) => {
          const grid = activeGrid(root);
          const selected = grid.getSelectedLast();

          if (selected && value.trim()) {
            writeComment({ grid, row: grid.toPhysicalRow(Math.max(0, selected[0])),
              column: grid.toPhysicalColumn(Math.max(0, selected[1])) },
            { value, date: new Date().toISOString() });
          }
        }));
      }
      if (!list.length && editing !== 'new') {
        const empty = document.createElement('p');

        empty.className = 'fs-side-panel__muted';
        empty.textContent = phrase(C.COMMENTS_PANEL_EMPTY);
        body.append(empty);
      }
      list.forEach((entry) => {
        if (editing !== 'new' && editing && editing.grid === entry.grid && editing.row === entry.row &&
          editing.column === entry.column) {
          body.append(editor(entry.comment.value || '', value => writeComment(entry,
            value.trim() ? { ...entry.comment, value } : void 0)));

          return;
        }
        const card = document.createElement('div');
        const header = document.createElement('div');
        const cell = document.createElement('span');
        const text = document.createElement('div');

        card.className = 'fs-side-panel__card fs-side-panel__card--link fs-comments-panel__comment';
        card.tabIndex = 0;
        header.className = 'fs-side-panel__row';
        cell.className = 'fs-side-panel__label fs-comments-panel__cell';
        cell.textContent = address(entry, sheets);
        header.append(cell);
        if (entry.comment.author) {
          const author = document.createElement('span');

          author.className = 'fs-comments-panel__author';
          author.textContent = entry.comment.author;
          header.append(author);
        }
        const spacer = document.createElement('span');

        spacer.className = 'fs-side-panel__spacer';
        header.append(spacer);
        if (!entry.comment.readOnly) {
          const edit = button('', 'fs-side-panel__icon-button fs-comments-panel__edit', () => {
            editing = entry;
            panel.refresh();
          });
          const remove = button('', 'fs-side-panel__icon-button fs-comments-panel__delete', () => {
            writeComment(entry, void 0);
            panel.refresh();
          });

          edit.title = phrase(C.COMMENTS_PANEL_EDIT);
          edit.setAttribute('aria-label', edit.title);
          remove.title = phrase(C.COMMENTS_PANEL_DELETE);
          remove.setAttribute('aria-label', remove.title);
          [edit, remove].forEach(control => control.addEventListener('click', event => event.stopPropagation()));
          header.append(edit, remove);
        }
        text.className = 'fs-comments-panel__text';
        text.textContent = entry.comment.value || '';
        card.append(header, text);
        if (entry.comment.date) {
          const date = new Date(entry.comment.date);
          const when = document.createElement('div');

          when.className = 'fs-side-panel__muted';
          when.textContent = Number.isNaN(date.getTime()) ? entry.comment.date : date.toLocaleString();
          card.append(when);
        }
        card.addEventListener('click', () => select(entry));
        card.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') {
            select(entry);
          }
        });
        body.append(card);
      });
    },
    destroy() {
      watched.forEach(instance => !instance.isDestroyed && instance.removeHook('afterSetCellMeta', onMetaChange));
    },
  };
});
