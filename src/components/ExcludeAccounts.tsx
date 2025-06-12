import React, { useEffect, useState } from 'react';

export interface AccountRow {
  entity: string;
  accountId: string;
  description: string;
  netChange: number;
  [key: string]: any;
}

interface ExcludeAccountsProps {
  rows: AccountRow[];
  onConfirm: (included: AccountRow[], excluded: AccountRow[]) => void;
}

export default function ExcludeAccounts({ rows, onConfirm }: ExcludeAccountsProps) {
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());

  const toggleExclude = (id: string) => {
    setExcludedIds(prev => {
      const updated = new Set(prev);
      if (updated.has(id)) {
        updated.delete(id);
      } else {
        updated.add(id);
      }
      return updated;
    });
  };

  const included = rows.filter(r => !excludedIds.has(r.accountId));
  const excluded = rows.filter(r => excludedIds.has(r.accountId));

  useEffect(() => {
    // Auto-exclude typical balance sheet accounts (simple example)
    const balanceSheetHints = ['asset', 'liability', 'equity'];
    const defaultExcludes = new Set(
      rows
        .filter(r => balanceSheetHints.some(h => r.description.toLowerCase().includes(h)))
        .map(r => r.accountId)
    );
    setExcludedIds(defaultExcludes);
  }, [rows]);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-800">Review and Exclude Accounts</h2>
      <p className="text-sm text-gray-600">Uncheck any accounts you want included in mapping. By default, balance sheet accounts are excluded.</p>

      <table className="min-w-full text-sm border">
        <thead>
          <tr className="bg-gray-50 text-left">
            <th className="p-2">Exclude</th>
            <th className="p-2">Entity</th>
            <th className="p-2">Account ID</th>
            <th className="p-2">Description</th>
            <th className="p-2 text-right">Net Change</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.accountId} className="border-t hover:bg-gray-50">
              <td className="p-2">
                <input
                  type="checkbox"
                  checked={excludedIds.has(row.accountId)}
                  onChange={() => toggleExclude(row.accountId)}
                />
              </td>
              <td className="p-2">{row.entity}</td>
              <td className="p-2">{row.accountId}</td>
              <td className="p-2">{row.description}</td>
              <td className="p-2 text-right">{row.netChange.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-between">
        <div className="text-sm text-gray-600">
          Included: {included.length} • Excluded: {excluded.length}
        </div>
        <button
          onClick={() => onConfirm(included, excluded)}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
        >
          Confirm Exclusions
        </button>
      </div>
    </div>
  );
}
