import { create } from 'zustand';
import type {
  GLAccountMappingRow,
  MappingPolarity,
  MappingSplitDefinition,
  MappingStatus,
  MappingType,
} from '../types';
import { getStandardScoaOption } from '../data/standardChartOfAccounts';

const FUEL_EXPENSE_TARGET = getStandardScoaOption('FUEL EXPENSE - COMPANY FLEET');
const TRACTOR_MAINTENANCE_TARGET = getStandardScoaOption('MAINTENANCE EXPENSE - TRACTOR - COMPANY FLEET');
const DRIVER_BENEFITS_TARGET = getStandardScoaOption(
  'DRIVER BENEFITS, PAYROLL TAXES AND BONUS COMPENSATION - COMPANY FLEET',
);
const NON_DRIVER_BENEFITS_TARGET = getStandardScoaOption('NON DRIVER WAGES & BENEFITS - TOTAL ASSET OPERATIONS');

const baseMappings: GLAccountMappingRow[] = [
  {
    id: 'acct-3',
    companyId: 'comp-global',
    companyName: 'Global Logistics',
    entityId: 'entity-main',
    entityName: 'Global Main',
    accountId: '6100',
    accountName: 'Fuel Expense',
    activity: 65000,
    status: 'New',
    mappingType: 'dynamic',
    netChange: 65000,
    operation: 'Fleet',
    suggestedCOAId: '6100',
    suggestedCOADescription: 'Fuel Expense',
    aiConfidence: 70,
    polarity: 'Debit',
    notes: 'Needs reviewer confirmation of dynamic allocation.',
    splitDefinitions: [
      {
        id: 'split-3',
        targetId: FUEL_EXPENSE_TARGET.id,
        targetName: FUEL_EXPENSE_TARGET.label,
        allocationType: 'amount',
        allocationValue: 45000,
      },
      {
        id: 'split-4',
        targetId: TRACTOR_MAINTENANCE_TARGET.id,
        targetName: TRACTOR_MAINTENANCE_TARGET.label,
        allocationType: 'amount',
        allocationValue: 20000,
      },
    ],
    entities: [{ id: 'entity-main', entity: 'Global Main', balance: 65000 }],
  },
  {
    id: 'acct-2',
    companyId: 'comp-acme',
    companyName: 'Acme Freight',
    entityId: 'entity-ops',
    entityName: 'Acme Freight Operations',
    accountId: '5200',
    accountName: 'Payroll Taxes',
    activity: 120000,
    status: 'Unmapped',
    mappingType: 'percentage',
    netChange: 120000,
    operation: 'Shared Services',
    suggestedCOAId: '5200',
    suggestedCOADescription: 'Payroll Taxes',
    aiConfidence: 82,
    polarity: 'Debit',
    presetId: 'preset-2',
    notes: 'Awaiting updated headcount split.',
    splitDefinitions: [
      {
        id: 'split-1',
        targetId: DRIVER_BENEFITS_TARGET.id,
        targetName: DRIVER_BENEFITS_TARGET.label,
        allocationType: 'percentage',
        allocationValue: 60,
        notes: 'HQ employees',
      },
      {
        id: 'split-2',
        targetId: NON_DRIVER_BENEFITS_TARGET.id,
        targetName: NON_DRIVER_BENEFITS_TARGET.label,
        allocationType: 'percentage',
        allocationValue: 40,
        notes: 'Field staff',
      },
    ],
    entities: [
      { id: 'entity-tms', entity: 'Acme Freight TMS', balance: 80000 },
      { id: 'entity-ops', entity: 'Acme Freight Operations', balance: 40000 },
    ],
  },
  {
    id: 'acct-1',
    companyId: 'comp-acme',
    companyName: 'Acme Freight',
    entityId: 'entity-tms',
    entityName: 'Acme Freight TMS',
    accountId: '4000',
    accountName: 'Linehaul Revenue',
    activity: 500000,
    status: 'Mapped',
    mappingType: 'direct',
    netChange: 500000,
    operation: 'Linehaul',
    suggestedCOAId: '4100',
    suggestedCOADescription: 'Revenue',
    aiConfidence: 96,
    manualCOAId: '4100',
    polarity: 'Credit',
    presetId: 'preset-1',
    notes: 'Approved during March close.',
    splitDefinitions: [],
    entities: [
      { id: 'entity-tms', entity: 'Acme Freight TMS', balance: 400000 },
      { id: 'entity-mx', entity: 'Acme Freight Mexico', balance: 100000 },
    ],
  },
  {
    id: 'acct-4',
    companyId: 'comp-heritage',
    companyName: 'Heritage Transport',
    entityId: 'entity-legacy',
    entityName: 'Legacy Ops',
    accountId: '8999',
    accountName: 'Legacy Clearing',
    activity: 15000,
    status: 'Excluded',
    mappingType: 'exclude',
    netChange: 15000,
    operation: 'Legacy',
    aiConfidence: 48,
    polarity: 'Debit',
    notes: 'Excluded from mapping per client request.',
    splitDefinitions: [],
    entities: [{ id: 'entity-legacy', entity: 'Legacy Ops', balance: 15000 }],
  },
];

