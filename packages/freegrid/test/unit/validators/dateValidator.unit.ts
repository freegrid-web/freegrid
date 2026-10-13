import { correctFormat } from '../../../src/validators/validatorDate';

describe('dateValidator correctFormat', () => {
  it('reads a date in the format when it has no letters, also with _ or ^ as separators', () => {
    expect(correctFormat('01_02_2015', 'MM_DD_YYYY')).toBe('01_02_2015');
    expect(correctFormat('1/2/2015', 'MM/DD/YYYY')).toBe('01/02/2015');
  });

  it('reads a date with letters as the browser does', () => {
    expect(correctFormat('Jan 2 2015', 'MM/DD/YYYY')).toBe('01/02/2015');
  });
});
