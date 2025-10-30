import { useMemo } from 'react';
import type { GLAccountMappingRow } from '../../types';
import {
  calculateSplitAmount,
  calculateSplitPercentage,
  getAccountExcludedAmount,
  getAllocatableNetChange,
} from '../../store/mappingStore';
import { useRatioAllocationStore } from '../../store/ratioAllocationStore';

interface MappingExclusionCellProps {
  account: GLAccountMappingRow;
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const formatCurrency = (value: number): string => currencyFormatter.format(value);

const MappingExclusionCell = ({ account }: MappingExclusionCellProps) => {
  const { allocations, selectedPeriod } = useRatioAllocationStore(state => ({
    allocations: state.allocations,
    selectedPeriod: state.selectedPeriod,
  }));

  const excludedAmount = Math.abs(getAccountExcludedAmount(account));
  const remainingAmount = Math.abs(getAllocatableNetChange(account));
  const isFullyExcluded = account.mappingType === 'exclude' || account.status === 'Excluded';

  const percentageExclusions = useMemo(() => {
    return account.splitDefinitions
      .filter(split => split.isExclusion)
      .map(split => ({
        id: split.id,
        percentage: Math.round(calculateSplitPercentage(account, split)),
        amount: calculateSplitAmount(account, split),
        notes: split.notes,
      }));
  }, [account]);

  const allocation = useMemo(
    () => allocations.find(item => item.sourceAccount.id === account.id) ?? null,
    [account.id, allocations],
  );

  const dynamicExclusions = useMemo(() => {
    if (!allocation) {
      return [] as { id: string; name: string }[];
    }
    return allocation.targetDatapoints
      .filter(target => target.isExclusion)
      .map(target => ({ id: target.datapointId, name: target.name }));
  }, [allocation]);

  if (isFullyExcluded) {
    return (
      <div className="space-y-1">
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Entire balance excluded</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          This account is fully excluded from mapping. Change the status to restore allocation controls.
        </p>
      </div>
    );
  }

  if (account.mappingType === 'percentage') {
    if (account.splitDefinitions.length === 0) {
      return (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">No splits configured</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Add percentage splits below and mark any rows that should be excluded instead of mapped to a target account.
          </p>
        </div>
      );
    }

    if (percentageExclusions.length === 0) {
      return (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">No exclusions selected</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Use the split editor to mark specific allocation rows as “Exclude” when part of this balance should be dropped from mapping.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
            Excluding {formatCurrency(excludedAmount)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Remaining balance {formatCurrency(remainingAmount)}
          </p>
        </div>
        <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
          {percentageExclusions.map(split => (
            <li key={split.id}>
              <span className="font-medium">{split.percentage}%</span> · {formatCurrency(split.amount)}
              {split.notes ? ` — ${split.notes}` : ''}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (account.mappingType === 'dynamic') {
    if (!allocation) {
      return (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">No dynamic allocation configured</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Launch the dynamic allocation builder to define datapoints and mark any exclusions.
          </p>
        </div>
      );
    }

    if (dynamicExclusions.length === 0) {
      return (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">No datapoints excluded</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Open the dynamic allocation builder and mark one or more datapoints as excluded to remove them from the mapped results.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
            Excluding {formatCurrency(excludedAmount)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Remaining balance {formatCurrency(remainingAmount)}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Excluded datapoints</p>
          <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
            {dynamicExclusions.map(target => (
              <li key={target.id}>{target.name}</li>
            ))}
          </ul>
          {excludedAmount === 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-300">
              Run the dynamic allocation for {selectedPeriod ?? 'the selected period'} to resolve exclusion totals.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">No partial exclusions</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Switch the mapping type to Percentage or Dynamic to exclude only part of this balance.
      </p>
    </div>
  );
};

export default MappingExclusionCell;
