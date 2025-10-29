import { useMemo } from 'react';
import { AlertTriangle, Calculator, Layers } from 'lucide-react';
import type { GLAccountMappingRow } from '../../types';
import { useRatioAllocationStore } from '../../store/ratioAllocationStore';
import {
  allocateDynamic,
  getGroupMembersWithValues,
  getGroupTotal,
  getSourceValue,
} from '../../utils/dynamicAllocation';

interface DynamicAllocationRowProps {
  account: GLAccountMappingRow;
  colSpan: number;
  panelId: string;
  onOpenBuilder: () => void;
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const basisFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const pluralize = (value: number, noun: string) =>
  `${value} ${noun}${value === 1 ? '' : 's'}`;

const DynamicAllocationRow = ({
  account,
  colSpan,
  panelId,
  onOpenBuilder,
}: DynamicAllocationRowProps) => {
  const {
    allocations,
    groups,
    basisAccounts,
    sourceAccounts,
    selectedPeriod,
    results,
    validationErrors,
  } = useRatioAllocationStore(state => ({
    allocations: state.allocations,
    groups: state.groups,
    basisAccounts: state.basisAccounts,
    sourceAccounts: state.sourceAccounts,
    selectedPeriod: state.selectedPeriod,
    results: state.results,
    validationErrors: state.validationErrors,
  }));

  const allocation = useMemo(
    () => allocations.find(item => item.sourceAccount.id === account.id),
    [account.id, allocations],
  );

  const sourceAccount = useMemo(
    () => sourceAccounts.find(item => item.id === account.id),
    [account.id, sourceAccounts],
  );

  const sourceValue = useMemo(() => {
    if (!sourceAccount) {
      return account.netChange;
    }
    return getSourceValue(sourceAccount, selectedPeriod);
  }, [account.netChange, selectedPeriod, sourceAccount]);

  const targetSummaries = useMemo(() => {
    if (!allocation) {
      return [] as {
        id: string;
        name: string;
        metricName: string;
        basisTotal: number;
        memberValues: ReturnType<typeof getGroupMembersWithValues>;
      }[];
    }

    return allocation.targetDatapoints.map(target => {
      const group = target.groupId
        ? groups.find(item => item.id === target.groupId)
        : undefined;
      const memberValues = group
        ? getGroupMembersWithValues(group, basisAccounts, selectedPeriod)
        : [];
      const basisTotal = group
        ? getGroupTotal(group, basisAccounts, selectedPeriod)
        : target.ratioMetric.value;
      return {
        id: target.datapointId,
        name: target.name,
        metricName: target.ratioMetric.name,
        basisTotal,
        memberValues,
      };
    });
  }, [allocation, basisAccounts, groups, selectedPeriod]);

  const basisTotal = useMemo(
    () => targetSummaries.reduce((sum, summary) => sum + summary.basisTotal, 0),
    [targetSummaries],
  );

  const periodResult = useMemo(() => {
    if (!allocation || !selectedPeriod) {
      return null;
    }
    return (
      results.find(
        result =>
          result.periodId === selectedPeriod && result.allocationId === allocation.id,
      ) ?? null
    );
  }, [allocation, results, selectedPeriod]);

  const allocationIssues = useMemo(() => {
    const relevant = validationErrors.filter(
      issue => issue.sourceAccountId === account.id,
    );
    if (!selectedPeriod) {
      return relevant;
    }
    return relevant.filter(issue => issue.periodId === selectedPeriod);
  }, [account.id, selectedPeriod, validationErrors]);

  const computedPreview = useMemo(() => {
    if (periodResult) {
      return {
        allocations: periodResult.allocations.map(target => ({
          targetId: target.targetId,
          targetName: target.targetName,
          value: target.value,
          percentage: target.percentage,
        })),
        adjustment: periodResult.adjustment
          ? {
              amount: periodResult.adjustment.amount,
              targetName:
                periodResult.allocations.find(
                  target => target.targetId === periodResult.adjustment?.targetId,
                )?.targetName ?? null,
            }
          : null,
      } as const;
    }

    if (!allocation || targetSummaries.length === 0 || basisTotal <= 0) {
      return null;
    }

    try {
      const computation = allocateDynamic(
        sourceValue,
        targetSummaries.map(summary => summary.basisTotal),
      );

      const allocations = targetSummaries.map((summary, index) => {
        const ratio = basisTotal > 0 ? summary.basisTotal / basisTotal : 0;
        return {
          targetId: summary.id,
          targetName: summary.name,
          value: computation.allocations[index] ?? 0,
          percentage: ratio * 100,
        };
      });

      const adjustment =
        computation.adjustmentIndex !== null
          ? {
              amount: computation.adjustmentAmount,
              targetName:
                targetSummaries[computation.adjustmentIndex]?.name ?? null,
            }
          : null;

      return { allocations, adjustment } as const;
    } catch (error) {
      console.warn('Failed to derive preview for dynamic allocation row', error);
      return null;
    }
  }, [
    allocation,
    basisTotal,
    periodResult,
    sourceValue,
    targetSummaries,
  ]);

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
                Dynamic allocation overview
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ratios are derived from operational datapoints that drive this account.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenBuilder}
              className="inline-flex items-center gap-2 rounded-md border border-emerald-500 px-3 py-1.5 text-xs font-medium text-emerald-600 shadow-sm transition hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:border-emerald-400 dark:text-emerald-200 dark:hover:bg-emerald-500/10 dark:focus:ring-offset-slate-900"
            >
              <Calculator className="h-4 w-4" aria-hidden="true" />
              Open dynamic allocation builder
            </button>
          </div>

