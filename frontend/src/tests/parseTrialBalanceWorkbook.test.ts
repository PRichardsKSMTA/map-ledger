import ExcelJS from 'exceljs';

import { parseTrialBalanceWorkbook } from '../utils/parseTrialBalanceWorkbook';

describe('parseTrialBalanceWorkbook', () => {
  it('combines multi-line headers and returns data rows', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Trial balance report 2025');

    sheet.getCell('B1').value = 'Gulf Relay, LLC';
    sheet.getCell('B2').value = 'Trial balance report';
    sheet.getCell('B4').value = '2024-09';

    sheet.getRow(7).values = [
      undefined,
      'Account',
      'Account',
      'Opening balance',
      'Debit',
      'Credit',
      'Closing balance',
    ];
    sheet.getRow(8).values = [
      undefined,
      'Number',
      'Name',
      'on 09/30/2024',
      '',
      '',
      'on 09/30/2024',
    ];

    sheet.getRow(9).values = [
      undefined,
      4050,
      'Revenue - Line Haul',
      1000,
      0,
      0,
      5000,
    ];
    sheet.getRow(10).values = [
      undefined,
      4060,
      'Revenue - Storage',
      0,
      0,
      0,
      2500,
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    const file = {
      arrayBuffer: async () => buffer,
    } as unknown as File;

    const parsed = await parseTrialBalanceWorkbook(file);

    expect(parsed).toHaveLength(1);

    const [result] = parsed;
    expect(result.headers).toEqual([
      'Account Number',
      'Account Name',
      'Opening balance on 09/30/2024',
      'Debit',
      'Credit',
      'Closing balance on 09/30/2024',
    ]);
    expect(result.rows).toHaveLength(2);

    expect(result.rows[0]['Account Number']).toBe(4050);
    expect(result.rows[0]['Account Name']).toBe('Revenue - Line Haul');
    expect(result.rows[0]['Closing balance on 09/30/2024']).toBe(5000);

    expect(result.rows[1]['Account Number']).toBe(4060);
  });
});
