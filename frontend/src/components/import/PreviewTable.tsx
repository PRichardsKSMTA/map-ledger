import React, { useMemo } from 'react';
import { AccountRow } from './ExcludeAccounts';

interface PreviewTableProps {
  rows: AccountRow[];
  sheetNames?: string[];
  selectedSheetIndex?: number;
  onSheetChange?: (index: number) => void;
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value.toLocaleString() : value.toString();
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (err) {
      return String(value);
    }
  }
  return String(value);
}

export default function PreviewTable({
  rows,
  sheetNames = [],
  selectedSheetIndex = 0,
  onSheetChange,
}: PreviewTableProps) {
  const columnKeys = useMemo(() => {
    const ordered: string[] = [];
    const seen = new Set<string>();

    rows.forEach((row) => {
      Object.keys(row).forEach((key) => {
        if (!seen.has(key)) {
          seen.add(key);
          ordered.push(key);
        }
      });
    });

    return ordered;
  }, [rows]);

  const hasRows = rows.length > 0;
  const hasMultipleSheets = sheetNames.length > 1;

  const handleSheetChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    if (!onSheetChange) return;
    onSheetChange(Number(event.target.value));
  };

  const header = (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
        Preview
        {hasRows
          ? ` (${rows.length.toLocaleString()} ${rows.length === 1 ? 'row' : 'rows'})`
          : ''}
      </h3>
      {hasMultipleSheets && (
        <label className="flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-400">
          <span>Sheet</span>
          <select
            value={selectedSheetIndex}
            onChange={handleSheetChange}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-gray-100"
          >
            {sheetNames.map((name, idx) => (
              <option key={`${name}-${idx}`} value={idx}>
                {name}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );

  if (!hasRows) {
    return (
      <div className="mt-6">
        {header}
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-gray-400">
          No rows to display for this sheet after applying your filters.
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6">
      {header}
      <div className="max-h-96 overflow-auto rounded-lg border border-gray-200 dark:border-slate-700">
        <table className="min-w-full text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-slate-900">
          <thead className="bg-gray-50 text-left dark:bg-slate-800">
            <tr>
              {columnKeys.map((key) => (
                <th
                  key={`header-${key}`}
                  className="sticky top-0 border-b border-gray-200 bg-gray-50 p-2 font-medium text-gray-600 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-300"
                  scope="col"
                >
                  {key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => {
              const rowBackground =
                rowIndex % 2 === 0
                  ? 'bg-white dark:bg-slate-900'
                  : 'bg-gray-50 dark:bg-slate-900/80';

              return (
                <tr
                  key={`row-${rowIndex}`}
                  className={`${rowBackground} border-b border-gray-200 last:border-b-0 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800/70`}
                >
                  {columnKeys.map((key) => (
                    <td
                      key={`cell-${rowIndex}-${key}`}
                      className="p-2 align-top text-gray-800 dark:text-gray-100"
                    >
                      {formatCellValue(row[key])}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
