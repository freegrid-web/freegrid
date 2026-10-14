import {
  LEGACY_CLASS_NAMES,
  toFreeSheetClassName,
  toLegacyClassName,
  withCounterpartClassNames,
  withLegacyClassNames,
} from 'handsontable/helpers/classNames';
import { addClass, removeClass, hasClass } from 'handsontable/helpers/dom/element';

describe('FreeSheet class names', () => {
  it('maps legacy names by rule', () => {
    expect(toFreeSheetClassName('handsontable')).toBe('freesheet');
    expect(toFreeSheetClassName('htCore')).toBe('fs-core');
    expect(toFreeSheetClassName('htCenter')).toBe('fs-center');
    expect(toFreeSheetClassName('htSearchResult')).toBe('fs-search-result');
    expect(toFreeSheetClassName('ht_master')).toBe('fs-master');
    expect(toFreeSheetClassName('ht_clone_top_left_corner')).toBe('fs-clone-top-left-corner');
    expect(toFreeSheetClassName('ht__highlight')).toBe('fs-highlight');
    expect(toFreeSheetClassName('ht__active_highlight')).toBe('fs-active-highlight');
    expect(toFreeSheetClassName('ht__selection--rows')).toBe('fs-selection--rows');
    expect(toFreeSheetClassName('ht__manualColumnMove--guideline')).toBe('fs-manual-column-move--guideline');
    expect(toFreeSheetClassName('wtHolder')).toBe('fs-holder');
  });

  it('uses explicit names where the rule would collide', () => {
    expect(toFreeSheetClassName('handsontableInput')).toBe('fs-editor-input');
    expect(toFreeSheetClassName('handsontableInputHolder')).toBe('fs-editor-holder');
    expect(toFreeSheetClassName('handsontableEditor')).toBe('fs-editor-grid');
    expect(toFreeSheetClassName('wtBorder')).toBe('fs-selection-border');
  });

  it('maps every legacy name to a unique FreeSheet name and back', () => {
    const names = LEGACY_CLASS_NAMES.map(toFreeSheetClassName);

    expect(new Set(names).size).toBe(LEGACY_CLASS_NAMES.length);
    LEGACY_CLASS_NAMES.forEach(legacy => expect(toLegacyClassName(toFreeSheetClassName(legacy))).toBe(legacy));
  });

  it('leaves unknown names alone', () => {
    expect(toFreeSheetClassName('current')).toBe('current');
    expect(toLegacyClassName('my-class')).toBe('my-class');
    expect(withCounterpartClassNames(['current', 'area'])).toEqual(['current', 'area']);
  });

  it('adds counterparts in both directions', () => {
    expect(withCounterpartClassNames(['fs-core'])).toEqual(['fs-core', 'htCore']);
    expect(withCounterpartClassNames(['htCenter', 'mine'])).toEqual(['htCenter', 'fs-center', 'mine']);
    expect(withLegacyClassNames('fs-holder')).toBe('fs-holder wtHolder');
  });

  describe('DOM helpers keep both names during the transition', () => {
    it('addClass adds the counterpart, removeClass removes both', () => {
      const el = document.createElement('div');

      addClass(el, 'fs-dimmed');
      expect(el.className.split(' ').sort()).toEqual(['fs-dimmed', 'htDimmed']);
      addClass(el, 'htCenter'); // user-supplied legacy name
      expect(hasClass(el, 'fs-center')).toBe(true);
      removeClass(el, 'htDimmed');
      expect(el.className.split(' ').sort()).toEqual(['fs-center', 'htCenter']);
    });

    it('hasClass matches either name', () => {
      const el = document.createElement('div');

      el.className = 'htCore';
      expect(hasClass(el, 'fs-core')).toBe(true);
      el.className = 'fs-core';
      expect(hasClass(el, 'htCore')).toBe(true);
    });
  });
});
