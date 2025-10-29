import { create } from 'zustand';
import {
  AllocationResult,
  DynamicAllocationAuditRecord,
  DynamicAllocationValidationIssue,
  DynamicBasisAccount,
  DynamicDatapointGroup,
  DynamicMappingPreset,
  DynamicSourceAccount,
  RatioAllocation,
  RatioAllocationTargetDatapoint,
} from '../types';
import { STANDARD_CHART_OF_ACCOUNTS } from '../data/standardChartOfAccounts';
import {
  allocateDynamic,
  getBasisValue,
  GroupMemberValue,
  getGroupMembersWithValues,
  getGroupTotal,
  getSourceValue,
} from '../utils/dynamicAllocation';

const createId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
};

const getTargetNameById = (targetId: string): string => {
  const option = STANDARD_CHART_OF_ACCOUNTS.find(item => item.id === targetId);
  return option?.label ?? targetId;
};

const buildTargetDatapoint = (
  group: DynamicDatapointGroup,
  basisAccounts: DynamicBasisAccount[],
  periodId?: string | null,
): RatioAllocationTargetDatapoint => ({
  datapointId: group.targetId,
  name: group.targetName,
  groupId: group.id,
  ratioMetric: {
    id: group.id,
    name: `${group.label} total`,
    value: getGroupTotal(group, basisAccounts, periodId),
  },
});

const normalizeGroup = (
  group: DynamicDatapointGroup,
  basisAccounts: DynamicBasisAccount[],
): DynamicDatapointGroup => ({
  ...group,
  members: group.members.map(member => {
    const basisAccount = basisAccounts.find(account => account.id === member.accountId);
    return {
      accountId: member.accountId,
      accountName: basisAccount?.name ?? member.accountName ?? member.accountId,
    };
  }),
});

const synchronizeAllocationTargets = (
  allocation: RatioAllocation,
  groups: DynamicDatapointGroup[],
  basisAccounts: DynamicBasisAccount[],
  periodId?: string | null,
): RatioAllocation => ({
  ...allocation,
  targetDatapoints: allocation.targetDatapoints.map(target => {
    if (!target.groupId) {
      return target;
    }
    const group = groups.find(item => item.id === target.groupId);
    if (!group) {
      return target;
    }
    return buildTargetDatapoint(group, basisAccounts, periodId);
  }),
});

type ResolvedTargetDetail = {
  target: RatioAllocationTargetDatapoint;
  basisValue: number;
  members: GroupMemberValue[];
  error?: string;
};

type RatioAllocationHydrationPayload = {
  basisAccounts?: DynamicBasisAccount[];
  sourceAccounts?: DynamicSourceAccount[];
  groups?: DynamicDatapointGroup[];
  presets?: DynamicMappingPreset[];
  allocations?: RatioAllocation[];
  availablePeriods?: string[];
  selectedPeriod?: string | null;
};

type RatioAllocationState = {
  allocations: RatioAllocation[];
  basisAccounts: DynamicBasisAccount[];
  groups: DynamicDatapointGroup[];
  sourceAccounts: DynamicSourceAccount[];
  presets: DynamicMappingPreset[];
  availablePeriods: string[];
  isProcessing: boolean;
  selectedPeriod: string | null;
  results: AllocationResult[];
  validationErrors: DynamicAllocationValidationIssue[];
  auditLog: DynamicAllocationAuditRecord[];
  hydrate: (payload: RatioAllocationHydrationPayload) => void;
  getOrCreateAllocation: (sourceAccountId: string) => RatioAllocation;
  addAllocation: (allocation: Omit<RatioAllocation, 'id'>) => void;
  updateAllocation: (id: string, allocation: Partial<RatioAllocation>) => void;
  deleteAllocation: (id: string) => void;
  setAvailablePeriods: (periods: string[]) => void;
  setSelectedPeriod: (period: string) => void;
  calculateAllocations: (periodId: string) => Promise<void>;
  createGroup: (payload: {
    label: string;
    targetId: string;
    memberAccountIds: string[];
    notes?: string;
  }) => void;
  updateGroup: (groupId: string, updates: Partial<Omit<DynamicDatapointGroup, 'id' | 'members'>>) => void;
  toggleGroupMember: (groupId: string, accountId: string) => void;
  applyPreset: (presetId: string) => void;
};

