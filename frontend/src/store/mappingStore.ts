import { create } from 'zustand';
import type {
  GLAccountMappingRow,
  MappingPolarity,
  MappingStatus,
  MappingType,
} from '../types';

const baseMappings: GLAccountMappingRow[] = [
  {
    id: 'acct-1',
    companyId: 'comp-acme',
    companyName: 'Acme Freight',
    entityId: 'entity-tms',
    entityName: 'Acme Freight TMS',
    accountId: '4000',
    accountName: 'Linehaul Revenue',
    activity: 'Revenue Recognition',
    status: 'approved',
    mappingType: 'direct',
    balance: 500000,
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
    id: 'acct-2',
    companyId: 'comp-acme',
    companyName: 'Acme Freight',
    entityId: 'entity-ops',
    entityName: 'Acme Freight Operations',
    accountId: '5200',
    accountName: 'Payroll Taxes',
    activity: 'Payroll Processing',
    status: 'in-review',
    mappingType: 'percentage',
    balance: 120000,
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
        targetId: 'dp-personnel',
        targetName: 'Personnel Expense',
        allocationType: 'percentage',
        allocationValue: 60,
        notes: 'HQ employees',
      },
      {
        id: 'split-2',
        targetId: 'dp-benefits',
        targetName: 'Benefits Expense',
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
    id: 'acct-3',
    companyId: 'comp-global',
    companyName: 'Global Logistics',
    entityId: 'entity-main',
    entityName: 'Global Main',
    accountId: '6100',
    accountName: 'Fuel Expense',
    activity: 'Fleet Operations',
    status: 'unreviewed',
    mappingType: 'dynamic',
    balance: 65000,
    operation: 'Fleet',
    suggestedCOAId: '6100',
    suggestedCOADescription: 'Fuel Expense',
    aiConfidence: 70,
    polarity: 'Debit',
    notes: 'Needs reviewer confirmation of dynamic allocation.',
    splitDefinitions: [
      {
        id: 'split-3',
        targetId: 'dp-fuel',
        targetName: 'Fuel Expense',
        allocationType: 'amount',
        allocationValue: 45000,
      },
      {
        id: 'split-4',
        targetId: 'dp-maintenance',
        targetName: 'Maintenance Expense',
        allocationType: 'amount',
        allocationValue: 20000,
      },
    ],
    entities: [{ id: 'entity-main', entity: 'Global Main', balance: 65000 }],
  },
  {
    id: 'acct-4',
    companyId: 'comp-heritage',
    companyName: 'Heritage Transport',
    entityId: 'entity-legacy',
    entityName: 'Legacy Ops',
    accountId: '8999',
    accountName: 'Legacy Clearing',
    activity: 'Legacy Clean-up',
    status: 'excluded',
    mappingType: 'exclude',
    balance: 15000,
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
  accounts.reduce((sum, account) => sum + account.balance, 0);

const calculateExcludedTotal = (accounts: GLAccountMappingRow[]): number =>
  accounts
    .filter(account => account.mappingType === 'exclude' || account.status === 'excluded')
    .reduce((sum, account) => sum + account.balance, 0);

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
  bulkAccept: (ids: string[]) => void;
  finalizeMappings: (ids: string[]) => void;
}

const mappingStatuses: MappingStatus[] = ['unreviewed', 'in-review', 'approved', 'rejected', 'excluded'];

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
      accounts: state.accounts.map(account =>
        account.id === id ? { ...account, status } : account
      ),
    })),
  updateMappingType: (id, mappingType) =>
    set(state => ({
      accounts: state.accounts.map(account =>
        account.id === id ? { ...account, mappingType } : account
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
          if (account.mappingType === 'exclude' || account.status === 'excluded') {
            return account;
          }
          return {
            ...account,
            manualCOAId: account.suggestedCOAId,
            status: 'approved',
            mappingType: account.mappingType === 'direct' ? account.mappingType : 'direct',
          };
        }),
      };
    }),
  finalizeMappings: ids => {
    const sourceIds = ids.length ? ids : get().accounts.map(account => account.id);
    const payload = get()
      .accounts.filter(account => sourceIds.includes(account.id))
      .filter(account => account.mappingType !== 'exclude' && account.status !== 'excluded')
      .map(account => ({
        glAccountRawId: account.id,
        coAAccountId: account.manualCOAId || account.suggestedCOAId,
        status: account.status,
        mappingType: account.mappingType,
        polarity: account.polarity,
      }));
    console.log('Finalize mappings', payload);
  },
}));

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
