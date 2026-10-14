import type Walkontable from '../core';

/** Wrappers are attached during table construction; offsets are read after layout is measured. */
type AttachedElement = HTMLDivElement & { parentNode: HTMLElement & { parentNode: HTMLElement } };
type OverlayTable = Walkontable['wtTable'] & {
  holder: AttachedElement;
  hider: AttachedElement;
  spreader: AttachedElement;
  wtRootElement: HTMLElement & { parentNode: HTMLElement };
  holderOffset: { top: number; left: number };
  THEAD: HTMLTableSectionElement;
};

/** The layout surface shared by master and clone engines, while the other module groups are converted. */
export type OverlayEngine = Walkontable & {
  wtTable: OverlayTable;
  wtSettings: Walkontable['wtSettings'] & { defaultColumnWidth?: number };
};
