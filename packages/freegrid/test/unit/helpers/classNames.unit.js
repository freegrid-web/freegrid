import {
  LEGACY_CLASS_NAMES,
  toFreeGridClassName,
  toLegacyClassName,
  withCounterpartClassNames,
  withLegacyClassNames,
} from 'handsontable/helpers/classNames';
import { addClass, removeClass, hasClass } from 'handsontable/helpers/dom/element';

describe('FreeGrid class names', () => {
  it('maps legacy names by rule', () => {
    expect(toFreeGridClassName('handsontable')).toBe('freegrid');
    expect(toFreeGridClassName('htCore')).toBe('fg-core');
    expect(toFreeGridClassName('htCenter')).toBe('fg-center');
    expect(toFreeGridClassName('htSearchResult')).toBe('fg-search-result');
    expect(toFreeGridClassName('ht_master')).toBe('fg-master');
    expect(toFreeGridClassName('ht_clone_top_left_corner')).toBe('fg-clone-top-left-corner');
    expect(toFreeGridClassName('ht__highlight')).toBe('fg-highlight');
    expect(toFreeGridClassName('ht__active_highlight')).toBe('fg-active-highlight');
    expect(toFreeGridClassName('ht__selection--rows')).toBe('fg-selection--rows');
    expect(toFreeGridClassName('ht__manualColumnMove--guideline')).toBe('fg-manual-column-move--guideline');
    expect(toFreeGridClassName('wtHolder')).toBe('fg-holder');
  });

  it('uses explicit names where the rule would collide', () => {
    expect(toFreeGridClassName('handsontableInput')).toBe('fg-editor-input');
    expect(toFreeGridClassName('handsontableInputHolder')).toBe('fg-editor-holder');
    expect(toFreeGridClassName('handsontableEditor')).toBe('fg-editor-grid');
    expect(toFreeGridClassName('wtBorder')).toBe('fg-selection-border');
  });

  it('maps every legacy name to a unique FreeGrid name and back', () => {
    const names = LEGACY_CLASS_NAMES.map(toFreeGridClassName);

    expect(new Set(names).size).toBe(LEGACY_CLASS_NAMES.length);
    LEGACY_CLASS_NAMES.forEach(legacy => expect(toLegacyClassName(toFreeGridClassName(legacy))).toBe(legacy));
  });

  it('leaves unknown names alone', () => {
    expect(toFreeGridClassName('current')).toBe('current');
    expect(toLegacyClassName('my-class')).toBe('my-class');
    expect(withCounterpartClassNames(['current', 'area'])).toEqual(['current', 'area']);
  });

  it('adds counterparts in both directions', () => {
    expect(withCounterpartClassNames(['fg-core'])).toEqual(['fg-core', 'htCore']);
    expect(withCounterpartClassNames(['htCenter', 'mine'])).toEqual(['htCenter', 'fg-center', 'mine']);
    expect(withLegacyClassNames('fg-holder')).toBe('fg-holder wtHolder');
  });

  describe('DOM helpers keep both names during the transition', () => {
    it('addClass adds the counterpart, removeClass removes both', () => {
      const el = document.createElement('div');

      addClass(el, 'fg-dimmed');
      expect(el.className.split(' ').sort()).toEqual(['fg-dimmed', 'htDimmed']);
      addClass(el, 'htCenter'); // user-supplied legacy name
      expect(hasClass(el, 'fg-center')).toBe(true);
      removeClass(el, 'htDimmed');
      expect(el.className.split(' ').sort()).toEqual(['fg-center', 'htCenter']);
    });

    it('hasClass matches either name', () => {
      const el = document.createElement('div');

      el.className = 'htCore';
      expect(hasClass(el, 'fg-core')).toBe(true);
      el.className = 'fg-core';
      expect(hasClass(el, 'htCore')).toBe(true);
    });
  });
});