const cloneMappingRow = (row: GLAccountMappingRow): GLAccountMappingRow => ({
  ...row,
  entities: row.entities.map(entity => ({ ...entity })),
  splitDefinitions: row.splitDefinitions.map(split => ({ ...split })),
});

export const createInitialMappingAccounts = (): GLAccountMappingRow[] =>
  baseMappings.map(cloneMappingRow);

const calculateGrossTotal = (accounts: GLAccountMappingRow[]): number =>
  accounts.reduce((sum, account) => sum + account.netChange, 0);

const calculateExcludedTotal = (accounts: GLAccountMappingRow[]): number =>
  accounts
    .filter(account => account.mappingType === 'exclude' || account.status === 'Excluded')
    .reduce((sum, account) => sum + account.netChange, 0);

type SummarySelector = {
  totalAccounts: number;
  mappedAccounts: number;
  grossTotal: number;
  excludedTotal: number;
  netTotal: number;
};

interface MappingState {
  accounts: GLAccountMappingRow[];
  searchTerm: string;
  activeStatuses: MappingStatus[];
  setSearchTerm: (term: string) => void;
  toggleStatusFilter: (status: MappingStatus) => void;
  clearStatusFilters: () => void;
  updateTarget: (id: string, coaId: string) => void;
  updatePreset: (id: string, presetId: string | null) => void;
  updateStatus: (id: string, status: MappingStatus) => void;
  updateMappingType: (id: string, mappingType: MappingType) => void;
  updatePolarity: (id: string, polarity: MappingPolarity) => void;
  updateNotes: (id: string, notes: string) => void;
  addSplitDefinition: (id: string) => void;
  updateSplitDefinition: (
    accountId: string,
    splitId: string,
    updates: Partial<MappingSplitDefinition>
  ) => void;
  removeSplitDefinition: (accountId: string, splitId: string) => void;
  applyBatchMapping: (
    ids: string[],
    updates: {
      target?: string | null;
      mappingType?: MappingType;
      presetId?: string | null;
      polarity?: MappingPolarity;
      status?: MappingStatus;
    }
  ) => void;
  applyPresetToAccounts: (ids: string[], presetId: string | null) => void;
  bulkAccept: (ids: string[]) => void;
  finalizeMappings: (ids: string[]) => boolean;
}

const mappingStatuses: MappingStatus[] = ['New', 'Unmapped', 'Mapped', 'Excluded'];

