import React from 'react';
import { AccountRow } from './ExcludeAccounts';

interface PreviewTableProps {
  rows: AccountRow[];
}

export default function PreviewTable({ rows }: PreviewTableProps) {
  if (rows.length === 0) return null;

  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-2">Preview (First 5 Rows)</h3>
      <div className="overflow-auto rounded border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {Object.keys(rows[0]).map((key, colIdx) => (
                <th key={`header-${colIdx}-${key}`} className="p-2 text-left font-medium text-gray-600">
                  {key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 5).map((row, i) => (
              <tr key={i} className="border-t">
                {Object.values(row).map((val, colIdx) => (
                  <td key={`cell-${i}-${colIdx}`} className="p-2 text-gray-800">
                    {val}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
