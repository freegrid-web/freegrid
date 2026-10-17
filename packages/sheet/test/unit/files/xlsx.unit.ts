import { readXlsx, writeXlsx } from '../../../src/files/xlsx';
import { writeZip } from '../../../src/files/zip';
import type { Book } from '../../../src/files/xlsx';

const book = (): Book => ({
  active: 1,
  sheets: [
    {
      name: 'Sales & costs',
      cells: [
        [{ value: 'Region', style: { fontFamily: 'Georgia', fontSize: '14pt', fontWeight: 'bold', background: '#d9e1f2' },
          align: { horizontal: 'center' } },
          { value: 'Q1' }, { value: 'Total' }],
        [{ value: 'North', link: 'https://example.com/north?a=1&b=2' }, { value: 1200.5, numFmt: '#,##0.00' },
          { value: 1200.5, formula: '=B2*1', style: { color: '#c00000', border: '1px solid #000000' } }],
        [{ value: 'Due' }, { value: 46037, numFmt: 'yyyy-mm-dd' },
          // Sides of their own: a thick bottom line and a thin top one.
          { value: true, style: { borderTop: '1px solid #000000', borderBottom: '3px solid #c00000' } }],
        [{ value: '<b>&"quotes"</b>' }, { error: '#DIV/0!', formula: '=1/0' }],
        // Data validation: a list, numbers between, a date after (not strict), with messages.
        [{ value: 'Open', validation: { type: 'list', source: ['Open', 'Done', 'Say "hi"'] } },
          { value: 5, validation: { type: 'integer', operator: 'between', value: 1, value2: 10, message: 'From 1 to 10' } },
          { value: '2026-02-01', validation: { type: 'date', operator: 'greater', value: '2026-01-01', strict: false,
            inputMessage: 'A date in 2026' } }],
      ],
      columnWidths: [120, undefined, 80],
      rowHeights: [40],
      hiddenRows: [2],
      hiddenColumns: [1],
      merges: [{ r1: 3, c1: 1, r2: 3, c2: 2 }],
      frozenRows: 1,
      frozenColumns: 1,
      comments: [{ row: 1, column: 0, text: 'Check this', author: 'Ada' }],
      conditionalFormatting: [
        { range: 'B2:B10', when: 'gt', value: 1000, style: { background: '#ffc7ce', color: '#9c0006' } },
        { range: 'B2:B10', when: 'between', value: [1, 5], style: { fontWeight: 'bold' }, stopIfTrue: true },
        { range: ['A1:A9', 'C1:C9'], when: 'contains', value: 'or', style: { color: '#006100' } },
        { range: 'A1:C9', when: '=$B1<0', style: { fontStyle: 'italic' } },
        { range: 'B:B', when: 'top', value: 10, percent: true, style: { color: '#0000ff' } },
        { range: 'B:B', when: 'belowAverage', style: { color: '#ff0000' } },
        { range: 'C2:C9', when: 'duplicate', style: { background: '#ffeb9c' } },
        { range: 'C2:C9', when: 'date_last_7_days', style: { background: '#ffeb9c' } },
        { range: 'B2:B9', colorScale: ['#f8696b', '#ffeb84', '#63be7b'] },
        { range: 'C2:C9', dataBar: '#638ec6' },
        { range: 'B2:B9', iconSet: 'trafficLights' },
      ],
      // An outline: rows 5 to 8, and inside it rows 6 and 7, collapsed.
      rowGroups: [{ from: 4, to: 7 }, { from: 5, to: 6, collapsed: true }],
    },
    { name: 'Empty', cells: [], columnWidths: [], rowHeights: [], hiddenRows: [], hiddenColumns: [], merges: [],
      frozenRows: 0, frozenColumns: 0, comments: [], conditionalFormatting: [] },
  ],
});

describe('files: xlsx', () => {
  it('writes a workbook and reads the same workbook back', async() => {
    const original = book();
    const read = await readXlsx(await writeXlsx(original));

    expect(read).toEqual(original);
  });

  it('reads shared strings, shared formulas, rows and cells without references, and theme colors', async() => {
    const text = (value: string) => new TextEncoder().encode(value);
    const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
    const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    const P = 'http://schemas.openxmlformats.org/package/2006/relationships';
    const bytes = await writeZip([
      { name: '_rels/.rels', data: text(`<Relationships xmlns="${P}"><Relationship Id="r1" Type="${R}/officeDocument" Target="xl/workbook.xml"/></Relationships>`) },
      { name: 'xl/workbook.xml', data: text(`<workbook xmlns="${NS}" xmlns:r="${R}"><sheets><sheet name="Data" sheetId="1" r:id="rId1"/></sheets></workbook>`) },
      { name: 'xl/_rels/workbook.xml.rels', data: text(`<Relationships xmlns="${P}"><Relationship Id="rId1" Type="${R}/worksheet" Target="/xl/worksheets/s.xml"/><Relationship Id="rId2" Type="${R}/sharedStrings" Target="sharedStrings.xml"/><Relationship Id="rId3" Type="${R}/styles" Target="styles.xml"/></Relationships>`) },
      { name: 'xl/sharedStrings.xml', data: text(`<sst xmlns="${NS}"><si><t>Plain</t></si><si><r><t>Rich </t></r><r><t>text</t></r></si></sst>`) },
      { name: 'xl/styles.xml', data: text(`<styleSheet xmlns="${NS}"><fonts><font/><font><b/><color theme="4"/></font></fonts><fills><fill/><fill/></fills><borders><border/></borders><cellXfs><xf/><xf fontId="1"/></cellXfs></styleSheet>`) },
      { name: 'xl/worksheets/s.xml', data: text(`<worksheet xmlns="${NS}"><sheetData>`
        + '<row><c t="s" s="1"><v>0</v></c><c t="s"><v>1</v></c></row>'
        + '<row><c><v>1</v></c><c><f t="shared" ref="B2:B4" si="0">A2*2</f><v>2</v></c></row>'
        + '<row><c><v>2</v></c><c><f t="shared" si="0"/><v>4</v></c></row>'
        + '</sheetData></worksheet>') },
    ]);
    const read = await readXlsx(bytes);
    const [sheet] = read.sheets;

    expect(sheet.name).toBe('Data');
    expect(sheet.cells[0][0]).toEqual({ value: 'Plain', style: { fontWeight: 'bold', color: '#4472c4' } });
    expect(sheet.cells[0][1]).toEqual({ value: 'Rich text' });
    expect(sheet.cells[1][1]).toEqual({ value: 2, formula: '=A2*2' });
    expect(sheet.cells[2][1]).toEqual({ value: 4, formula: '=A3*2' });
  });

  it('refuses a ZIP that is not a workbook', async() => {
    await expect(readXlsx(await writeZip([{ name: 'a.txt', data: new Uint8Array([1]) }]))).rejects.toThrow(/workbook/);
  });
});
