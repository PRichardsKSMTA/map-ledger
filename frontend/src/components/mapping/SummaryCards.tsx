import { useEffect, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  getAccountExcludedAmount,
  isDynamicAccountNonFinancial,
  selectAccounts,
  selectActiveEntityId,
  selectAvailableEntities,
  selectDistributionTargets,
  selectSummaryMetrics,
  useMappingStore,
} from '../../store/mappingStore';
import { useDistributionStore } from '../../store/distributionStore';
import { useRatioAllocationStore } from '../../store/ratioAllocationStore';
import { useClientStore } from '../../store/clientStore';
import { computeDynamicExclusionSummaries, sumDynamicExclusionAmounts } from '../../utils/dynamicExclusions';
import { formatCurrencyAmount } from '../../utils/currency';
import {
  fetchDistributionPresetsFromApi,
  mapDistributionPresetsToDynamic,
} from '../../services/distributionPresetService';

const SummaryCards = () => {
  const accounts = useMappingStore(selectAccounts);
  const { totalAccounts, mappedAccounts, grossTotal, excludedTotal, unmappedBalance } = useMappingStore(selectSummaryMetrics);
  const distributionTargets = useMappingStore(selectDistributionTargets);
  const activeEntityId = useMappingStore(selectActiveEntityId);
  const availableEntities = useMappingStore(selectAvailableEntities);
  const activeClientId = useClientStore(state => state.activeClientId);
  const { allocations, results, selectedPeriod, basisAccounts, groups } = useRatioAllocationStore(useShallow(state => ({
    allocations: state.allocations,
    results: state.results,
    selectedPeriod: state.selectedPeriod,
    basisAccounts: state.basisAccounts,
    groups: state.groups,
  })));
  const distributionRows = useDistributionStore(state => state.rows);
  const syncRowsFromStandardTargets = useDistributionStore(state => state.syncRowsFromStandardTargets);
  const loadHistoryForEntity = useDistributionStore(state => state.loadHistoryForEntity);
  const setDistributionPresets = useRatioAllocationStore(state => state.setContextPresets);

  const scoaSummarySignature = useMemo(
    () => distributionTargets.map(summary => `${summary.id}:${summary.mappedAmount}`).join('|'),
    [distributionTargets],
  );
  const previousScoaSignature = useRef<string | null>(null);

  // Track which entities have been hydrated to avoid redundant API calls
  const hydratedEntitiesRef = useRef<Set<string>>(new Set());
  const lastClientIdRef = useRef<string | null>(null);

  // Reset hydrated entities when client changes
  useEffect(() => {
    if (lastClientIdRef.current !== activeClientId) {
      hydratedEntitiesRef.current = new Set();
      lastClientIdRef.current = activeClientId ?? null;
    }
  }, [activeClientId]);

  // Hydrate distribution data for all available entities
  // This ensures Review tab has data even when activeEntityId is null
  useEffect(() => {
    let canceled = false;

    const hydrateDistributionData = async () => {
      if (availableEntities.length === 0) {
        return;
      }

      // Find entities that haven't been hydrated yet
      const entitiesToHydrate = availableEntities.filter(
        entity => !hydratedEntitiesRef.current.has(entity.id)
      );

      if (entitiesToHydrate.length === 0) {
        return;
      }

      // Hydrate each entity's distribution data
      for (const entity of entitiesToHydrate) {
        if (canceled) {
          return;
        }

        try {
          const payload = await fetchDistributionPresetsFromApi(entity.id);
          if (canceled) {
            return;
          }
          const dynamicPresets = mapDistributionPresetsToDynamic(payload);
          setDistributionPresets('distribution', dynamicPresets);
          await loadHistoryForEntity(entity.id);
          hydratedEntitiesRef.current.add(entity.id);
        } catch (error) {
          console.error(`Unable to load distribution data for entity ${entity.id}`, error);
        }
      }
    };

    void hydrateDistributionData();

    return () => {
      canceled = true;
    };
  }, [availableEntities, loadHistoryForEntity, setDistributionPresets]);

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
