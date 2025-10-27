import { useMemo } from 'react';
import { AlertCircle, Plus, Trash2 } from 'lucide-react';
import type { Datapoint, GLAccountMappingRow, MappingSplitDefinition } from '../../types';
import { calculateSplitAmount, calculateSplitPercentage } from '../../store/mappingStore';

interface MappingSplitRowProps {
  account: GLAccountMappingRow;
  datapoints: Datapoint[];
  colSpan: number;
  panelId?: string;
  onAddSplit: () => void;
  onUpdateSplit: (splitId: string, updates: Partial<MappingSplitDefinition>) => void;
  onRemoveSplit: (splitId: string) => void;
}

const amountFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const clampPercentage = (value: number): number => {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
};

export default function MappingSplitRow({
  account,
  datapoints,
  colSpan,
  panelId,
  onAddSplit,
  onUpdateSplit,
  onRemoveSplit,
}: MappingSplitRowProps) {
  const splitRows = useMemo(() => {
    return account.splitDefinitions.map(split => {
      const percentage = calculateSplitPercentage(account, split);
      const amount = calculateSplitAmount(account, percentage);
      return {
        ...split,
        percentage,
        amount,
      };
    });
  }, [account]);

  const totals = useMemo(() => {
    const percentageTotal = splitRows.reduce((sum, split) => sum + split.percentage, 0);
    const amountTotal = splitRows.reduce((sum, split) => sum + split.amount, 0);
    const remaining = 100 - percentageTotal;
    const isComplete = Math.abs(percentageTotal - 100) <= 0.01;
    return { percentageTotal, amountTotal, remaining, isComplete };
  }, [splitRows]);

  const handlePercentageChange = (splitId: string, value: string) => {
    const numericValue = clampPercentage(Number(value));
    if (account.mappingType === 'dynamic') {
      const nextAmount = calculateSplitAmount(account, numericValue);
      onUpdateSplit(splitId, {
        allocationType: 'amount',
        allocationValue: Number.isFinite(nextAmount) ? nextAmount : 0,
      });
    } else {
      onUpdateSplit(splitId, {
        allocationType: 'percentage',
        allocationValue: numericValue,
      });
    }
  };

  const handleTargetChange = (splitId: string, value: string) => {
    const selected = datapoints.find(option => option.id === value);
    onUpdateSplit(splitId, {
      targetId: value,
      targetName: selected?.accountName ?? value,
    });
  };

  const handleNotesChange = (splitId: string, value: string) => {
    onUpdateSplit(splitId, { notes: value || undefined });
  };

  return (
    <tr>
      <td
        id={panelId}
        colSpan={colSpan}
        className="bg-slate-50 px-4 py-4 dark:bg-slate-800/40"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Allocation splits
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {account.mappingType === 'dynamic'
                  ? 'Percentages determine dynamic amounts based on the current balance.'
                  : 'Ensure 100% allocation across targets.'}
              </p>
            </div>
            <button
              type="button"
              onClick={onAddSplit}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700 dark:focus:ring-offset-slate-900"
            >
              <Plus className="h-4 w-4" />
              Add split
            </button>
          </div>

          {splitRows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
                <thead className="bg-white dark:bg-slate-900/60">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">Target</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">Percentage</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">Amount</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">Notes</th>
                    <th className="px-3 py-2" aria-label="Remove split" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {splitRows.map(split => (
                    <tr key={split.id}>
                      <td className="px-3 py-2">
                        <label className="sr-only" htmlFor={`split-target-${split.id}`}>
                          Select target datapoint
                        </label>
                        <select
                          id={`split-target-${split.id}`}
                          value={split.targetId}
                          onChange={event => handleTargetChange(split.id, event.target.value)}
                          className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                        >
                          <option value="">Select target</option>
                          {datapoints.map(option => (
                            <option key={option.id} value={option.id}>
                              {option.accountName}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <label className="sr-only" htmlFor={`split-percentage-${split.id}`}>
                          Enter percentage allocation
                        </label>
                        <input
                          id={`split-percentage-${split.id}`}
                          type="number"
                          min={0}
                          max={100}
                          step={0.1}
                          value={Number.isFinite(split.percentage) ? split.percentage : 0}
                          onChange={event => handlePercentageChange(split.id, event.target.value)}
                          className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                        />
                        <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">%</span>
                      </td>
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                        {amountFormatter.format(Math.round(split.amount))}
                      </td>
                      <td className="px-3 py-2">
                        <label className="sr-only" htmlFor={`split-notes-${split.id}`}>
                          Enter split notes
                        </label>
                        <input
                          id={`split-notes-${split.id}`}
                          type="text"
                          value={split.notes ?? ''}
                          onChange={event => handleNotesChange(split.id, event.target.value)}
                          placeholder="Optional notes"
                          className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => onRemoveSplit(split.id)}
                          className="inline-flex items-center rounded-md border border-transparent bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 dark:bg-rose-900/30 dark:text-rose-300 dark:hover:bg-rose-900/50 dark:focus:ring-offset-slate-900"
                        >
                          <Trash2 className="mr-1 h-4 w-4" />
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300">Total</td>
                    <td className="px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-100">
                      {totals.percentageTotal.toFixed(1)}%
                    </td>
                    <td className="px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-100">
                      {amountFormatter.format(Math.round(totals.amountTotal))}
                    </td>
                    <td colSpan={2} className="px-3 py-2 text-right text-xs text-slate-500 dark:text-slate-400">
                      Remaining {totals.remaining.toFixed(1)}%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="rounded-md border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
              No split definitions yet. Add splits to distribute this balance.
            </p>
          )}

          {!totals.isComplete && (
            <p className="mt-2 flex items-center gap-2 text-sm text-rose-600 dark:text-rose-300">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              Allocation percentages must equal 100%.
            </p>
          )}
        </div>
      </td>
    </tr>
  );
}