export const useRatioAllocationStore = create<RatioAllocationState>((set, get) => ({
  allocations: [],
  basisAccounts: [],
  groups: [],
  sourceAccounts: [],
  presets: [],
  availablePeriods: [],
  isProcessing: false,
  selectedPeriod: null,
  results: [],
  validationErrors: [],
  auditLog: [],

  hydrate: payload => {
    set(state => {
      const basisAccounts = payload.basisAccounts ?? state.basisAccounts;
      const groups = (payload.groups ?? state.groups).map(group => normalizeGroup(group, basisAccounts));
      const allocationsInput = payload.allocations ?? state.allocations;
      const availablePeriods = payload.availablePeriods ?? state.availablePeriods;
      const selectedPeriod =
        payload.selectedPeriod ?? state.selectedPeriod ?? availablePeriods[0] ?? null;
      const allocations = allocationsInput.map(allocation =>
        synchronizeAllocationTargets(allocation, groups, basisAccounts, selectedPeriod),
      );

      return {
        allocations,
        basisAccounts,
        groups,
        sourceAccounts: payload.sourceAccounts ?? state.sourceAccounts,
        presets: payload.presets ?? state.presets,
        availablePeriods,
        selectedPeriod,
      };
    });
  },

  getOrCreateAllocation: sourceAccountId => {
    const existing = get().allocations.find(allocation => allocation.sourceAccount.id === sourceAccountId);
    if (existing) {
      return existing;
    }
    const sourceAccount = get().sourceAccounts.find(account => account.id === sourceAccountId);
    if (!sourceAccount) {
      throw new Error(`Unable to locate source account ${sourceAccountId}`);
    }
    const allocation: RatioAllocation = {
      id: createId(),
      name: `${sourceAccount.name} allocation`,
      sourceAccount: {
        id: sourceAccount.id,
        number: sourceAccount.number,
        description: sourceAccount.description,
      },
      targetDatapoints: [],
      effectiveDate: new Date().toISOString(),
      status: 'active',
    };
    set(state => ({ allocations: [...state.allocations, allocation] }));
    return allocation;
  },

  addAllocation: allocation => {
    set(state => ({
      allocations: [
        ...state.allocations,
        synchronizeAllocationTargets({ ...allocation, id: createId() }, state.groups, state.basisAccounts, state.selectedPeriod),
      ],
    }));
  },

  updateAllocation: (id, allocation) => {
    set(state => ({
      allocations: state.allocations.map(item => {
        if (item.id !== id) {
          return item;
        }
        const merged: RatioAllocation = {
          ...item,
          ...allocation,
        };
        if (allocation.targetDatapoints) {
          merged.targetDatapoints = allocation.targetDatapoints.map(target => {
            if (!target.groupId) {
              return target;
            }
            const group = state.groups.find(groupItem => groupItem.id === target.groupId);
            return group ? buildTargetDatapoint(group, state.basisAccounts, state.selectedPeriod) : target;
          });
        }
        return synchronizeAllocationTargets(merged, state.groups, state.basisAccounts, state.selectedPeriod);
      }),
    }));
  },

  deleteAllocation: id => {
    set(state => ({
      allocations: state.allocations.filter(allocation => allocation.id !== id),
    }));
  },

  setAvailablePeriods: periods => {
    set(state => {
      const normalized = Array.from(new Set(periods)).sort();
      const nextSelected = state.selectedPeriod && normalized.includes(state.selectedPeriod)
        ? state.selectedPeriod
        : normalized[0] ?? null;
      return {
        availablePeriods: normalized,
        selectedPeriod: nextSelected,
      };
    });
  },

  setSelectedPeriod: period => {
    set(state => ({
      selectedPeriod: period,
      allocations: state.allocations.map(allocation =>
        synchronizeAllocationTargets(allocation, state.groups, state.basisAccounts, period),
      ),
    }));
    get()
      .calculateAllocations(period)
      .catch(error => {
        console.error('Failed to calculate allocations', error);
      });
  },

  calculateAllocations: async periodId => {
    set({ isProcessing: true });
    try {
      const {
        allocations,
        groups,
        basisAccounts,
        sourceAccounts,
        presets,
        results: existingResults,
        validationErrors: existingValidationErrors,
        auditLog: existingAuditLog,
      } = get();

      const filteredResults = existingResults.filter(result => result.periodId !== periodId);
      const filteredValidationErrors = existingValidationErrors.filter(issue => issue.periodId !== periodId);

      const newResults: AllocationResult[] = [];
      const newValidationErrors: DynamicAllocationValidationIssue[] = [];
      const newAuditRecords: DynamicAllocationAuditRecord[] = [];
      const runTimestamp = new Date().toISOString();

      allocations.forEach(allocation => {
        const sourceAccount = sourceAccounts.find(account => account.id === allocation.sourceAccount.id);
        if (!sourceAccount) {
          newValidationErrors.push({
            id: createId(),
            allocationId: allocation.id,
            periodId,
            sourceAccountId: allocation.sourceAccount.id,
            sourceAccountName: allocation.sourceAccount.description,
            message: `Source account ${allocation.sourceAccount.id} is unavailable for allocation.`,
          });
          return;
        }

        if (allocation.targetDatapoints.length < 2) {
          newValidationErrors.push({
            id: createId(),
            allocationId: allocation.id,
            periodId,
            sourceAccountId: sourceAccount.id,
            sourceAccountName: sourceAccount.description,
            message: 'Dynamic allocations require at least two targets.',
          });
          return;
        }

        const targetDetails: ResolvedTargetDetail[] = allocation.targetDatapoints.map(target => {
          if (target.groupId) {
            const group = groups.find(item => item.id === target.groupId);
            if (!group) {
              return {
                target,
                basisValue: 0,
                members: [],
                error: `Dynamic datapoint group ${target.name} is missing.`,
              };
            }
            const members = getGroupMembersWithValues(group, basisAccounts, periodId);
            return {
              target,
              basisValue: members.reduce((sum, member) => sum + member.value, 0),
              members,
            };
          }

          const basisAccount = basisAccounts.find(item => item.id === target.ratioMetric.id);
          if (basisAccount) {
            const value = getBasisValue(basisAccount, periodId);
            return {
              target,
              basisValue: value,
              members: [
                {
                  accountId: basisAccount.id,
                  accountName: basisAccount.name,
                  value,
                },
              ],
            };
          }

          const metricValue = typeof target.ratioMetric.value === 'number' ? target.ratioMetric.value : 0;
          if (!Number.isFinite(metricValue)) {
            return {
              target,
              basisValue: 0,
              members: [],
              error: `Basis datapoint ${target.ratioMetric.name} is missing a numeric value.`,
            };
          }

          return {
            target,
            basisValue: metricValue,
            members: [
              {
                accountId: target.ratioMetric.id,
                accountName: target.ratioMetric.name,
                value: metricValue,
              },
            ],
          };
        });

        const localIssues: { message: string; targets?: string[] }[] = [];

        targetDetails.forEach(detail => {
          if (detail.error) {
            localIssues.push({ message: detail.error });
          }
          if (detail.basisValue < 0) {
            localIssues.push({
              message: `Basis value for ${detail.target.name} must be non-negative.`,
              targets: [detail.target.datapointId],
            });
          }
        });

        const basisTotal = targetDetails.reduce((sum, detail) => sum + detail.basisValue, 0);
        if (basisTotal <= 0) {
          localIssues.push({ message: 'Basis total is zero; provide nonzero datapoints.' });
        }

        const circularTargets = targetDetails
          .filter(detail => detail.members.some(member => member.accountId === sourceAccount.id))
          .map(detail => detail.target.datapointId);
        if (circularTargets.length > 0) {
          localIssues.push({
            message: `Basis datapoints reference source account ${sourceAccount.number}. Remove the circular dependency.`,
            targets: circularTargets,
          });
        }

        if (localIssues.length > 0) {
          localIssues.forEach(issue => {
            newValidationErrors.push({
              id: createId(),
              allocationId: allocation.id,
              periodId,
              sourceAccountId: sourceAccount.id,
              sourceAccountName: sourceAccount.description,
              message: issue.message,
              targetIds: issue.targets,
            });
          });
          return;
        }

        if (targetDetails.length === 0) {
          newValidationErrors.push({
            id: createId(),
            allocationId: allocation.id,
            periodId,
            sourceAccountId: sourceAccount.id,
            sourceAccountName: sourceAccount.description,
            message: 'Add at least one target datapoint before running a dynamic allocation.',
          });
          return;
        }

        const sourceValue = getSourceValue(sourceAccount, periodId);
        const basisValues = targetDetails.map(detail => detail.basisValue);

        let computed;
        try {
          computed = allocateDynamic(sourceValue, basisValues);
        } catch (error) {
          newValidationErrors.push({
            id: createId(),
            allocationId: allocation.id,
            periodId,
            sourceAccountId: sourceAccount.id,
            sourceAccountName: sourceAccount.description,
            message:
              error instanceof Error ? error.message : 'Unable to allocate using provided basis.',
          });
          return;
        }

        const targetAllocations = targetDetails.map((detail, index) => {
          const ratio = basisTotal > 0 ? detail.basisValue / basisTotal : 0;
          return {
            datapointId: detail.target.datapointId,
            targetId: detail.target.datapointId,
            targetName: detail.target.name,
            basisValue: detail.basisValue,
            value: computed.allocations[index] ?? 0,
            percentage: ratio * 100,
            ratio,
          };
        });

        const adjustment =
          computed.adjustmentIndex !== null
            ? {
                targetId: allocation.targetDatapoints[computed.adjustmentIndex].datapointId,
                amount: computed.adjustmentAmount,
              }
            : undefined;

        newResults.push({
          allocationId: allocation.id,
          allocationName: allocation.name,
          periodId,
          sourceAccountId: sourceAccount.id,
          sourceAccountName: sourceAccount.description,
          sourceValue,
          basisTotal,
          runAt: runTimestamp,
          adjustment,
          allocations: targetAllocations,
        });

        const preset = presets.find(
          presetItem =>
            presetItem.sourceAccountId === allocation.sourceAccount.id &&
            presetItem.targetGroupIds.every(groupId =>
              allocation.targetDatapoints.some(target => target.groupId === groupId),
            ),
        );

        newAuditRecords.push({
          id: createId(),
          allocationId: allocation.id,
          allocationName: allocation.name,
          periodId,
          runAt: runTimestamp,
          sourceAccount: {
            id: sourceAccount.id,
            number: sourceAccount.number,
            description: sourceAccount.description,
          },
          sourceAmount: sourceValue,
          basisTotal,
          adjustment,
          presetId: preset?.id ?? null,
          userId: null,
          targets: targetAllocations.map((targetAllocation, index) => ({
            targetId: targetAllocation.targetId,
            targetName: targetAllocation.targetName,
            basisValue: targetAllocation.basisValue,
            ratio: targetAllocation.ratio,
            allocation: targetAllocation.value,
            basisMembers: targetDetails[index].members,
          })),
        });
      });

      set({
        results: [...filteredResults, ...newResults],
        validationErrors: [...filteredValidationErrors, ...newValidationErrors],
        auditLog: [...existingAuditLog, ...newAuditRecords],
        isProcessing: false,
      });
    } catch (error) {
      set({ isProcessing: false });
      throw error;
    }
  },

  createGroup: ({ label, targetId, memberAccountIds, notes }) => {
    set(state => {
      const targetName = getTargetNameById(targetId);
      const newGroup: DynamicDatapointGroup = {
        id: createId(),
        label,
        targetId,
        targetName,
        notes,
        members: memberAccountIds.map(accountId => {
          const account = state.basisAccounts.find(item => item.id === accountId);
          if (!account) {
            throw new Error(`Unknown basis account ${accountId}`);
          }
          return {
            accountId,
            accountName: account.name,
          };
        }),
      };

      const groups = [...state.groups, newGroup];
      const allocations = state.allocations.map(allocation =>
        synchronizeAllocationTargets(allocation, groups, state.basisAccounts, state.selectedPeriod),
      );
      return { groups, allocations };
    });
  },

  updateGroup: (groupId, updates) => {
    set(state => {
      const resolvedUpdates = { ...updates } as Partial<Omit<DynamicDatapointGroup, 'id' | 'members'>>;
      if (updates.targetId) {
        resolvedUpdates.targetName = getTargetNameById(updates.targetId);
      }
      const groups = state.groups.map(group => {
        if (group.id !== groupId) {
          return group;
        }
        return {
          ...group,
          ...resolvedUpdates,
        };
      });
      const allocations = state.allocations.map(allocation =>
        synchronizeAllocationTargets(allocation, groups, state.basisAccounts, state.selectedPeriod),
      );
      return { groups, allocations };
    });
  },

  toggleGroupMember: (groupId, accountId) => {
    set(state => {
      const groups = state.groups.map(group => {
        if (group.id !== groupId) {
          return group;
        }
        const exists = group.members.some(member => member.accountId === accountId);
        if (exists) {
          return {
            ...group,
            members: group.members.filter(member => member.accountId !== accountId),
          };
        }
        const account = state.basisAccounts.find(item => item.id === accountId);
        if (!account) {
          return group;
        }
        return {
          ...group,
          members: [
            ...group.members,
            {
              accountId,
              accountName: account.name,
            },
          ],
        };
      });

      const allocations = state.allocations.map(allocation =>
        synchronizeAllocationTargets(allocation, groups, state.basisAccounts, state.selectedPeriod),
      );
      return { groups, allocations };
    });
  },

  applyPreset: presetId => {
    set(state => {
      const preset = state.presets.find(item => item.id === presetId);
      if (!preset) {
        return state;
      }
      const sourceAccount = state.sourceAccounts.find(account => account.id === preset.sourceAccountId);
      if (!sourceAccount) {
        return state;
      }

      const groups = preset.targetGroupIds
        .map(groupId => state.groups.find(group => group.id === groupId))
        .filter((group): group is DynamicDatapointGroup => Boolean(group));

      if (!groups.length) {
        return state;
      }

      const targetDatapoints = groups.map(group => buildTargetDatapoint(group, state.basisAccounts, state.selectedPeriod));
      const existing = state.allocations.find(allocation => allocation.sourceAccount.id === sourceAccount.id);

      const nextAllocation: RatioAllocation = existing
        ? {
            ...existing,
            name: preset.name,
            targetDatapoints,
            status: 'active',
          }
        : {
            id: createId(),
            name: preset.name,
            sourceAccount: {
              id: sourceAccount.id,
              number: sourceAccount.number,
              description: sourceAccount.description,
            },
            targetDatapoints,
            effectiveDate: new Date().toISOString(),
            status: 'active',
          };

      const allocations = existing
        ? state.allocations.map(allocation =>
            allocation.id === existing.id
              ? synchronizeAllocationTargets(nextAllocation, state.groups, state.basisAccounts, state.selectedPeriod)
              : allocation,
          )
        : [...state.allocations, synchronizeAllocationTargets(nextAllocation, state.groups, state.basisAccounts, state.selectedPeriod)];

      return { allocations };
    });
  },
}));