export const useMappingStore = create<MappingState>((set, get) => ({
  accounts: createInitialMappingAccounts(),
  searchTerm: '',
  activeStatuses: [],
  setSearchTerm: term => set({ searchTerm: term }),
  toggleStatusFilter: status =>
    set(state => {
      const exists = state.activeStatuses.includes(status);
      const next = exists
        ? state.activeStatuses.filter(item => item !== status)
        : [...state.activeStatuses, status];
      return { activeStatuses: next };
    }),
  clearStatusFilters: () => set({ activeStatuses: [] }),
  updateTarget: (id, coaId) =>
    set(state => ({
      accounts: state.accounts.map(account =>
        account.id === id
          ? { ...account, manualCOAId: coaId || undefined }
          : account
      ),
    })),
  updatePreset: (id, presetId) =>
    set(state => ({
      accounts: state.accounts.map(account =>
        account.id === id
          ? { ...account, presetId: presetId || undefined }
          : account
      ),
    })),
  updateStatus: (id, status) =>
    set(state => ({
      accounts: state.accounts.map(account => {
        if (account.id !== id) {
          return account;
        }

        const isExcluded = status === 'Excluded';
        const nextMappingType = isExcluded
          ? 'exclude'
          : account.mappingType === 'exclude'
            ? 'direct'
            : account.mappingType;

        return {
          ...account,
          status,
          mappingType: nextMappingType,
          manualCOAId: isExcluded ? undefined : account.manualCOAId,
          presetId: isExcluded ? undefined : account.presetId,
          splitDefinitions: isExcluded ? [] : account.splitDefinitions,
        };
      }),
    })),
  updateMappingType: (id, mappingType) =>
    set(state => ({
      accounts: state.accounts.map(account =>
        account.id === id
          ? {
              ...account,
              mappingType,
              status:
                mappingType === 'exclude'
                  ? 'Excluded'
                  : account.status === 'Excluded'
                    ? 'Unmapped'
                    : account.status,
              manualCOAId: mappingType === 'exclude' ? undefined : account.manualCOAId,
              splitDefinitions:
                mappingType === 'percentage' || mappingType === 'dynamic'
                  ? account.splitDefinitions
                  : [],
            }
          : account
      ),
    })),
  updatePolarity: (id, polarity) =>
    set(state => ({
      accounts: state.accounts.map(account =>
        account.id === id ? { ...account, polarity } : account
      ),
    })),
  updateNotes: (id, notes) =>
    set(state => ({
      accounts: state.accounts.map(account =>
        account.id === id ? { ...account, notes: notes || undefined } : account
      ),
    })),
  addSplitDefinition: id =>
    set(state => ({
      accounts: state.accounts.map(account => {
        if (account.id !== id) {
          return account;
        }
        const nextSplit: MappingSplitDefinition = {
          id: createId(),
          targetId: '',
          targetName: '',
          allocationType: account.mappingType === 'dynamic' ? 'amount' : 'percentage',
          allocationValue: 0,
          notes: '',
        };
        return {
          ...account,
          splitDefinitions: [...account.splitDefinitions, nextSplit],
        };
      }),
    })),
  updateSplitDefinition: (accountId, splitId, updates) =>
    set(state => ({
      accounts: state.accounts.map(account => {
        if (account.id !== accountId) {
          return account;
        }
        return {
          ...account,
          splitDefinitions: account.splitDefinitions.map(split =>
            split.id === splitId
              ? {
                  ...split,
                  ...updates,
                }
              : split
          ),
        };
      }),
    })),
  removeSplitDefinition: (accountId, splitId) =>
    set(state => ({
      accounts: state.accounts.map(account => {
        if (account.id !== accountId) {
          return account;
        }
        return {
          ...account,
          splitDefinitions: account.splitDefinitions.filter(split => split.id !== splitId),
        };
      }),
    })),
  applyBatchMapping: (ids, updates) =>
    set(state => ({
      accounts: state.accounts.map(account => {
        if (!ids.includes(account.id)) {
          return account;
        }

        const next: GLAccountMappingRow = { ...account };

        if ('target' in updates) {
          next.manualCOAId = updates.target || undefined;
        }
        if (updates.mappingType) {
          next.mappingType = updates.mappingType;
          if (updates.mappingType === 'exclude') {
            next.splitDefinitions = [];
            next.status = 'Excluded';
            next.manualCOAId = undefined;
            next.presetId = undefined;
          } else if (next.status === 'Excluded') {
            next.status = 'Unmapped';
          }
        }
        if ('presetId' in updates) {
          next.presetId = updates.presetId || undefined;
          if (updates.presetId && !updates.mappingType) {
            if (next.mappingType === 'exclude') {
              next.mappingType = 'percentage';
            }
            if (next.status === 'Excluded') {
              next.status = 'Unmapped';
            }
          }
        }
        if (updates.polarity) {
          next.polarity = updates.polarity;
        }
        if (updates.status) {
          next.status = updates.status;
          if (updates.status === 'Excluded') {
            next.mappingType = 'exclude';
            next.manualCOAId = undefined;
            next.presetId = undefined;
            next.splitDefinitions = [];
          } else if (next.mappingType === 'exclude') {
            next.mappingType = 'direct';
          }
        } else if (updates.mappingType && updates.mappingType !== 'exclude' && next.status === 'Excluded') {
          next.status = 'Unmapped';
        }
        if (next.mappingType !== 'percentage' && next.mappingType !== 'dynamic') {
          next.splitDefinitions = [];
        }
        return next;
      }),
    })),
  applyPresetToAccounts: (ids, presetId) => {
    set(state => ({
      accounts: state.accounts.map(account => {
        if (!ids.includes(account.id)) {
          return account;
        }
        if (!presetId) {
          return { ...account, presetId: undefined };
        }
        const nextStatus: MappingStatus = account.status === 'Excluded' ? 'Unmapped' : account.status;
        return {
          ...account,
          mappingType: 'percentage',
          presetId,
          status: nextStatus,
        };
      }),
    }));
  },
  bulkAccept: ids =>
    set(state => {
      if (!ids.length) {
        return state;
      }
      return {
        accounts: state.accounts.map(account => {
          if (!ids.includes(account.id) || !account.suggestedCOAId) {
            return account;
          }
          if (account.mappingType === 'exclude' || account.status === 'Excluded') {
            return account;
          }
          return {
            ...account,
            manualCOAId: account.suggestedCOAId,
            status: 'Mapped',
            mappingType: account.mappingType === 'direct' ? account.mappingType : 'direct',
          };
        }),
      };
    }),
  finalizeMappings: ids => {
    const sourceIds = ids.length ? ids : get().accounts.map(account => account.id);
    const accounts = get().accounts.filter(account => sourceIds.includes(account.id));
    const issues = getSplitValidationIssues(accounts);
    if (issues.length > 0) {
      console.warn('Unable to finalize mappings due to split issues', issues);
      return false;
    }
    const payload = accounts
      .filter(account => account.mappingType !== 'exclude' && account.status !== 'Excluded')
      .map(account => ({
        glAccountRawId: account.id,
        coAAccountId: account.manualCOAId || account.suggestedCOAId,
        status: account.status,
        mappingType: account.mappingType,
        polarity: account.polarity,
      }));
    console.log('Finalize mappings', payload);
    return true;
  },
}));

