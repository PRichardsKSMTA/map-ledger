import Papa from 'papaparse';
import * as ExcelJS from 'exceljs';

export interface COARow {
  [key: string]: string | number;
}

function normalize(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export async function parseCOATemplateFile(file: File): Promise<COARow[]> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'csv') {
    return new Promise((resolve, reject) => {
      Papa.parse<COARow>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (r) => resolve(r.data as COARow[]),
        error: (e) => reject(e),
      });
    });
  }

  if (ext === 'xlsx') {
    const buffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) return [];
    const headerRow = sheet.getRow(1);
    const headers = headerRow.values
      ? (headerRow.values as Array<string>).slice(1).map((h) => String(h))
      : [];
    const rows: COARow[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const vals = row.values as Array<string | number>;
      if (!Array.isArray(vals)) return;
      const obj: COARow = {};
      vals.slice(1).forEach((val, idx) => {
        if (val !== undefined && val !== null && val !== '') {
          obj[headers[idx]] = typeof val === 'string' ? val.trim() : val;
        }
      });
      if (Object.keys(obj).length > 0) rows.push(obj);
    });
    return rows;
  }
  throw new Error('Unsupported file type');
}
