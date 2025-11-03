import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Plus, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { STANDARD_CHART_OF_ACCOUNTS } from '../../data/standardChartOfAccounts';
import { useRatioAllocationStore } from '../../store/ratioAllocationStore';
import type { DynamicDatapointGroup } from '../../types';
import {
  allocateDynamic,
  getBasisValue,
  getGroupMembersWithValues,
  getGroupTotal,
} from '../../utils/dynamicAllocation';

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

interface RatioAllocationBuilderProps {
  initialSourceAccountId?: string | null;
}

const RatioAllocationBuilder = ({ initialSourceAccountId }: RatioAllocationBuilderProps) => {
  const {
    allocations,
    groups,
    basisAccounts,
    sourceAccounts,
    selectedPeriod,
    validationErrors,
    createGroup,
    updateGroup,
    setGroupMembers,
    toggleAllocationGroupTarget,
    toggleTargetExclusion,
  } = useRatioAllocationStore();

  const [selectedAllocationId, setSelectedAllocationId] = useState<string | null>(null);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupTargetId, setNewGroupTargetId] = useState<string>('');
  const [newGroupMembers, setNewGroupMembers] = useState<string[]>([]);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupDraft, setGroupDraft] = useState<{
    label: string;
    targetId: string;
    memberIds: string[];
  } | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const allocationIdForInitialSource = useMemo(() => {
    if (!initialSourceAccountId) {
      return null;
    }
    const match = allocations.find(
      allocation => allocation.sourceAccount.id === initialSourceAccountId,
    );
    return match?.id ?? null;
  }, [allocations, initialSourceAccountId]);

  useEffect(() => {
    if (initialSourceAccountId) {
      if (allocationIdForInitialSource) {
        if (selectedAllocationId !== allocationIdForInitialSource) {
          setSelectedAllocationId(allocationIdForInitialSource);
        }
      } else if (selectedAllocationId) {
        setSelectedAllocationId(null);
      }
      return;
    }

    if (!selectedAllocationId && allocations.length > 0) {
      setSelectedAllocationId(allocations[0].id);
    }
    if (allocations.length === 0 && selectedAllocationId) {
      setSelectedAllocationId(null);
    }
  }, [
    allocationIdForInitialSource,
    allocations,
    initialSourceAccountId,
    selectedAllocationId,
  ]);

  const targetOptions = useMemo(() => {
    const excludedIds = new Set(basisAccounts.map(account => account.id));
    return STANDARD_CHART_OF_ACCOUNTS.filter(option => !excludedIds.has(option.id))
      .map(option => ({ value: option.id, label: option.label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [basisAccounts]);

  useEffect(() => {
    if (targetOptions.length === 0) {
      if (newGroupTargetId) {
        setNewGroupTargetId('');
      }
      return;
    }

    const hasCurrent = targetOptions.some(option => option.value === newGroupTargetId);
    if (!hasCurrent) {
      setNewGroupTargetId(targetOptions[0].value);
    }
  }, [newGroupTargetId, targetOptions]);

  useEffect(() => {
    if (basisAccounts.length === 0) {
      setIsCreatingGroup(false);
      setNewGroupMembers([]);
    }
  }, [basisAccounts.length]);

  const selectedAllocation = useMemo(() => {
    if (selectedAllocationId) {
      return allocations.find(allocation => allocation.id === selectedAllocationId) ?? null;
    }
    if (initialSourceAccountId) {
      const match = allocations.find(
        allocation => allocation.sourceAccount.id === initialSourceAccountId,
      );
      return match ?? null;
    }
    return allocations[0] ?? null;
  }, [allocations, initialSourceAccountId, selectedAllocationId]);

  const selectedGroupIds = useMemo(() => {
    if (!selectedAllocation) {
      return new Set<string>();
    }
    return new Set(
      selectedAllocation.targetDatapoints
        .filter(target => target.groupId)
        .map(target => target.groupId as string),
    );
  }, [selectedAllocation]);

  const excludedTargetIds = useMemo(() => {
    if (!selectedAllocation) {
      return new Set<string>();
    }
    return new Set(
      selectedAllocation.targetDatapoints
        .filter(target => target.isExclusion)
        .map(target => target.datapointId),
    );
  }, [selectedAllocation]);

  const excludedGroupIds = useMemo(() => {
    if (!selectedAllocation) {
      return new Set<string>();
    }
    return new Set(
      selectedAllocation.targetDatapoints
        .filter(target => target.isExclusion && target.groupId)
        .map(target => target.groupId as string),
    );
  }, [selectedAllocation]);

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

  const targetDetails = useMemo(() => {
    if (!selectedAllocation) {
      return [] as {
        targetId: string;
        name: string;
        basisValue: number;
        isExcluded: boolean;
        groupId: string | null;
      }[];
    }
    return selectedAllocation.targetDatapoints.map(target => {
      const isExcluded = excludedTargetIds.has(target.datapointId);
      if (target.groupId) {
        const group = groups.find(item => item.id === target.groupId);
        const basisValue = group ? getGroupTotal(group, basisAccounts, selectedPeriod) : 0;
        return {
          targetId: target.datapointId,
          name: target.name,
          basisValue,
          isExcluded,
          groupId: target.groupId,
        };
      }
      const basisAccount = basisAccounts.find(account => account.id === target.ratioMetric.id);
      const basisValue = basisAccount
        ? getBasisValue(basisAccount, selectedPeriod)
        : typeof target.ratioMetric.value === 'number'
            ? target.ratioMetric.value
            : 0;
      return {
        targetId: target.datapointId,
        name: target.name,
        basisValue,
        isExcluded,
        groupId: null,
      };
    });
  }, [basisAccounts, excludedTargetIds, groups, selectedAllocation, selectedPeriod]);

  const basisTotal = useMemo(
    () => targetDetails.reduce((sum, detail) => sum + detail.basisValue, 0),
    [targetDetails],
  );

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
    setNewGroupTargetId('');
    setNewGroupMembers([]);
  };

  const beginEditGroup = (group: DynamicDatapointGroup) => {
    setEditingGroupId(group.id);
    const allowedTargetIds = new Set(targetOptions.map(option => option.value));
    setGroupDraft({
      label: group.label,
      targetId:
        group.targetId && allowedTargetIds.has(group.targetId) ? group.targetId : '',
      memberIds: group.members.map(member => member.accountId),
    });
    setEditError(null);
  };

  const handleCancelEdit = () => {
    setEditingGroupId(null);
    setGroupDraft(null);
    setEditError(null);
  };

  const handleSaveGroup = () => {
    if (!editingGroupId || !groupDraft) {
      return;
    }
    const trimmedLabel = groupDraft.label.trim();
    if (!trimmedLabel) {
      setEditError('Enter a datapoint name.');
      return;
    }
    if (groupDraft.memberIds.length === 0) {
      setEditError('Select at least one source account.');
      return;
    }
    const requiresTarget = !excludedGroupIds.has(editingGroupId);
    if (requiresTarget && !groupDraft.targetId) {
      setEditError('Select a target SCoA account.');
      return;
    }
    updateGroup(editingGroupId, { label: trimmedLabel, targetId: groupDraft.targetId });
    setGroupMembers(editingGroupId, groupDraft.memberIds);
    setEditingGroupId(null);
    setGroupDraft(null);
    setEditError(null);
  };

  return (
    <div className="space-y-6">
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
                disabled={basisAccounts.length === 0}
                className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                {isCreatingGroup ? 'Cancel' : 'Create dynamic datapoint'}
              </button>
            </div>
          </div>

          {basisAccounts.length === 0 && (
            <p className="rounded-md border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
              Complete your direct and percentage mappings to add basis datapoints before creating dynamic groups.
            </p>
          )}

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
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:disabled:bg-slate-800"
                    disabled={targetOptions.length === 0}
                  >
                    {targetOptions.length === 0 ? (
                      <option value="">No eligible targets available</option>
                    ) : (
                      targetOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))
                    )}
                  </select>
                  {targetOptions.length === 0 && (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      All mapped SCoA accounts are already used as basis datapoints. Map additional accounts to unlock more targets.
                    </p>
                  )}
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
                  disabled={!newGroupName.trim() || newGroupMembers.length === 0 || !newGroupTargetId}
                >
                  Save datapoint
                </button>
              </div>
            </form>
          )}

          <div className="space-y-4">
            {groups.map(group => {
              const isSelected = selectedGroupIds.has(group.id);
              const isEditing = editingGroupId === group.id;
              const draft = isEditing && groupDraft ? groupDraft : null;
              const isExcludedForAllocation = excludedGroupIds.has(group.id);
              const memberIdsForTotal = draft
                ? draft.memberIds
                : group.members.map(member => member.accountId);
              const basisTotalValue = memberIdsForTotal.reduce(
                (sum, accountId) => sum + resolveBasisValue(accountId),
                0,
              );
              const basisTotal = formatCurrency(basisTotalValue);
              const headerLabel = draft ? draft.label : group.label;
              const headerTargetName = draft
                ? draft.targetId
                    ? targetOptions.find(option => option.value === draft.targetId)?.label ??
                      group.targetName ??
                      draft.targetId
                    : 'No target selected'
                : isExcludedForAllocation
                    ? 'Excluded from mapping'
                    : group.targetName || 'No target selected';
              const memberValues = getGroupMembersWithValues(group, basisAccounts, selectedPeriod);

              return (
                <Card key={group.id} className="border border-slate-200 shadow-sm dark:border-slate-700">
                  <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h4 className="text-base font-medium text-slate-900 dark:text-slate-100">
                        {headerLabel || 'Untitled datapoint'}
                      </h4>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Maps to {headerTargetName}</p>
                      {isExcludedForAllocation && !isEditing && (
                        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">
                          <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                          Excluded portion
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col items-start gap-2 text-sm md:items-end">
                      <div className="font-medium text-blue-700 dark:text-blue-400">Basis total: {basisTotal}</div>
                      <label className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                          checked={isSelected}
                          disabled={!selectedAllocation}
                          onChange={() => {
                            if (!selectedAllocation) {
                              return;
                            }
                            toggleAllocationGroupTarget(selectedAllocation.id, group.id);
                          }}
                          aria-label={`Include ${group.label} in the allocation`}
                        />
                        <span>{isSelected ? 'Included in allocation' : 'Include in allocation'}</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => beginEditGroup(group)}
                        disabled={isEditing}
                        className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus:ring-offset-slate-900"
                      >
                        Edit datapoint
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {isEditing && draft ? (
                      <>
                        <div className="grid gap-4 md:grid-cols-2">
                          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                            Datapoint name
                            <input
                              value={draft.label}
                              onChange={event =>
                                setGroupDraft(current =>
                                  current
                                    ? { ...current, label: event.target.value }
                                    : current,
                                )
                              }
                              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                              placeholder="e.g. Regional operations cost pool"
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                            Target SCoA account
                            <select
                              value={draft.targetId}
                              onChange={event =>
                                setGroupDraft(current =>
                                  current
                                    ? { ...current, targetId: event.target.value }
                                    : current,
                                )
                              }
                              className={`rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:text-slate-100 ${
                                isExcludedForAllocation
                                  ? 'cursor-not-allowed bg-slate-100 text-slate-500 opacity-70 dark:bg-slate-800 dark:text-slate-400'
                                  : 'bg-white dark:bg-slate-950'
                              }`}
                              disabled={isExcludedForAllocation}
                              aria-disabled={isExcludedForAllocation}
                            >
                              <option value="">No target selected</option>
                              {targetOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            {isExcludedForAllocation && (
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                Excluded datapoints do not require a target account.
                              </p>
                            )}
                            {!isExcludedForAllocation && targetOptions.length === 0 && (
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                All mapped SCoA accounts are already used as basis datapoints. Map additional accounts to unlock more targets.
                              </p>
                            )}
                          </label>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                            Select source accounts
                          </p>
                          {basisAccounts.length === 0 ? (
                            <p className="mt-2 rounded-md border border-dashed border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
                              Import basis accounts before editing this datapoint.
                            </p>
                          ) : (
                            <div className="mt-2 grid gap-2 md:grid-cols-2">
                              {basisAccounts.map(account => {
                                const checked = draft.memberIds.includes(account.id);
                                return (
                                  <label
                                    key={account.id}
                                    className="flex cursor-pointer items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900"
                                  >
                                    <span className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() =>
                                          setGroupDraft(current => {
                                            if (!current) {
                                              return current;
                                            }
                                            const exists = current.memberIds.includes(account.id);
                                            const memberIds = exists
                                              ? current.memberIds.filter(id => id !== account.id)
                                              : [...current.memberIds, account.id];
                                            return { ...current, memberIds };
                                          })
                                        }
                                      />
                                      {account.name}
                                    </span>
                                    <span className="font-medium">{formatCurrency(resolveBasisValue(account.id))}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        {editError && (
                          <p role="alert" className="text-sm text-rose-600 dark:text-rose-300">
                            {editError}
                          </p>
                        )}
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus:ring-offset-slate-900"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveGroup}
                            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400 dark:focus:ring-offset-slate-900"
                            disabled={
                              !draft.label.trim() ||
                              draft.memberIds.length === 0 ||
                              (!isExcludedForAllocation && !draft.targetId)
                            }
                          >
                            Save changes
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-3">
                        {memberValues.length === 0 ? (
                          <p className="rounded-md border border-dashed border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
                            No source accounts selected. Edit the datapoint to add basis accounts.
                          </p>
                        ) : (
                          <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white shadow-sm dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-900">
                            {memberValues.map(member => (
                              <li
                                key={member.accountId}
                                className="flex items-center justify-between px-3 py-2 text-sm text-slate-700 dark:text-slate-200"
                              >
                                <span>{member.accountName}</span>
                                <span className="font-semibold text-slate-900 dark:text-slate-100">
                                  {formatCurrency(member.value)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
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
            <div className="space-y-2">
              <div className="text-sm text-slate-600 dark:text-slate-300">
                {selectedPeriod
                  ? `Using balances for reporting period ${selectedPeriod}.`
                  : 'Select a reporting period in the mapping header to preview period-specific balances.'}
              </div>
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
                      Exclude
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
                      <td colSpan={5} className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">
                        Add target datapoints to preview the dynamic allocation.
                      </td>
                    </tr>
                  ) : (
                    targetDetails.map((detail, index) => {
                      const ratio = basisTotal > 0 ? detail.basisValue / basisTotal : 0;
                      const allocatedValue = previewComputation.allocations[index] ?? 0;
                      const targetDatapoint = selectedAllocation?.targetDatapoints[index];
                      const isExcluded = detail.isExcluded;
                      const datapointId = targetDatapoint?.datapointId ?? detail.targetId;
                      const groupId = targetDatapoint?.groupId ?? detail.groupId ?? null;
                      const TargetIcon = isExcluded ? XCircle : CheckCircle2;
                      const iconClass = isExcluded ? 'text-rose-500 dark:text-rose-300' : 'text-emerald-500';
                      const rowKey = groupId ? `${detail.targetId}-${groupId}` : detail.targetId;
                      return (
                        <tr key={rowKey}>
                          <td className="px-4 py-3 text-sm font-medium text-slate-800 dark:text-slate-100">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <TargetIcon className={`h-4 w-4 ${iconClass}`} aria-hidden="true" />
                                <span>{detail.name}</span>
                              </div>
                              {isExcluded && (
                                <span className="text-xs text-rose-600 dark:text-rose-300">Excluded from mapping</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-500"
                                checked={isExcluded}
                                disabled={!selectedAllocation || !datapointId}
                                onChange={() => {
                                  if (!selectedAllocation || !datapointId) {
                                    return;
                                  }
                                  toggleTargetExclusion(selectedAllocation.id, datapointId, groupId);
                                }}
                              />
                              Exclude
                            </label>
                          </td>
                          <td className={`px-4 py-3 text-sm ${
                            isExcluded
                              ? 'text-rose-600 dark:text-rose-300'
                              : 'text-slate-600 dark:text-slate-300'
                          }`}
                          >
                            {formatCurrency(detail.basisValue)}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{(ratio * 100).toFixed(2)}%</td>
                          <td className={`px-4 py-3 text-sm font-semibold ${
                            isExcluded
                              ? 'text-rose-700 dark:text-rose-300'
                              : 'text-blue-700 dark:text-blue-400'
                          }`}
                          >
                            {formatCurrency(allocatedValue)}
                          </td>
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
