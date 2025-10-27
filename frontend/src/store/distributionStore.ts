import { create } from 'zustand';
import type { DistributionRow, DistributionType, MappingStatus } from '../types';

export interface DistributionOperationCatalogItem {
  id: string;
  name: string;
}

interface DistributionState {
  rows: DistributionRow[];
  operationsCatalog: DistributionOperationCatalogItem[];
  searchTerm: string;
  statusFilters: MappingStatus[];
  setSearchTerm: (term: string) => void;
  toggleStatusFilter: (status: MappingStatus) => void;
  clearStatusFilters: () => void;
  updateRow: (id: string, updates: Partial<DistributionRow>) => void;
  updateRowType: (id: string, type: DistributionType) => void;
  updateRowOperations: (id: string, operations: DistributionRow['operations']) => void;
  updateRowPreset: (id: string, presetId: string | null) => void;
  updateRowNotes: (id: string, notes: string) => void;
  updateRowStatus: (id: string, status: MappingStatus) => void;
}

const operationsCatalog: DistributionOperationCatalogItem[] = [
  { id: 'ops-log', name: 'Logistics' },
  { id: 'ops-otr', name: 'Over-the-Road' },
  { id: 'ops-ded', name: 'Dedicated' },
  { id: 'ops-ltl', name: 'Less-than-Truckload' },
  { id: 'ops-int', name: 'Intermodal' },
];

const seedRows: DistributionRow[] = [
  {
    id: 'dist-1',
    mappingRowId: 'acct-1',
    accountId: '6100',
    description: 'Fuel Expense',
    activity: 'Fleet Operations',
    type: 'dynamic',
    operations: [
      { id: 'ops-log', name: 'Logistics' },
      { id: 'ops-otr', name: 'Over-the-Road' },
    ],
    presetId: 'preset-1',
    notes: 'Allocate fuel based on miles driven.',
    status: 'in-review',
  },
  {
    id: 'dist-2',
    mappingRowId: 'acct-2',
    accountId: '5200',
    description: 'Payroll Taxes',
    activity: 'Payroll Processing',
    type: 'percentage',
    operations: [
      { id: 'ops-ded', name: 'Dedicated', allocation: 60 },
      { id: 'ops-log', name: 'Logistics', allocation: 40 },
    ],
    presetId: 'preset-2',
    notes: 'Split based on headcount.',
    status: 'approved',
  },
  {
    id: 'dist-3',
    mappingRowId: 'acct-3',
    accountId: '6400',
    description: 'Maintenance Expense',
    activity: 'Fleet Maintenance',
    type: 'direct',
    operations: [{ id: 'ops-ded', name: 'Dedicated' }],
    presetId: null,
    notes: 'Charged entirely to dedicated operations.',
    status: 'unreviewed',
  },
];

const clampOperationsForType = (
  type: DistributionType,
  operations: DistributionRow['operations'],
): DistributionRow['operations'] => {
  if (type === 'direct') {
    const [primary] = operations;
    return primary ? [{ id: primary.id, name: primary.name }] : [];
  }

  if (type === 'percentage') {
    return operations.map((operation, index) => ({
      ...operation,
      allocation: typeof operation.allocation === 'number' ? operation.allocation : index === 0 ? 100 : 0,
    }));
  }

  return operations.map(operation => ({ id: operation.id, name: operation.name, allocation: operation.allocation }));
};

export const useDistributionStore = create<DistributionState>((set, get) => ({
  rows: seedRows,
  operationsCatalog,
  searchTerm: '',
  statusFilters: [],
  setSearchTerm: term => set({ searchTerm: term }),
  toggleStatusFilter: status =>
    set(state => ({
      statusFilters: state.statusFilters.includes(status)
        ? state.statusFilters.filter(value => value !== status)
        : [...state.statusFilters, status],
    })),
  clearStatusFilters: () => set({ statusFilters: [] }),
  updateRow: (id, updates) =>
    set(state => ({
      rows: state.rows.map(row => (row.id === id ? { ...row, ...updates } : row)),
    })),
  updateRowType: (id, type) =>
    set(state => ({
      rows: state.rows.map(row =>
        row.id === id
          ? {
              ...row,
              type,
              operations: clampOperationsForType(type, row.operations),
            }
          : row,
      ),
    })),
  updateRowOperations: (id, operations) =>
    set(state => ({
      rows: state.rows.map(row => (row.id === id ? { ...row, operations } : row)),
    })),
  updateRowPreset: (id, presetId) =>
    set(state => ({
      rows: state.rows.map(row => (row.id === id ? { ...row, presetId: presetId ?? undefined } : row)),
    })),
  updateRowNotes: (id, notes) =>
    set(state => ({
      rows: state.rows.map(row => (row.id === id ? { ...row, notes: notes || undefined } : row)),
    })),
  updateRowStatus: (id, status) =>
    set(state => ({
      rows: state.rows.map(row => (row.id === id ? { ...row, status } : row)),
    })),
}));
