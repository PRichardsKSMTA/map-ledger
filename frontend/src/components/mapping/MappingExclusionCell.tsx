import { useMemo } from 'react';
import type { GLAccountMappingRow, MappingExclusionType } from '../../types';
import {
  getAccountExcludedAmount,
  getAllocatableNetChange,
  useMappingStore,
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
  const updateExclusion = useMappingStore(state => state.updateExclusion);
  const { allocations } = useRatioAllocationStore(state => ({ allocations: state.allocations }));

  const exclusionType: MappingExclusionType = account.exclusion?.type ?? 'none';
  const excludedAmount = getAccountExcludedAmount(account);
  const remainingAmount = getAllocatableNetChange(account);
  const isFullyExcluded = account.mappingType === 'exclude' || account.status === 'Excluded';

  const allocation = useMemo(
    () => allocations.find(item => item.sourceAccount.id === account.id),
    [account.id, allocations],
  );

  const dynamicOptions = useMemo(
    () =>
      allocation
        ? allocation.targetDatapoints.map(target => ({ id: target.datapointId, label: target.name }))
        : [],
    [allocation],
  );

  const handleTypeChange = (type: MappingExclusionType) => {
    if (type === 'none') {
      updateExclusion(account.id, { type: 'none' });
      return;
    }

    if (type === 'amount') {
      updateExclusion(account.id, { type: 'amount', amount: account.exclusion?.amount ?? 0 });
      return;
    }

    if (type === 'percentage') {
      updateExclusion(account.id, {
        type: 'percentage',
        percentage: account.exclusion?.percentage ?? 0,
      });
      return;
    }

    updateExclusion(account.id, {
      type: 'dynamic',
      datapointId: account.exclusion?.datapointId ?? (dynamicOptions[0]?.id ?? ''),
      datapointName: account.exclusion?.datapointName ?? dynamicOptions[0]?.label,
    });
  };

  const handleAmountChange = (value: string) => {
    const numeric = Number(value);
    const safeAmount = Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
    updateExclusion(account.id, { type: 'amount', amount: safeAmount });
  };

  const handlePercentageChange = (value: string) => {
    const numeric = Number(value);
    const safePercentage = Number.isFinite(numeric) ? Math.min(Math.max(numeric, 0), 100) : 0;
    updateExclusion(account.id, { type: 'percentage', percentage: safePercentage });
  };

  const handleDynamicOptionChange = (datapointId: string) => {
    const selected = dynamicOptions.find(option => option.id === datapointId);
    updateExclusion(account.id, {
      type: 'dynamic',
      datapointId,
      datapointName: selected?.label,
    });
  };

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

      <div className="space-y-2">
        <div>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300" htmlFor={`exclusion-type-${account.id}`}>
            Exclusion type
          </label>
          <select
            id={`exclusion-type-${account.id}`}
            value={exclusionType}
            onChange={event => handleTypeChange(event.target.value as MappingExclusionType)}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="none">No exclusion</option>
            <option value="amount">Fixed amount</option>
            <option value="percentage">Percentage of balance</option>
            <option value="dynamic" disabled={dynamicOptions.length === 0}>
              Dynamic datapoint
            </option>
          </select>
        </div>

        {exclusionType === 'amount' && (
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300" htmlFor={`exclusion-amount-${account.id}`}>
              Amount to exclude
            </label>
            <input
              id={`exclusion-amount-${account.id}`}
              type="number"
              min="0"
              step="100"
              value={account.exclusion?.amount ?? ''}
              onChange={event => handleAmountChange(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
        )}

        {exclusionType === 'percentage' && (
          <div>
            <label
              className="text-xs font-medium text-slate-600 dark:text-slate-300"
              htmlFor={`exclusion-percentage-${account.id}`}
            >
              Percentage to exclude
            </label>
            <input
              id={`exclusion-percentage-${account.id}`}
              type="number"
              min="0"
              max="100"
              step="1"
              value={account.exclusion?.percentage ?? ''}
              onChange={event => handlePercentageChange(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
        )}

        {exclusionType === 'dynamic' && (
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300" htmlFor={`exclusion-dynamic-${account.id}`}>
              Dynamic datapoint
            </label>
            <select
              id={`exclusion-dynamic-${account.id}`}
              value={account.exclusion?.datapointId ?? ''}
              onChange={event => handleDynamicOptionChange(event.target.value)}
              disabled={dynamicOptions.length === 0}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:disabled:bg-slate-800"
            >
              <option value="">Select datapoint</option>
              {dynamicOptions.map(option => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            {dynamicOptions.length === 0 && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Add dynamic allocation targets to enable exclusion by datapoint.
              </p>
            )}
            {account.exclusion?.datapointName && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Resolved from {account.exclusion.datapointName}.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MappingExclusionCell;
