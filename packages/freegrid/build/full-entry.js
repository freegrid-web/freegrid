import moment from 'moment';
import numbro from 'numbro';
import FreeGrid from '../src/index';

// Upstream handsontable.full.js exposed these globals; keep that behaviour.
if (typeof window !== 'undefined') {
  window.moment = moment;
  window.numbro = numbro;
}

export default FreeGrid;
