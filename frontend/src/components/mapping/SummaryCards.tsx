import { useMemo } from 'react';
import { useMappingStore } from '../../store/mappingStore';
import { useRatioAllocationStore } from '../../store/ratioAllocationStore';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

const SummaryCards = () => {
  const accounts = useMappingStore(state => state.accounts);
  const { allocations, results, selectedPeriod } = useRatioAllocationStore(state => ({
    allocations: state.allocations,
    results: state.results,
    selectedPeriod: state.selectedPeriod,
  }));

  const { totalAccounts, mappedAccounts, pendingAllocations, totalBalance, periodResult } = useMemo(() => {
    const total = accounts.length;
    const mapped = accounts.filter(account => account.manualCOAId || account.suggestedCOAId).length;
    const balance = accounts.reduce((sum, account) => sum + account.balance, 0);
    const needsAllocation = accounts.filter(account =>
      account.distributionMethod !== 'None' && !allocations.some(allocation => allocation.sourceAccount.id === account.id)
    ).length;
    const activePeriodResult = selectedPeriod
      ? results.find(result => result.periodId === selectedPeriod)
      : undefined;

    return {
      totalAccounts: total,
      mappedAccounts: mapped,
      pendingAllocations: needsAllocation,
      totalBalance: balance,
      periodResult: activePeriodResult,
    };
  }, [accounts, allocations, results, selectedPeriod]);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <p className="text-sm text-gray-500 dark:text-gray-400">Total GL accounts</p>
        <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{totalAccounts}</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{mappedAccounts} mapped</p>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <p className="text-sm text-gray-500 dark:text-gray-400">Distribution rules</p>
        <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{allocations.length}</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{pendingAllocations} pending setup</p>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <p className="text-sm text-gray-500 dark:text-gray-400">Total balance</p>
        <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{formatCurrency(totalBalance)}</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Across all mapped accounts</p>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <p className="text-sm text-gray-500 dark:text-gray-400">Current period allocations</p>
        <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
          {periodResult ? `${periodResult.allocations.length}` : '—'}
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {selectedPeriod ? `Period ${selectedPeriod}` : 'Select a reporting period'}
        </p>
      </div>
    </div>
  );
};

export default SummaryCards;
