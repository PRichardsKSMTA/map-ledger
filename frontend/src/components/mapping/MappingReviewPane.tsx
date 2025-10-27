import { useMemo, useState } from 'react';
import { useRatioAllocationStore } from '../../store/ratioAllocationStore';
import {
  selectAccounts,
  selectSummaryMetrics,
  selectSplitValidationIssues,
  useMappingStore,
} from '../../store/mappingStore';

const MappingReviewPane = () => {
  const accounts = useMappingStore(selectAccounts);
  const { mappedAccounts, grossTotal, excludedTotal, netTotal } = useMappingStore(selectSummaryMetrics);
  const splitIssues = useMappingStore(selectSplitValidationIssues);
  const finalizeMappings = useMappingStore(state => state.finalizeMappings);
  const { results, selectedPeriod, isProcessing } = useRatioAllocationStore(state => ({
    results: state.results,
    selectedPeriod: state.selectedPeriod,
    isProcessing: state.isProcessing,
  }));
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const periodResult = useMemo(
    () => (selectedPeriod ? results.find(result => result.periodId === selectedPeriod) : undefined),
    [results, selectedPeriod]
  );

  const warnings = useMemo(() => {
    if (splitIssues.length === 0) {
      return [] as { accountName: string; message: string }[];
    }
    const accountLookup = new Map(accounts.map(account => [account.id, account]));
    return splitIssues.map(issue => {
      const account = accountLookup.get(issue.accountId);
      return {
        accountName: account ? `${account.accountId} — ${account.accountName}` : issue.accountId,
        message: issue.message,
      };
    });
  }, [accounts, splitIssues]);

  const handleRunChecks = () => {
    if (warnings.length > 0) {
      setStatusMessage('Checks complete — resolve the warnings below before publishing.');
    } else {
      setStatusMessage('All validations passed. You can publish your mappings.');
    }
  };

  const handlePublish = () => {
    if (warnings.length > 0) {
      setStatusMessage('Publishing blocked. Fix allocation warnings first.');
      return;
    }
    const success = finalizeMappings([]);
    if (success) {
      setStatusMessage('Mappings published successfully.');
    } else {
      setStatusMessage('Publishing failed due to validation issues.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Review summary</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Confirm your mappings and allocations before publishing results to the reporting suite.
        </p>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md bg-gray-50 p-4 dark:bg-slate-800">
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Mapped GL accounts</dt>
            <dd className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{mappedAccounts}</dd>
          </div>
          <div className="rounded-md bg-gray-50 p-4 dark:bg-slate-800">
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Gross balance</dt>
            <dd className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
              {grossTotal.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
            </dd>
          </div>
          <div className="rounded-md bg-gray-50 p-4 dark:bg-slate-800">
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Selected reporting period</dt>
            <dd className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
              {selectedPeriod ?? 'Not selected'}
            </dd>
          </div>
          <div className="rounded-md bg-gray-50 p-4 dark:bg-slate-800">
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Net after exclusions</dt>
            <dd className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
              {netTotal.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
            </dd>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Excluded {excludedTotal.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
            </p>
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

      <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Review warnings</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Address outstanding issues before publishing final mappings.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleRunChecks}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-slate-600 dark:text-gray-200 dark:hover:bg-slate-800 dark:focus:ring-offset-slate-900"
            >
              Run checks
            </button>
            <button
              type="button"
              onClick={handlePublish}
              disabled={warnings.length > 0}
              className={`rounded-md px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${
                warnings.length > 0
                  ? 'cursor-not-allowed bg-slate-200 text-slate-500 focus:ring-0 dark:bg-slate-800 dark:text-slate-500'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400'
              }`}
            >
              Publish
            </button>
          </div>
        </div>
        {statusMessage && (
          <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200" role="status">
            {statusMessage}
          </p>
        )}
        {warnings.length > 0 ? (
          <ul className="space-y-2">
            {warnings.map(warning => (
              <li
                key={`${warning.accountName}-${warning.message}`}
                className="flex items-start gap-2 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/40 dark:text-rose-200"
              >
                <span className="font-medium">{warning.accountName}</span>
                <span className="text-rose-600 dark:text-rose-200">— {warning.message}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-emerald-700 dark:text-emerald-300">No outstanding warnings.</p>
        )}
      </div>
    </div>
  );
};

export default MappingReviewPane;
