import numbro from 'numbro';
import FreeGrid from '../src/index';

// Upstream handsontable.full.js exposed numbro as a global; keep that.
if (typeof window !== 'undefined') {
  window.numbro = numbro;
}

export default FreeGrid;
