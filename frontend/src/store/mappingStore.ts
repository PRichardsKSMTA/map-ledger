import { create } from 'zustand';
import { GLAccountMappingRow } from '../types';

const sampleMappings: GLAccountMappingRow[] = [
  {
    id: '1',
    companyName: 'Acme Freight',
    entityName: 'TMS',
    accountId: '10001',
    accountName: 'Sales Revenue',
    activity: 'Revenue Recognition',
    status: 'approved',
    mappingType: 'AI Suggested',
    balance: 500000,
    operation: 'TMS',
    distributionMethod: 'single',
    distributionValue: 1,
    suggestedCOAId: '4100',
    suggestedCOADescription: 'Revenue',
    confidenceScore: 95,
    polarity: 'Credit',
    presetId: 'preset-1',
    notes: 'High confidence AI suggestion',
    entities: [
      { id: 'e1', entity: 'TMS', balance: 400000 },
      { id: 'e2', entity: 'TMS2', balance: 100000 }
    ]
  },
  {
    id: '2',
    companyName: 'Acme Freight',
    entityName: 'TMS2',
    accountId: '20001',
    accountName: 'Payroll Taxes',
    activity: 'Payroll Processing',
    status: 'in-review',
    mappingType: 'Manual',
    balance: 120000,
    operation: 'TMS',
    distributionMethod: 'ratio',
    distributionValue: 0.5,
    suggestedCOAId: '5200',
    suggestedCOADescription: 'Payroll Taxes',
    confidenceScore: 82,
    polarity: 'Debit',
    presetId: 'preset-2',
    notes: 'Awaiting allocation details',
    entities: [
      { id: 'e1', entity: 'TMS', balance: 80000 },
      { id: 'e2', entity: 'TMS2', balance: 40000 }
    ]
  },
  {
    id: '3',
    companyName: 'Global Logistics',
    entityName: 'GL Main',
    accountId: '30045',
    accountName: 'Fuel Expense',
    activity: 'Operations',
    status: 'unreviewed',
    mappingType: 'AI Suggested',
    balance: 65000,
    operation: 'GL',
    distributionMethod: 'single',
    distributionValue: 1,
    suggestedCOAId: '6100',
    suggestedCOADescription: 'Fuel Expense',
    confidenceScore: 70,
    polarity: 'Debit',
    notes: 'Needs reviewer confirmation',
    entities: [{ id: 'e3', entity: 'GL Main', balance: 65000 }]
  }
];

interface MappingState {
  accounts: GLAccountMappingRow[];
  searchTerm: string;
  activeStatuses: GLAccountMappingRow['status'][];
  setSearchTerm: (term: string) => void;
  toggleStatusFilter: (status: GLAccountMappingRow['status']) => void;
  clearStatusFilters: () => void;
  setManualMapping: (id: string, coaId: string) => void;
  setPreset: (id: string, presetId: string) => void;
  bulkAccept: (ids: string[]) => void;
  finalizeMappings: (ids: string[]) => void;
}

export const useMappingStore = create<MappingState>((set, get) => ({
  accounts: sampleMappings,
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
  setManualMapping: (id, coaId) =>
    set(state => ({
      accounts: state.accounts.map(acc =>
        acc.id === id ? { ...acc, manualCOAId: coaId } : acc
      )
    })),
  setPreset: (id, presetId) =>
    set(state => ({
      accounts: state.accounts.map(acc =>
        acc.id === id ? { ...acc, presetId } : acc
      )
    })),
  bulkAccept: ids =>
    set(state => {
      if (!ids.length) {
        return state;
      }
      return {
        accounts: state.accounts.map(acc =>
          ids.includes(acc.id) && acc.suggestedCOAId
            ? { ...acc, manualCOAId: acc.suggestedCOAId, status: 'approved' }
            : acc
        )
      };
    }),
  finalizeMappings: ids => {
    const sourceIds = ids.length ? ids : get().accounts.map(acc => acc.id);
    const payload = get()
      .accounts.filter(acc => sourceIds.includes(acc.id))
      .map(acc => ({
        glAccountRawId: acc.id,
        coAAccountId: acc.manualCOAId || acc.suggestedCOAId,
        status: acc.status,
      }));
    console.log('Finalize mappings', payload);
  }
}));
