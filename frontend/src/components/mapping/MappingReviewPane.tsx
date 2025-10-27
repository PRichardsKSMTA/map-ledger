import { useMemo } from 'react';
import { useRatioAllocationStore } from '../../store/ratioAllocationStore';
import { useMappingStore } from '../../store/mappingStore';

const MappingReviewPane = () => {
  const accounts = useMappingStore(state => state.accounts);
  const { results, selectedPeriod, isProcessing } = useRatioAllocationStore(state => ({
    results: state.results,
    selectedPeriod: state.selectedPeriod,
    isProcessing: state.isProcessing,
  }));

  const periodResult = useMemo(
    () => (selectedPeriod ? results.find(result => result.periodId === selectedPeriod) : undefined),
    [results, selectedPeriod]
  );

  const totalMapped = useMemo(
    () => accounts.filter(account => account.manualCOAId || account.suggestedCOAId).length,
    [accounts]
  );

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Review summary</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Confirm your mappings and allocations before publishing results to the reporting suite.
        </p>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-md bg-gray-50 p-4 dark:bg-slate-800">
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Mapped GL accounts</dt>
            <dd className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{totalMapped}</dd>
          </div>
          <div className="rounded-md bg-gray-50 p-4 dark:bg-slate-800">
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Selected reporting period</dt>
            <dd className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
              {selectedPeriod ?? 'Not selected'}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-slate-700">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Allocation preview</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {selectedPeriod
                ? 'Allocation results for the selected reporting period.'
                : 'Choose a reporting period to preview allocation results.'}
            </p>
          </div>
          {isProcessing && (
            <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/60 dark:text-blue-100">
              Calculating...
            </span>
          )}
        </div>
        <div className="px-6 py-4">
          {periodResult ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-slate-700">
                <thead className="bg-gray-50 text-left dark:bg-slate-800">
                  <tr>
                    <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-300">Datapoint</th>
                    <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-300">Allocated amount</th>
                    <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-300">Percentage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                  {periodResult.allocations.map(allocation => (
                    <tr key={allocation.datapointId}>
                      <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{allocation.datapointId}</td>
                      <td className="px-4 py-3 text-gray-900 dark:text-gray-100">
                        {allocation.value.toLocaleString('en-US', {
                          style: 'currency',
                          currency: 'USD',
                          maximumFractionDigits: 0,
                        })}
                      </td>
                      <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{allocation.percentage.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {selectedPeriod
                ? 'No allocations have been calculated for this period yet.'
                : 'Select a reporting period above to calculate allocations.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MappingReviewPane;
