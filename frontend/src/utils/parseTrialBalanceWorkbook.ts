import type { Worksheet } from 'exceljs';

export interface TrialBalanceRow {
  [key: string]: string | number;
}

export interface ParsedUpload {
  sheetName: string;
  period: string;
  headers: string[];
  rows: TrialBalanceRow[];
  metadata: Record<string, string>; // stores entity, glMonth, etc.
}

let excelJsModulePromise: Promise<typeof import('exceljs')> | null = null;

async function loadExcelJs() {
  if (!excelJsModulePromise) {
    excelJsModulePromise = import('exceljs');
  }

  return excelJsModulePromise;
}

function getCellValue(sheet: Worksheet, cellRef: string): string {
  const cell = sheet.getCell(cellRef);
  return (typeof cell.value === 'string' || typeof cell.value === 'number') ? cell.value.toString().trim() : '';
}

export async function parseTrialBalanceWorkbook(file: File): Promise<ParsedUpload[]> {
  const buffer = await file.arrayBuffer();
  const ExcelJS = await loadExcelJs();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const results: ParsedUpload[] = [];

  workbook.worksheets.forEach((sheet) => {
    let headers: string[] = [];
    let headerRowFound = false;
    const rows: TrialBalanceRow[] = [];

    const metadata: Record<string, string> = {
      entity: getCellValue(sheet, 'B1'),
      glMonth: getCellValue(sheet, 'B4'),
      reportName: getCellValue(sheet, 'B2')
    };

    sheet.eachRow((row, rowNumber) => {
      const rawValues = row.values;
      if (!Array.isArray(rawValues)) return;
      const values = rawValues.slice(1);

      if (!headerRowFound && values.filter(Boolean).length > 2) {
        headers = values.map((val, i) => {
          if (typeof val === 'string') return val.trim();
          return `Column ${String.fromCharCode(65 + i)}`;
        });
        headerRowFound = true;
        return;
      }

      if (headerRowFound && values.filter(Boolean).length > 0) {
        const rowObj: TrialBalanceRow = {};
        values.forEach((val, i) => {
          const key = headers[i] || `Column ${String.fromCharCode(65 + i)}`;
          if (val !== null && val !== undefined) {
            if (typeof val === 'string') {
              rowObj[key] = val.trim();
            } else if (typeof val === 'number') {
              rowObj[key] = val;
            } else {
              rowObj[key] = val.toString();
            }
          }
        });
        rows.push(rowObj);
      }
    });

    if (rows.length > 0 && headers.length > 0) {
      results.push({
        sheetName: sheet.name,
        period: sheet.name.replace('Export ', ''),
        headers,
        rows,
        metadata
      });
    }
  });

  return results;
}
