/**
 * The icons of the context menu's entries: 16×16 line drawings in the text color (`currentColor`), so themes color
 * them. An entry of your own takes any SVG (or other HTML) as its `icon`.
 */
const svg = (paths: string): string => '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" ' +
  `fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

export const ICONS = {
  rowAbove: svg('<rect x="2.5" y="8.5" width="11" height="5" rx="1"/><path d="M8 2v5M5.5 4.5h5"/>'),
  rowBelow: svg('<rect x="2.5" y="2.5" width="11" height="5" rx="1"/><path d="M8 9v5M5.5 11.5h5"/>'),
  columnLeft: svg('<rect x="8.5" y="2.5" width="5" height="11" rx="1"/><path d="M2 8h5M4.5 5.5v5"/>'),
  columnRight: svg('<rect x="2.5" y="2.5" width="5" height="11" rx="1"/><path d="M9 8h5M11.5 5.5v5"/>'),
  removeRow: svg('<rect x="2.5" y="5.5" width="11" height="5" rx="1"/><path d="M6 8h4"/>'),
  removeColumn: svg('<rect x="5.5" y="2.5" width="5" height="11" rx="1"/><path d="M8 6v4"/>'),
  clear: svg('<path d="M9.5 3.5 13 7l-5.5 5.5H4L2.5 11z"/><path d="M6.5 6.5 10 10M7.5 13.5h6"/>'),
  undo: svg('<path d="M5.5 4 2.5 7l3 3"/><path d="M2.5 7h7a4 4 0 0 1 0 8H7"/>'),
  redo: svg('<path d="M10.5 4l3 3-3 3"/><path d="M13.5 7h-7a4 4 0 0 0 0 8H9"/>'),
  copy: svg('<rect x="5.5" y="5.5" width="8" height="8" rx="1"/><path d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2"/>'),
  cut: svg('<circle cx="4.5" cy="12" r="2"/><circle cx="11.5" cy="12" r="2"/><path d="M6 10.5 12 2M10 10.5 4 2"/>'),
  paste: svg('<rect x="3.5" y="3" width="9" height="11" rx="1"/><path d="M6 3V2h4v1M6 7h4M6 9.5h4"/>'),
  lock: svg('<rect x="3.5" y="7" width="9" height="6.5" rx="1"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/>'),
  alignment: svg('<path d="M2.5 4h11M2.5 7h7M2.5 10h11M2.5 13h7"/>'),
  format: svg('<path d="M4 13.5 8 2.5l4 11M5.5 9.5h5"/>'),
  freeze: svg('<rect x="2.5" y="2.5" width="11" height="11" rx="1"/><path d="M2.5 6h11M6 2.5v11"/>'),
  comment: svg('<path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z"/>'),
  commentRemove: svg('<path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z"/><path d="M6 7h4"/>'),
  conditionalFormatting: svg('<rect x="2.5" y="2.5" width="11" height="11" rx="1"/><path d="M5 10.5h2M5 8h4M5 5.5h6"/>'),
  filter: svg('<path d="M2.5 3h11l-4.5 5.5V13l-2-1V8.5z"/>'),
  sort: svg('<path d="M4.5 2.5v11M2.5 11.5l2 2 2-2M10 3.5h3.5M10 7.5h2.5M10 11.5h1.5"/>'),
  group: svg('<path d="M4 3v10M4 3h2M4 13h2M8.5 5.5h5M8.5 8h5M8.5 10.5h5"/>'),
  ungroup: svg('<path d="M8.5 5.5h5M8.5 8h5M8.5 10.5h5M2.5 8h3"/>'),
  link: svg('<path d="M7 9a2.5 2.5 0 0 0 3.5 0l2-2a2.5 2.5 0 0 0-3.5-3.5l-.5.5"/><path d="M9 7a2.5 2.5 0 0 0-3.5 0l-2 2A2.5 2.5 0 0 0 7 12.5l.5-.5"/>'),
  borders: svg('<rect x="2.5" y="2.5" width="11" height="11"/><path d="M8 2.5v11M2.5 8h11" stroke-dasharray="1.5 1.5"/>'),
  history: svg('<circle cx="8" cy="8" r="5.5"/><path d="M8 5v3l2 1.5"/>'),
} as const;

/** Whether keys show as on a Mac (⌘, ⌥, ⇧). */
const isMac = (): boolean => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '');

/** A shortcut as the user's system writes it: `Ctrl+Shift+Z` on Windows and Linux, `⌘⇧Z` on a Mac. */
export const formatShortcut = (shortcut: string): string => {
  if (!isMac()) {
    return shortcut;
  }
  const keys: Record<string, string> = { ctrl: '⌘', cmd: '⌘', alt: '⌥', shift: '⇧' };

  return shortcut.split('+').map(key => keys[key.toLowerCase()] ?? key).join('');
};
