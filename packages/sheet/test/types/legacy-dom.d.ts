// TypeScript 5's DOM lib dropped the deprecated HTMLTableDataCellElement constructor that the
// upstream type tests use; declare it so those tests compile unchanged.
declare var HTMLTableDataCellElement: {
  prototype: HTMLTableCellElement;
  new(): HTMLTableCellElement;
};
