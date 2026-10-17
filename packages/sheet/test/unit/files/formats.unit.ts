import {
  dateFormatToExcel, dateToSerial, excelToDateFormat, excelToNumberPattern, isDateCode, numberPatternToExcel,
  serialToDate,
} from '../../../src/files/formats';

describe('files: formats', () => {
  it('writes number patterns as Excel codes', () => {
    expect(numberPatternToExcel('0,0')).toBe('#,##0');
    expect(numberPatternToExcel('0,0.00')).toBe('#,##0.00');
    expect(numberPatternToExcel('0.0%')).toBe('0.0%');
    expect(numberPatternToExcel('$0,0.00')).toBe('"$"#,##0.00');
    expect(numberPatternToExcel('0,0.00 $')).toBe('#,##0.00 "$"');
  });

  it('reads Excel number codes as number patterns', () => {
    expect(excelToNumberPattern('#,##0')).toBe('0,0');
    expect(excelToNumberPattern('#,##0.00;[Red]-#,##0.00')).toBe('0,0.00');
    expect(excelToNumberPattern('0.00%')).toBe('0.00%');
    expect(excelToNumberPattern('"$"#,##0.00')).toBe('$0,0.00');
    expect(excelToNumberPattern('#,##0.00 [$€-407]')).toBe('0,0.00 $');
    expect(excelToNumberPattern('_("$"* #,##0.00_)')).toBe('$0,0.00');
    expect(excelToNumberPattern('General')).toBeNull();
    expect(excelToNumberPattern('yyyy-mm-dd')).toBeNull();
  });

  it('writes date and time formats as Excel codes', () => {
    expect(dateFormatToExcel('YYYY-MM-DD')).toBe('yyyy-mm-dd');
    expect(dateFormatToExcel('MM/DD/YYYY')).toBe('mm/dd/yyyy');
    expect(dateFormatToExcel('DD.MM.YYYY HH:mm')).toBe('dd.mm.yyyy hh:mm');
    expect(dateFormatToExcel('h:mm A')).toBe('h:mm AM/PM');
    expect(dateFormatToExcel('MMMM D, YYYY')).toBe('mmmm d, yyyy');
  });

  it('reads Excel date codes as date or time formats', () => {
    expect(excelToDateFormat('yyyy-mm-dd')).toEqual({ kind: 'date', format: 'YYYY-MM-DD' });
    expect(excelToDateFormat('mm-dd-yy')).toEqual({ kind: 'date', format: 'MM-DD-YY' });
    expect(excelToDateFormat('h:mm:ss')).toEqual({ kind: 'time', format: 'H:mm:ss' });
    expect(excelToDateFormat('h:mm AM/PM')).toEqual({ kind: 'time', format: 'h:mm A' });
    expect(excelToDateFormat('m/d/yy h:mm')).toEqual({ kind: 'datetime', format: 'M/D/YY H:mm' });
    expect(excelToDateFormat('[$-409]mmmm d, yyyy')).toEqual({ kind: 'date', format: 'MMMM D, YYYY' });
    expect(isDateCode('yyyy-mm-dd')).toBe(true);
    expect(isDateCode('#,##0.00')).toBe(false);
    expect(isDateCode('0.00%')).toBe(false);
  });

  it('converts dates to Excel serial numbers and back', () => {
    expect(dateToSerial(new Date(2026, 0, 15))).toBe(46037);
    expect(dateToSerial(new Date(1900, 2, 1))).toBe(61);
    expect(dateToSerial(new Date(2026, 0, 15, 12, 0))).toBe(46037.5);
    expect(serialToDate(46037.5)).toEqual(new Date(2026, 0, 15, 12, 0));
  });
});
