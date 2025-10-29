import { create } from 'zustand';
import {
  AllocationResult,
  DynamicBasisAccount,
  DynamicDatapointGroup,
  DynamicMappingPreset,
  DynamicSourceAccount,
  RatioAllocation,
  RatioAllocationTargetDatapoint,
} from '../types';
import { STANDARD_CHART_OF_ACCOUNTS } from '../data/standardChartOfAccounts';

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

const getBasisValue = (account: DynamicBasisAccount, periodId?: string | null): number => {
  if (periodId && account.valuesByPeriod && periodId in account.valuesByPeriod) {
    const value = account.valuesByPeriod[periodId];
    if (typeof value === 'number') {
      return value;
    }
  }
  return account.value ?? 0;
};

const getSourceValue = (account: DynamicSourceAccount, periodId?: string | null): number => {
  if (periodId && account.valuesByPeriod && periodId in account.valuesByPeriod) {
    const value = account.valuesByPeriod[periodId];
    if (typeof value === 'number') {
      return value;
    }
  }
  return account.value ?? 0;
};

const getGroupTotal = (
  group: DynamicDatapointGroup,
  basisAccounts: DynamicBasisAccount[],
  periodId?: string | null,
): number =>
  group.members.reduce((sum, member) => {
    const basisAccount = basisAccounts.find(account => account.id === member.accountId);
    if (!basisAccount) {
      return sum;
    }
    return sum + getBasisValue(basisAccount, periodId);
  }, 0);

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
      const { allocations, groups, basisAccounts, sourceAccounts } = get();
      const results = allocations.map(allocation => {
        const sourceAccount = sourceAccounts.find(account => account.id === allocation.sourceAccount.id);
        const sourceValue = sourceAccount ? getSourceValue(sourceAccount, periodId) : 0;
        const totalBasis = allocation.targetDatapoints.reduce((sum, target) => {
          if (target.groupId) {
            const group = groups.find(item => item.id === target.groupId);
            return sum + (group ? getGroupTotal(group, basisAccounts, periodId) : 0);
          }
          return sum + target.ratioMetric.value;
        }, 0);

        const allocationsForTarget = allocation.targetDatapoints.map(target => {
          const basisGroup = target.groupId ? groups.find(item => item.id === target.groupId) : undefined;
          const basisValue = basisGroup ? getGroupTotal(basisGroup, basisAccounts, periodId) : target.ratioMetric.value;
          const percentage = totalBasis > 0 ? basisValue / totalBasis : 0;
          return {
            datapointId: target.datapointId,
            value: sourceValue * percentage,
            percentage: percentage * 100,
          };
        });

        return {
          periodId,
          sourceValue,
          allocations: allocationsForTarget,
        };
      });
      set({ results, isProcessing: false });
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
