import { create } from 'zustand';
import { GLAccountMappingRow } from '../types';

const sampleMappings: GLAccountMappingRow[] = [
  {
    id: '1',
    accountId: '10001',
    accountName: 'Sales Revenue',
    balance: 500000,
    operation: 'TMS',
    distributionMethod: 'single',
    distributionValue: 1,
    suggestedCOAId: '4100',
    suggestedCOADescription: 'Revenue',
    confidenceScore: 95,
    entities: [
      { id: 'e1', entity: 'TMS', balance: 400000 },
      { id: 'e2', entity: 'TMS2', balance: 100000 }
    ]
  },
  {
    id: '2',
    accountId: '20001',
    accountName: 'Payroll Taxes',
    balance: 120000,
    operation: 'TMS',
    distributionMethod: 'ratio',
    distributionValue: 0.5,
    suggestedCOAId: '5200',
    suggestedCOADescription: 'Payroll Taxes',
    confidenceScore: 82,
    entities: [
      { id: 'e1', entity: 'TMS', balance: 80000 },
      { id: 'e2', entity: 'TMS2', balance: 40000 }
    ]
  }
];

interface MappingState {
  accounts: GLAccountMappingRow[];
  setManualMapping: (id: string, coaId: string) => void;
  bulkAccept: () => void;
  finalizeMappings: () => void;
}

export const useMappingStore = create<MappingState>((set, get) => ({
  accounts: sampleMappings,
  setManualMapping: (id, coaId) =>
    set(state => ({
      accounts: state.accounts.map(acc =>
        acc.id === id ? { ...acc, manualCOAId: coaId } : acc
      )
    })),
  bulkAccept: () =>
    set(state => ({
      accounts: state.accounts.map(acc =>
        acc.confidenceScore >= 90 && acc.suggestedCOAId
          ? { ...acc, manualCOAId: acc.suggestedCOAId }
          : acc
      )
    })),
  finalizeMappings: () => {
    const payload = get().accounts.map(acc => ({
      glAccountRawId: acc.id,
      coAAccountId: acc.manualCOAId || acc.suggestedCOAId,
    }));
    console.log('Finalize mappings', payload);
  }
}));
