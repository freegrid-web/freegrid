import { isValid, parseItems } from '../../../src/plugins/dataValidation/rules';

describe('data validation rules', () => {
  it('checks lists, numbers, whole numbers, dates and text lengths', () => {
    expect(isValid({ type: 'list' }, 'Yes', ['Yes', 'No'])).toBe(true);
    expect(isValid({ type: 'list' }, ' No ', ['Yes', 'No'])).toBe(true);
    expect(isValid({ type: 'list' }, 'Maybe', ['Yes', 'No'])).toBe(false);

    expect(isValid({ type: 'number', operator: 'between', value: 0, value2: 100 }, 55.5)).toBe(true);
    expect(isValid({ type: 'number', operator: 'between', value: 0, value2: 100 }, '101')).toBe(false);
    expect(isValid({ type: 'number', operator: 'greater', value: 10 }, 'abc')).toBe(false);
    expect(isValid({ type: 'integer', operator: 'greaterOrEqual', value: 1 }, 2)).toBe(true);
    expect(isValid({ type: 'integer', operator: 'greaterOrEqual', value: 1 }, 2.5)).toBe(false);
    expect(isValid({ type: 'number', operator: 'notBetween', value: 1, value2: 5 }, 7)).toBe(true);

    expect(isValid({ type: 'date', operator: 'between', value: '2026-01-01', value2: '2026-12-31' }, '2026-06-15'))
      .toBe(true);
    expect(isValid({ type: 'date', operator: 'less', value: '2026-01-01' }, '15/03/2026', [], 'DD/MM/YYYY')).toBe(false);
    expect(isValid({ type: 'date', operator: 'greater', value: '2026-01-01' }, 'soon')).toBe(false);

    expect(isValid({ type: 'textLength', operator: 'lessOrEqual', value: 5 }, 'abcde')).toBe(true);
    expect(isValid({ type: 'textLength', operator: 'lessOrEqual', value: 5 }, 'abcdef')).toBe(false);
  });

  it('lets empty cells be, unless allowBlank is false; reads items one per line or by commas', () => {
    expect(isValid({ type: 'list' }, '', ['a'])).toBe(true);
    expect(isValid({ type: 'list', allowBlank: false }, null, ['a'])).toBe(false);
    expect(parseItems('Yes, No\nMaybe\n\n')).toEqual(['Yes', 'No', 'Maybe']);
  });
});
