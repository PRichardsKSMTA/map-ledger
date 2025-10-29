import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Plus, SlidersHorizontal } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { STANDARD_CHART_OF_ACCOUNTS } from '../../data/standardChartOfAccounts';
import { useRatioAllocationStore } from '../../store/ratioAllocationStore';
import type { DynamicDatapointGroup } from '../../types';
import { allocateDynamic, getBasisValue, getGroupTotal } from '../../utils/dynamicAllocation';

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

const RatioAllocationBuilder = () => {
  const {
    allocations,
    groups,
    basisAccounts,
    sourceAccounts,
    presets,
    availablePeriods,
    selectedPeriod,
    validationErrors,
    setSelectedPeriod,
    toggleGroupMember,
    createGroup,
    applyPreset,
  } = useRatioAllocationStore();

  const [selectedAllocationId, setSelectedAllocationId] = useState<string | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupTargetId, setNewGroupTargetId] = useState<string>('');
  const [newGroupMembers, setNewGroupMembers] = useState<string[]>([]);

  useEffect(() => {
    if (!selectedAllocationId && allocations.length > 0) {
      setSelectedAllocationId(allocations[0].id);
    }
  }, [allocations, selectedAllocationId]);

  const targetOptions = useMemo(() => {
    const optionMap = new Map<string, string>();
    const labelFor = (targetId: string) =>
      STANDARD_CHART_OF_ACCOUNTS.find(item => item.id === targetId)?.label ?? targetId;

    basisAccounts.forEach(account => {
      optionMap.set(account.mappedTargetId, labelFor(account.mappedTargetId));
    });
    groups.forEach(group => {
      optionMap.set(group.targetId, group.targetName);
    });

    STANDARD_CHART_OF_ACCOUNTS.forEach(option => {
      if (!optionMap.has(option.id)) {
        optionMap.set(option.id, option.label);
      }
    });

    return Array.from(optionMap.entries()).map(([value, label]) => ({ value, label }));
  }, [basisAccounts, groups]);

  useEffect(() => {
    if (!newGroupTargetId && targetOptions.length > 0) {
      setNewGroupTargetId(targetOptions[0].value);
    }
  }, [newGroupTargetId, targetOptions]);

  const selectedAllocation = useMemo(() => {
    if (!selectedAllocationId) {
      return allocations[0] ?? null;
    }
    return allocations.find(allocation => allocation.id === selectedAllocationId) ?? null;
  }, [allocations, selectedAllocationId]);

  const selectedSourceAccount = useMemo(() => {
    if (!selectedAllocation) {
      return null;
    }
    return sourceAccounts.find(account => account.id === selectedAllocation.sourceAccount.id) ?? null;
  }, [selectedAllocation, sourceAccounts]);

  const resolveBasisValue = useCallback(
    (accountId: string): number => {
      const basisAccount = basisAccounts.find(account => account.id === accountId);
      return basisAccount ? getBasisValue(basisAccount, selectedPeriod) : 0;
    },
    [basisAccounts, selectedPeriod],
  );

  const calculateGroupTotal = useCallback(
    (group: DynamicDatapointGroup): number => getGroupTotal(group, basisAccounts, selectedPeriod),
    [basisAccounts, selectedPeriod],
  );

  const targetDetails = useMemo(() => {
    if (!selectedAllocation) {
      return [] as { targetId: string; name: string; basisValue: number }[];
    }
    return selectedAllocation.targetDatapoints.map(target => {
      if (target.groupId) {
        const group = groups.find(item => item.id === target.groupId);
        const basisValue = group ? getGroupTotal(group, basisAccounts, selectedPeriod) : 0;
        return { targetId: target.datapointId, name: target.name, basisValue };
      }
      const basisAccount = basisAccounts.find(account => account.id === target.ratioMetric.id);
      const basisValue = basisAccount
        ? getBasisValue(basisAccount, selectedPeriod)
        : typeof target.ratioMetric.value === 'number'
            ? target.ratioMetric.value
            : 0;
      return { targetId: target.datapointId, name: target.name, basisValue };
    });
  }, [basisAccounts, groups, selectedAllocation, selectedPeriod]);

  const basisTotal = useMemo(
    () => targetDetails.reduce((sum, detail) => sum + detail.basisValue, 0),
    [targetDetails],
  );

  const previewComputation = useMemo(() => {
    if (targetDetails.length === 0 || basisTotal <= 0) {
      return { allocations: targetDetails.map(() => 0), adjustmentIndex: null, adjustmentAmount: 0 };
    }
    try {
      return allocateDynamic(
        sourceBalance,
        targetDetails.map(detail => detail.basisValue),
      );
    } catch {
      return { allocations: targetDetails.map(() => 0), adjustmentIndex: null, adjustmentAmount: 0 };
    }
  }, [basisTotal, sourceBalance, targetDetails]);

  const allocationIssues = useMemo(() => {
    if (!selectedAllocation) {
      return [];
    }
    return validationErrors.filter(
      issue =>
        issue.allocationId === selectedAllocation.id &&
        (!selectedPeriod || issue.periodId === selectedPeriod),
    );
  }, [selectedAllocation, selectedPeriod, validationErrors]);

  const groupTotals = useMemo(
    () => new Map(groups.map(group => [group.id, calculateGroupTotal(group)])),
    [calculateGroupTotal, groups],
  );

  const sourceBalance = useMemo(() => {
    if (!selectedSourceAccount) {
      return 0;
    }
    if (selectedPeriod && selectedSourceAccount.valuesByPeriod && selectedPeriod in selectedSourceAccount.valuesByPeriod) {
      const periodValue = selectedSourceAccount.valuesByPeriod[selectedPeriod];
      if (typeof periodValue === 'number') {
        return periodValue;
      }
    }
    return selectedSourceAccount.value ?? 0;
  }, [selectedSourceAccount, selectedPeriod]);

  const handlePresetApply = () => {
    if (!selectedPresetId) {
      return;
    }
    applyPreset(selectedPresetId);
  };

  const handleCreateGroup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newGroupName.trim() || !newGroupTargetId || newGroupMembers.length === 0) {
      return;
    }
    createGroup({
      label: newGroupName.trim(),
      targetId: newGroupTargetId,
      memberAccountIds: newGroupMembers,
    });
    setIsCreatingGroup(false);
    setNewGroupName('');
    setNewGroupMembers([]);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h3 className="text-lg font-medium">Dynamic presets</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Choose a preconfigured allocation to seed ratios with the correct underlying datapoints.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="dynamic-preset" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Mapping preset
              </label>
              <select
                id="dynamic-preset"
                value={selectedPresetId}
                onChange={event => setSelectedPresetId(event.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="">Select a preset…</option>
                {presets.map(preset => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
              {selectedPresetId && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {presets.find(preset => preset.id === selectedPresetId)?.description}
                </p>
              )}
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={handlePresetApply}
                disabled={!selectedPresetId}
                className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                <SlidersHorizontal className="mr-2 h-4 w-4" aria-hidden="true" />
                Apply preset
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-medium">Dynamic datapoints</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Group related basis accounts into the standard chart of account targets used for allocation ratios.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <button
                type="button"
                onClick={() => setIsCreatingGroup(previous => !previous)}
                className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                {isCreatingGroup ? 'Cancel' : 'Create dynamic datapoint'}
              </button>
            </div>
          </div>

          {isCreatingGroup && (
            <form onSubmit={handleCreateGroup} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                  Datapoint name
                  <input
                    value={newGroupName}
                    onChange={event => setNewGroupName(event.target.value)}
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                    placeholder="e.g. Regional operations cost pool"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                  Target SCoA account
                  <select
                    value={newGroupTargetId}
                    onChange={event => setNewGroupTargetId(event.target.value)}
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                  >
                    {targetOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-4">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Select basis accounts</p>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {basisAccounts.map(account => {
                    const checked = newGroupMembers.includes(account.id);
                    return (
                      <label
                        key={account.id}
                        className="flex cursor-pointer items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900"
                      >
                        <span>
                          <input
                            type="checkbox"
                            className="mr-2"
                            checked={checked}
                            onChange={() => {
                              setNewGroupMembers(previous =>
                                checked
                                  ? previous.filter(item => item !== account.id)
                                  : [...previous, account.id],
                              );
                            }}
                          />
                          {account.name}
                        </span>
                        <span className="font-medium">{formatCurrency(resolveBasisValue(account.id))}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="submit"
                  className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                  disabled={!newGroupName.trim() || newGroupMembers.length === 0}
                >
                  Save datapoint
                </button>
              </div>
            </form>
          )}

          <div className="space-y-4">
            {groups.map(group => (
              <Card key={group.id} className="border border-slate-200 shadow-sm dark:border-slate-700">
                <CardHeader className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h4 className="text-base font-medium text-slate-900 dark:text-slate-100">{group.label}</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Maps to {group.targetName}</p>
                  </div>
                  <div className="text-sm font-medium text-blue-700 dark:text-blue-400">
                    Basis total: {formatCurrency(groupTotals.get(group.id) ?? 0)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {basisAccounts.map(account => {
                    const checked = group.members.some(member => member.accountId === account.id);
                    return (
                      <label
                        key={account.id}
                        className="flex cursor-pointer items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900"
                      >
                        <span className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleGroupMember(group.id, account.id)}
                          />
                          {account.name}
                        </span>
                        <span className="font-medium">{formatCurrency(resolveBasisValue(account.id))}</span>
                      </label>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedAllocation && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-medium">Allocation preview</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Review the calculated distribution for {selectedAllocation.sourceAccount.description}.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                Period
                <select
                  value={selectedPeriod ?? ''}
                  onChange={event => setSelectedPeriod(event.target.value)}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="">Select period…</option>
                  {availablePeriods.map(period => (
                    <option key={period} value={period}>
                      {period}
                    </option>
                  ))}
                </select>
              </label>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="font-medium text-slate-700 dark:text-slate-200">Source balance</div>
                <div className="mt-1 text-lg font-semibold text-blue-700 dark:text-blue-400">
                  {formatCurrency(sourceBalance)}
                </div>
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Allocation ratios are derived from {basisTotal.toLocaleString()} total basis value mapped into the selected dynamic datapoints.
                </div>
              </div>
            </div>

            {allocationIssues.length > 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                  <div>
                    <p className="font-medium">Resolve basis issues before applying this allocation.</p>
                    <ul className="mt-1 list-disc space-y-1 pl-4 text-xs">
                      {allocationIssues.map(issue => (
                        <li key={issue.id}>{issue.message}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <div className="overflow-hidden rounded-lg border border-slate-200 shadow-sm dark:border-slate-700">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-slate-50 dark:bg-slate-900">
                  <tr>
                    <th scope="col" className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Target account
                    </th>
                    <th scope="col" className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Basis total
                    </th>
                    <th scope="col" className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Ratio
                    </th>
                    <th scope="col" className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Allocated amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-slate-950">
                  {targetDetails.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">
                        Add target datapoints to preview the dynamic allocation.
                      </td>
                    </tr>
                  ) : (
                    targetDetails.map((detail, index) => {
                      const ratio = basisTotal > 0 ? detail.basisValue / basisTotal : 0;
                      const allocatedValue = previewComputation.allocations[index] ?? 0;
                      return (
                        <tr key={detail.targetId}>
                          <td className="px-4 py-3 text-sm font-medium text-slate-800 dark:text-slate-100">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                              <span>{detail.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{formatCurrency(detail.basisValue)}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{(ratio * 100).toFixed(2)}%</td>
                          <td className="px-4 py-3 text-sm font-semibold text-blue-700 dark:text-blue-400">{formatCurrency(allocatedValue)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {basisTotal <= 0 && targetDetails.length > 0 && (
              <p className="text-sm text-amber-600 dark:text-amber-300">
                Provide nonzero basis datapoints to generate allocation amounts.
              </p>
            )}

            {previewComputation.adjustmentIndex !== null && Math.abs(previewComputation.adjustmentAmount) > 0 && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Rounded totals include a {formatCurrency(previewComputation.adjustmentAmount)} adjustment applied to the
                largest allocation to balance back to the source amount.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RatioAllocationBuilder;