          <div className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Source balance {selectedPeriod ? `(${selectedPeriod})` : ''}
              </span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {currencyFormatter.format(sourceValue)}
              </span>
            </div>
          </div>

          {!allocation ? (
            <p className="rounded-md border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
              No dynamic ratios are configured yet. Launch the builder to choose basis datapoints and targets for this account.
            </p>
          ) : targetSummaries.length === 0 ? (
            <p className="rounded-md border border-dashed border-amber-300 bg-amber-50 px-4 py-6 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
              Add datapoint groups in the builder to establish allocation ratios for this account.
            </p>
          ) : (
            <div className="space-y-3 rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Basis datapoints
              </h4>
              <ul className="divide-y divide-slate-200 dark:divide-slate-700">
                {targetSummaries.map(summary => (
                  <li key={summary.id} className="py-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {summary.name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Metric: {summary.metricName}
                        </div>
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-300">
                        <div className="flex items-center justify-end gap-2">
                          <Layers className="h-4 w-4 text-slate-400" aria-hidden="true" />
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {basisFormatter.format(summary.basisTotal)}
                          </span>
                        </div>
                        <div className="text-xs text-right text-slate-500 dark:text-slate-400">
                          {pluralize(summary.memberValues.length, 'datapoint')} contributing
                        </div>
                      </div>
                    </div>
                    {summary.memberValues.length > 0 && (
                      <ul
                        className="mt-3 divide-y divide-slate-200 overflow-hidden rounded-md border border-slate-200 bg-slate-50 text-xs text-slate-600 dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300"
                      >
                        {summary.memberValues.map(member => (
                          <li
                            key={member.accountId}
                            className="flex items-center justify-between gap-3 px-3 py-2"
                          >
                            <span
                              className="flex-1 truncate"
                              title={member.accountName}
                            >
                              {member.accountName}
                            </span>
                            <span className="font-medium text-slate-700 tabular-nums dark:text-slate-200">
                              {basisFormatter.format(member.value)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {selectedPeriod ? (
            computedPreview ? (
              <div className="space-y-2 rounded-md bg-blue-50 p-4 text-sm text-blue-900 dark:bg-blue-500/10 dark:text-blue-100">
                <div className="text-sm font-semibold">
                  Allocation preview for {selectedPeriod}
                </div>
                {computedPreview.allocations.map(target => (
                  <div key={target.targetId} className="flex items-center justify-between gap-4">
                    <span className="text-blue-800 dark:text-blue-200">{target.targetName}</span>
                    <span className="font-semibold">
                      {currencyFormatter.format(target.value)} · {target.percentage.toFixed(2)}%
                    </span>
                  </div>
                ))}
                {computedPreview.adjustment && computedPreview.adjustment.targetName &&
                  Math.abs(computedPreview.adjustment.amount) > 0 && (
                    <p className="text-xs text-blue-700 dark:text-blue-200">
                      Includes a {currencyFormatter.format(computedPreview.adjustment.amount)} rounding adjustment applied to {computedPreview.adjustment.targetName}.
                    </p>
                  )}
              </div>
            ) : (
              <p className="rounded-md border border-dashed border-blue-300 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-100">
                Run dynamic allocation checks for {selectedPeriod} to generate preview amounts.
              </p>
            )
          ) : (
            <p className="rounded-md border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
              Select a reporting period to preview calculated allocations.
            </p>
          )}

          {allocationIssues.map(issue => (
            <div
              key={issue.id}
              className="flex items-start gap-2 rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-100"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <span>{issue.message}</span>
            </div>
          ))}
        </div>
      </td>
    </tr>
  );
};

export default DynamicAllocationRow;

