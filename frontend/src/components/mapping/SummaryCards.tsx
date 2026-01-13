import { useEffect, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  getAccountExcludedAmount,
  isDynamicAccountNonFinancial,
  selectAccounts,
  selectActiveEntityId,
  selectDistributionTargets,
  selectSummaryMetrics,
  useMappingStore,
} from '../../store/mappingStore';
import { useDistributionStore } from '../../store/distributionStore';
import { useRatioAllocationStore } from '../../store/ratioAllocationStore';
import { computeDynamicExclusionSummaries, sumDynamicExclusionAmounts } from '../../utils/dynamicExclusions';
import { formatCurrencyAmount } from '../../utils/currency';

const SummaryCards = () => {
  const accounts = useMappingStore(selectAccounts);
  const { totalAccounts, mappedAccounts, grossTotal, excludedTotal, unmappedBalance } = useMappingStore(selectSummaryMetrics);
  const distributionTargets = useMappingStore(selectDistributionTargets);
  const activeEntityId = useMappingStore(selectActiveEntityId);
  const { allocations, results, selectedPeriod, basisAccounts, groups } = useRatioAllocationStore(useShallow(state => ({
    allocations: state.allocations,
    results: state.results,
    selectedPeriod: state.selectedPeriod,
    basisAccounts: state.basisAccounts,
    groups: state.groups,
  })));
  const distributionRows = useDistributionStore(state => state.rows);
  const syncRowsFromStandardTargets = useDistributionStore(state => state.syncRowsFromStandardTargets);

  const scoaSummarySignature = useMemo(
    () => distributionTargets.map(summary => `${summary.id}:${summary.mappedAmount}`).join('|'),
    [distributionTargets],
  );
  const previousScoaSignature = useRef<string | null>(null);

  useEffect(() => {
    if (scoaSummarySignature === previousScoaSignature.current) {
      return;
    }
    previousScoaSignature.current = scoaSummarySignature;
    syncRowsFromStandardTargets(distributionTargets);
  }, [distributionTargets, scoaSummarySignature, syncRowsFromStandardTargets]);

  const dynamicAccounts = useMemo(
    () =>
      accounts.filter(
        account => account.mappingType === 'dynamic' && !isDynamicAccountNonFinancial(account),
      ),
    [accounts],
  );

  const dynamicExclusionSummaries = useMemo(
    () =>
      computeDynamicExclusionSummaries({
        accounts: dynamicAccounts,
        allocations,
        basisAccounts,
        groups,
        selectedPeriod,
        results,
      }),
    [allocations, basisAccounts, dynamicAccounts, groups, results, selectedPeriod],
  );

  const adjustedTotals = useMemo(() => {
    const dynamicOverrideTotal = sumDynamicExclusionAmounts(dynamicExclusionSummaries);
    const baselineDynamicExcluded = dynamicAccounts
      .reduce((sum, account) => sum + getAccountExcludedAmount(account), 0);
    const normalizedExcludedTotal = excludedTotal - baselineDynamicExcluded + dynamicOverrideTotal;
    const normalizedNetTotal = grossTotal - normalizedExcludedTotal;
    return {
      excluded: normalizedExcludedTotal,
      net: normalizedNetTotal,
    };
  }, [dynamicAccounts, dynamicExclusionSummaries, excludedTotal, grossTotal]);

  const mappedCoverage = Math.round((mappedAccounts / Math.max(totalAccounts, 1)) * 100);

  const { distributedAccounts, distributionCoverage } = useMemo(() => {
    const rowsWithActivity = distributionRows.filter(row => Math.abs(row.activity) > 0);
    const distributedCount = rowsWithActivity.filter(row => row.status === 'Distributed').length;
    const coverage = Math.round((distributedCount / Math.max(rowsWithActivity.length, 1)) * 100);

    return {
      distributedAccounts: distributedCount,
      distributionCoverage: coverage,
    };
  }, [distributionRows]);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <p className="text-sm text-gray-500 dark:text-gray-400">Mapped accounts</p>
        <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
          {mappedAccounts} / {totalAccounts}
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{mappedCoverage}% coverage</p>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <p className="text-sm text-gray-500 dark:text-gray-400">Unmapped balance</p>
        <p className={`mt-2 text-2xl font-semibold ${unmappedBalance === 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
          {formatCurrencyAmount(unmappedBalance)}
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {unmappedBalance === 0 ? 'All accounts mapped' : `${totalAccounts - mappedAccounts} accounts remaining`}
        </p>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <p className="text-sm text-gray-500 dark:text-gray-400">Total balance</p>
        <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
          {formatCurrencyAmount(grossTotal)}
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Net after exclusions {formatCurrencyAmount(adjustedTotals.net)}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Excluded {formatCurrencyAmount(adjustedTotals.excluded)}
        </p>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <p className="text-sm text-gray-500 dark:text-gray-400">Distributed SCOA accounts</p>
        <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
          {distributedAccounts.toLocaleString()}
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {`${distributionCoverage}% coverage`}
        </p>
      </div>
    </div>
  );
};

export default SummaryCards;
