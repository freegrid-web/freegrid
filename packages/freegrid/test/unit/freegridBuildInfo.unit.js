import FreeGrid from 'handsontable';
import * as mixed from 'handsontable/helpers/mixed';
import { pkg } from '../../build/constants.js';

describe('build info', () => {
  it('exposes version, packageName and buildDate from build constants', () => {
    expect(FreeGrid.version).toBe(pkg.version);
    expect(FreeGrid.packageName).toBe('@freegrid/core');
    expect(FreeGrid.buildDate).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/);
    expect(FreeGrid.baseVersion).toBeUndefined();
  });

  it('contains no license-key check', () => {
    expect(mixed._injectProductInfo).toBeUndefined();
  });

  it('does not render a license notice', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const hot = new FreeGrid(root, { data: [[1]] });

    expect(document.querySelector('#hot-display-license-info')).toBeNull();
    hot.destroy();
    root.remove();
  });
});