const createId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
};

const getSplitPercentage = (account: GLAccountMappingRow, split: MappingSplitDefinition): number => {
  if (split.allocationType === 'percentage') {
    return split.allocationValue;
  }
  if (split.allocationType === 'amount' && account.netChange !== 0) {
    return (split.allocationValue / account.netChange) * 100;
  }
  return 0;
};

const getSplitAmount = (account: GLAccountMappingRow, percentage: number): number =>
  (account.netChange * percentage) / 100;

const getSplitValidationIssues = (accounts: GLAccountMappingRow[]) => {
  const issues: { accountId: string; message: string }[] = [];
  accounts.forEach(account => {
    if (account.mappingType !== 'percentage' && account.mappingType !== 'dynamic') {
      return;
    }
    if (account.splitDefinitions.length === 0) {
      issues.push({ accountId: account.id, message: 'Missing split definitions' });
      return;
    }
    const totalPercentage = account.splitDefinitions.reduce(
      (sum, split) => sum + getSplitPercentage(account, split),
      0
    );
    if (Math.abs(totalPercentage - 100) > 0.01) {
      issues.push({ accountId: account.id, message: 'Split percentages must equal 100%' });
    }
    if (account.mappingType === 'dynamic') {
      const totalAmount = account.splitDefinitions.reduce((sum, split) => {
        const percentage = getSplitPercentage(account, split);
        return sum + getSplitAmount(account, percentage);
      }, 0);
      if (Math.abs(totalAmount - account.netChange) > Math.max(1, Math.abs(account.netChange) * 0.001)) {
        issues.push({ accountId: account.id, message: 'Dynamic allocations must reconcile to the account net change' });
      }
    }
  });
  return issues;
};

export const selectAccounts = (state: MappingState): GLAccountMappingRow[] => state.accounts;

export const selectTotalAccounts = (state: MappingState): number => state.accounts.length;

export const selectMappedAccounts = (state: MappingState): number =>
  state.accounts.filter(account => account.manualCOAId || account.suggestedCOAId).length;

export const selectGrossTotal = (state: MappingState): number =>
  calculateGrossTotal(state.accounts);

export const selectExcludedTotal = (state: MappingState): number =>
  calculateExcludedTotal(state.accounts);

export const selectNetTotal = (state: MappingState): number =>
  calculateGrossTotal(state.accounts) - calculateExcludedTotal(state.accounts);

export const selectStatusCounts = (state: MappingState): Record<MappingStatus, number> =>
  state.accounts.reduce<Record<MappingStatus, number>>((accumulator, account) => {
    accumulator[account.status] += 1;
    return accumulator;
  }, Object.fromEntries(mappingStatuses.map(status => [status, 0])) as Record<MappingStatus, number>);

export const selectSummaryMetrics = (state: MappingState): SummarySelector => {
  const grossTotal = calculateGrossTotal(state.accounts);
  const excludedTotal = calculateExcludedTotal(state.accounts);
  return {
    totalAccounts: state.accounts.length,
    mappedAccounts: state.accounts.filter(account => account.manualCOAId || account.suggestedCOAId).length,
    grossTotal,
    excludedTotal,
    netTotal: grossTotal - excludedTotal,
  };
};

export const selectActiveStatuses = (state: MappingState): MappingStatus[] => state.activeStatuses;

export const selectSearchTerm = (state: MappingState): string => state.searchTerm;

export const calculateSplitPercentage = (
  account: GLAccountMappingRow,
  split: MappingSplitDefinition
): number => getSplitPercentage(account, split);

export const calculateSplitAmount = (
  account: GLAccountMappingRow,
  percentage: number
): number => getSplitAmount(account, percentage);

export const selectSplitValidationIssues = (state: MappingState) =>
  getSplitValidationIssues(state.accounts);

export const selectAccountsRequiringSplits = (state: MappingState) =>
  state.accounts.filter(
    account =>
      (account.mappingType === 'percentage' || account.mappingType === 'dynamic') &&
      account.splitDefinitions.length === 0
  );
