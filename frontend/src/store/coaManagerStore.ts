import { create } from 'zustand';
import {
  createIndustry,
  fetchIndustries,
  fetchIndustryCoaManager,
  updateIndustryIsFinancial,
  updateIndustryIsFinancialBatch,
  updateIndustryIsSurvey,
  updateIndustryIsSurveyBatch,
  updateIndustryCostType,
  updateIndustryCostTypeBatch,
  updateIndustryAccount,
  deleteIndustryAccount,
  validateAccountField,
  fetchGroupCodes,
  type CoaManagerIsFinancial,
  type CoaManagerIsSurvey,
  type CoaManagerColumn,
  type CoaManagerCostType,
  type CoaManagerRow,
  type CoaManagerAccountUpdateInput,
  type GroupCodeMapping,
  IndustryAlreadyExistsError,
} from '../services/coaManagerService';

export type RowUpdateStatus = {
  state: 'idle' | 'pending' | 'success' | 'error';
  message?: string;
};

export interface RowValidationError {
  field: string;
  message: string;
}

interface CoaManagerState {
  industries: string[];
  industriesLoading: boolean;
  industriesError: string | null;
  selectedIndustry: string;
  columns: CoaManagerColumn[];
  rows: CoaManagerRow[];
  rowsLoading: boolean;
  rowsError: string | null;
  selectedRowIds: Set<string>;
  rowUpdateStatus: Record<string, RowUpdateStatus>;
  createIndustryError: string | null;
  createIndustryLoading: boolean;
  // Edit mode state
  isEditMode: boolean;
  originalRows: CoaManagerRow[];
  changedRowIds: Set<string>;
  deletedRowIds: Set<string>;
  rowValidationErrors: Record<string, RowValidationError | null>;
  laborGroups: GroupCodeMapping[];
  operationalGroups: GroupCodeMapping[];
  groupCodesLoading: boolean;
  // Actions
  loadIndustries: () => Promise<void>;
  selectIndustry: (industry: string) => Promise<void>;
  refreshIndustryData: () => Promise<void>;
  createIndustry: (name: string) => Promise<boolean>;
  clearCreateIndustryError: () => void;
  toggleRowSelection: (rowId: string) => void;
  toggleSelectAll: () => void;
  setSelectedRowIds: (rowIds: string[]) => void;
  clearRowSelection: () => void;
  updateRowCostType: (rowId: string, costType: CoaManagerCostType) => Promise<void>;
  updateBatchCostType: (rowIds: string[], costType: CoaManagerCostType) => Promise<void>;
  updateRowIsFinancial: (rowId: string, isFinancial: CoaManagerIsFinancial) => Promise<void>;
  updateBatchIsFinancial: (rowIds: string[], isFinancial: CoaManagerIsFinancial) => Promise<void>;
  updateRowIsSurvey: (rowId: string, isSurvey: CoaManagerIsSurvey) => Promise<void>;
  updateBatchIsSurvey: (rowIds: string[], isSurvey: CoaManagerIsSurvey) => Promise<void>;
  // Edit mode actions
  setEditMode: (enabled: boolean) => void;
  updateAccountField: (
    rowId: string,
    updates: CoaManagerAccountUpdateInput,
  ) => Promise<{ success: boolean; error?: string }>;
  deleteAccount: (accountNumber: string) => Promise<{ success: boolean; error?: string }>;
  undoRowChanges: (rowId: string) => Promise<void>;
  undoAllChanges: () => Promise<void>;
  hasUndoableChanges: (rowId: string) => boolean;
  hasAnyUndoableChanges: () => boolean;
  validateField: (
    rowId: string,
    field: 'accountNumber' | 'accountName',
    value: string,
  ) => Promise<{ valid: boolean; message?: string }>;
  clearRowValidationError: (rowId: string) => void;
}

const STATUS_RESET_MS = 2500;

const applyStatusReset = (
  set: (partial: Partial<CoaManagerState> | ((state: CoaManagerState) => Partial<CoaManagerState>)) =>
    void,
  rowIds: string[],
) => {
  window.setTimeout(() => {
    set(state => {
      const next = { ...state.rowUpdateStatus };
      rowIds.forEach(rowId => {
        if (next[rowId]?.state === 'success') {
          next[rowId] = { state: 'idle' };
        }
      });
      return { rowUpdateStatus: next };
    });
  }, STATUS_RESET_MS);
};

export const useCoaManagerStore = create<CoaManagerState>((set, get) => ({
  industries: [],
  industriesLoading: false,
  industriesError: null,
  selectedIndustry: '',
  columns: [],
  rows: [],
  rowsLoading: false,
  rowsError: null,
  selectedRowIds: new Set(),
  rowUpdateStatus: {},
  createIndustryError: null,
  createIndustryLoading: false,
  // Edit mode initial state
  isEditMode: false,
  originalRows: [],
  changedRowIds: new Set(),
  deletedRowIds: new Set(),
  rowValidationErrors: {},
  laborGroups: [],
  operationalGroups: [],
  groupCodesLoading: false,
  loadIndustries: async () => {
    set({ industriesLoading: true, industriesError: null });
    try {
      const industries = await fetchIndustries();
      set(state => ({
        industries,
        industriesLoading: false,
        industriesError: null,
        selectedIndustry: industries.includes(state.selectedIndustry)
          ? state.selectedIndustry
          : '',
        rows: industries.includes(state.selectedIndustry) ? state.rows : [],
        columns: industries.includes(state.selectedIndustry) ? state.columns : [],
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load industries.';
      set({ industriesLoading: false, industriesError: message });
    }
  },
  selectIndustry: async (industry: string) => {
    set({
      selectedIndustry: industry,
      rows: [],
      columns: [],
      rowsError: null,
      rowUpdateStatus: {},
      selectedRowIds: new Set(),
    });

    if (!industry) {
      return;
    }

    await get().refreshIndustryData();
  },
  refreshIndustryData: async () => {
    const industry = get().selectedIndustry;
    if (!industry) {
      return;
    }

    set({ rowsLoading: true, rowsError: null });
    try {
      const response = await fetchIndustryCoaManager(industry);
      set({
        columns: response.columns,
        rows: response.rows,
        rowsLoading: false,
        rowUpdateStatus: {},
        selectedRowIds: new Set(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load COA table.';
      set({ rowsLoading: false, rowsError: message });
    }
  },
  createIndustry: async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      set({ createIndustryError: 'Industry name is required.' });
      return false;
    }

    set({ createIndustryLoading: true, createIndustryError: null });
    try {
      const created = await createIndustry(trimmed);
      set(state => ({
        industries: state.industries.includes(created)
          ? state.industries
          : [...state.industries, created],
        createIndustryLoading: false,
        createIndustryError: null,
      }));
      await get().selectIndustry(created);
      return true;
    } catch (error) {
      const message =
        error instanceof IndustryAlreadyExistsError
          ? 'That industry already exists.'
          : error instanceof Error
            ? error.message
            : 'Unable to create industry.';
      set({ createIndustryLoading: false, createIndustryError: message });
      return false;
    }
  },
  clearCreateIndustryError: () => set({ createIndustryError: null }),
  toggleRowSelection: (rowId: string) => {
    set(state => {
      const next = new Set(state.selectedRowIds);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return { selectedRowIds: next };
    });
  },
  toggleSelectAll: () => {
    set(state => {
      if (state.rows.length === 0) {
        return { selectedRowIds: state.selectedRowIds };
      }
      const isAllSelected = state.selectedRowIds.size === state.rows.length;
      return {
        selectedRowIds: isAllSelected ? new Set() : new Set(state.rows.map(row => row.id)),
      };
    });
  },
  setSelectedRowIds: (rowIds: string[]) => {
    set({ selectedRowIds: new Set(rowIds) });
  },
  clearRowSelection: () => set({ selectedRowIds: new Set() }),
  updateRowCostType: async (rowId: string, costType: CoaManagerCostType) => {
    const { selectedIndustry, rows } = get();
    if (!selectedIndustry) {
      return;
    }

    const previousCostTypes = new Map<string, CoaManagerCostType>();
    const nextRows = rows.map(row => {
      if (row.id !== rowId) {
        return row;
      }
      previousCostTypes.set(row.id, row.costType);
      return { ...row, costType };
    });

    set(state => ({
      rows: nextRows,
      rowUpdateStatus: {
        ...state.rowUpdateStatus,
        [rowId]: { state: 'pending' },
      },
    }));

    try {
      await updateIndustryCostType(selectedIndustry, rowId, costType);
      set(state => ({
        rowUpdateStatus: {
          ...state.rowUpdateStatus,
          [rowId]: { state: 'success' },
        },
      }));
      applyStatusReset(set, [rowId]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Update failed.';
      set(state => ({
        rows: state.rows.map(row =>
          previousCostTypes.has(row.id)
            ? { ...row, costType: previousCostTypes.get(row.id) ?? row.costType }
            : row,
        ),
        rowUpdateStatus: {
          ...state.rowUpdateStatus,
          [rowId]: { state: 'error', message },
        },
      }));
    }
  },
  updateBatchCostType: async (rowIds: string[], costType: CoaManagerCostType) => {
    const { selectedIndustry, rows } = get();
    if (!selectedIndustry || rowIds.length === 0) {
      return;
    }

    const rowIdSet = new Set(rowIds);
    const previousCostTypes = new Map<string, CoaManagerCostType>();
    const nextRows = rows.map(row => {
      if (!rowIdSet.has(row.id)) {
        return row;
      }
      previousCostTypes.set(row.id, row.costType);
      return { ...row, costType };
    });

    set(state => {
      const nextStatus = { ...state.rowUpdateStatus };
      rowIds.forEach(id => {
        nextStatus[id] = { state: 'pending' };
      });
      return { rows: nextRows, rowUpdateStatus: nextStatus };
    });

    try {
      await updateIndustryCostTypeBatch(selectedIndustry, rowIds, costType);
      set(state => {
        const nextStatus = { ...state.rowUpdateStatus };
        rowIds.forEach(id => {
          nextStatus[id] = { state: 'success' };
        });
        return { rowUpdateStatus: nextStatus };
      });
      applyStatusReset(set, rowIds);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Batch update failed.';
      set(state => {
        const nextStatus = { ...state.rowUpdateStatus };
        rowIds.forEach(id => {
          nextStatus[id] = { state: 'error', message };
        });
        return {
          rows: state.rows.map(row =>
            previousCostTypes.has(row.id)
              ? { ...row, costType: previousCostTypes.get(row.id) ?? row.costType }
              : row,
          ),
          rowUpdateStatus: nextStatus,
        };
      });
    }
  },
  updateRowIsFinancial: async (rowId: string, isFinancial: CoaManagerIsFinancial) => {
    const { selectedIndustry, rows } = get();
    if (!selectedIndustry) {
      return;
    }

    const previousIsFinancial = new Map<string, CoaManagerIsFinancial>();
    const nextRows = rows.map(row => {
      if (row.id !== rowId) {
        return row;
      }
      previousIsFinancial.set(row.id, row.isFinancial);
      return { ...row, isFinancial };
    });

    set(state => ({
      rows: nextRows,
      rowUpdateStatus: {
        ...state.rowUpdateStatus,
        [rowId]: { state: 'pending' },
      },
    }));

    try {
      await updateIndustryIsFinancial(selectedIndustry, rowId, isFinancial);
      set(state => ({
        rowUpdateStatus: {
          ...state.rowUpdateStatus,
          [rowId]: { state: 'success' },
        },
      }));
      applyStatusReset(set, [rowId]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Update failed.';
      set(state => ({
        rows: state.rows.map(row =>
          previousIsFinancial.has(row.id)
            ? { ...row, isFinancial: previousIsFinancial.get(row.id) ?? row.isFinancial }
            : row,
        ),
        rowUpdateStatus: {
          ...state.rowUpdateStatus,
          [rowId]: { state: 'error', message },
        },
      }));
    }
  },
  updateBatchIsFinancial: async (rowIds: string[], isFinancial: CoaManagerIsFinancial) => {
    const { selectedIndustry, rows } = get();
    if (!selectedIndustry || rowIds.length === 0) {
      return;
    }

    const rowIdSet = new Set(rowIds);
    const previousIsFinancial = new Map<string, CoaManagerIsFinancial>();
    const nextRows = rows.map(row => {
      if (!rowIdSet.has(row.id)) {
        return row;
      }
      previousIsFinancial.set(row.id, row.isFinancial);
      return { ...row, isFinancial };
    });

    set(state => {
      const nextStatus = { ...state.rowUpdateStatus };
      rowIds.forEach(id => {
        nextStatus[id] = { state: 'pending' };
      });
      return { rows: nextRows, rowUpdateStatus: nextStatus };
    });

    try {
      await updateIndustryIsFinancialBatch(selectedIndustry, rowIds, isFinancial);
      set(state => {
        const nextStatus = { ...state.rowUpdateStatus };
        rowIds.forEach(id => {
          nextStatus[id] = { state: 'success' };
        });
        return { rowUpdateStatus: nextStatus };
      });
      applyStatusReset(set, rowIds);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Batch update failed.';
      set(state => {
        const nextStatus = { ...state.rowUpdateStatus };
        rowIds.forEach(id => {
          nextStatus[id] = { state: 'error', message };
        });
        return {
          rows: state.rows.map(row =>
            previousIsFinancial.has(row.id)
              ? { ...row, isFinancial: previousIsFinancial.get(row.id) ?? row.isFinancial }
              : row,
          ),
          rowUpdateStatus: nextStatus,
        };
      });
    }
  },
  updateRowIsSurvey: async (rowId: string, isSurvey: CoaManagerIsSurvey) => {
    const { selectedIndustry, rows } = get();
    if (!selectedIndustry) {
      return;
    }

    const previousIsSurvey = new Map<string, CoaManagerIsSurvey>();
    const nextRows = rows.map(row => {
      if (row.id !== rowId) {
        return row;
      }
      previousIsSurvey.set(row.id, row.isSurvey);
      return { ...row, isSurvey };
    });

    set(state => ({
      rows: nextRows,
      rowUpdateStatus: {
        ...state.rowUpdateStatus,
        [rowId]: { state: 'pending' },
      },
    }));

    try {
      await updateIndustryIsSurvey(selectedIndustry, rowId, isSurvey);
      set(state => ({
        rowUpdateStatus: {
          ...state.rowUpdateStatus,
          [rowId]: { state: 'success' },
        },
      }));
      applyStatusReset(set, [rowId]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Update failed.';
      set(state => ({
        rows: state.rows.map(row =>
          previousIsSurvey.has(row.id)
            ? { ...row, isSurvey: previousIsSurvey.get(row.id) ?? row.isSurvey }
            : row,
        ),
        rowUpdateStatus: {
          ...state.rowUpdateStatus,
          [rowId]: { state: 'error', message },
        },
      }));
    }
  },
  updateBatchIsSurvey: async (rowIds: string[], isSurvey: CoaManagerIsSurvey) => {
    const { selectedIndustry, rows } = get();
    if (!selectedIndustry || rowIds.length === 0) {
      return;
    }

    const rowIdSet = new Set(rowIds);
    const previousIsSurvey = new Map<string, CoaManagerIsSurvey>();
    const nextRows = rows.map(row => {
      if (!rowIdSet.has(row.id)) {
        return row;
      }
      previousIsSurvey.set(row.id, row.isSurvey);
      return { ...row, isSurvey };
    });

    set(state => {
      const nextStatus = { ...state.rowUpdateStatus };
      rowIds.forEach(id => {
        nextStatus[id] = { state: 'pending' };
      });
      return { rows: nextRows, rowUpdateStatus: nextStatus };
    });

    try {
      await updateIndustryIsSurveyBatch(selectedIndustry, rowIds, isSurvey);
      set(state => {
        const nextStatus = { ...state.rowUpdateStatus };
        rowIds.forEach(id => {
          nextStatus[id] = { state: 'success' };
        });
        return { rowUpdateStatus: nextStatus };
      });
      applyStatusReset(set, rowIds);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Batch update failed.';
      set(state => {
        const nextStatus = { ...state.rowUpdateStatus };
        rowIds.forEach(id => {
          nextStatus[id] = { state: 'error', message };
        });
        return {
          rows: state.rows.map(row =>
            previousIsSurvey.has(row.id)
              ? { ...row, isSurvey: previousIsSurvey.get(row.id) ?? row.isSurvey }
              : row,
          ),
          rowUpdateStatus: nextStatus,
        };
      });
    }
  },

  // ============================================================================
  // Edit Mode Actions
  // ============================================================================

  setEditMode: (enabled: boolean) => {
    const { rows, selectedIndustry } = get();
    if (enabled) {
      // Entering edit mode - snapshot current rows and load group codes
      set({
        isEditMode: true,
        originalRows: rows.map(row => ({ ...row })),
        changedRowIds: new Set(),
        deletedRowIds: new Set(),
        rowValidationErrors: {},
        groupCodesLoading: true,
      });

      // Load group codes in background
      if (selectedIndustry) {
        fetchGroupCodes(selectedIndustry)
          .then(response => {
            set({
              laborGroups: response.laborGroups,
              operationalGroups: response.operationalGroups,
              groupCodesLoading: false,
            });
          })
          .catch(() => {
            set({ groupCodesLoading: false });
          });
      }
    } else {
      // Exiting edit mode - clear undo history
      set({
        isEditMode: false,
        originalRows: [],
        changedRowIds: new Set(),
        deletedRowIds: new Set(),
        rowValidationErrors: {},
        laborGroups: [],
        operationalGroups: [],
      });
    }
  },

  updateAccountField: async (rowId: string, updates: CoaManagerAccountUpdateInput) => {
    const { selectedIndustry, rows } = get();
    if (!selectedIndustry) {
      return { success: false, error: 'No industry selected.' };
    }

    // Optimistically update local state
    const nextRows = rows.map(row => {
      if (row.id !== rowId) {
        return row;
      }
      const updated = { ...row };
      if (updates.coreAccount !== undefined) {
        // Rebuild account number with new core
        const parts = row.accountNumber.split('-');
        if (parts.length === 3) {
          updated.accountNumber = `${updates.coreAccount}-${parts[1]}-${parts[2]}`;
        }
      }
      if (updates.accountName !== undefined) {
        updated.accountName = updates.accountName ?? '';
      }
      if (updates.laborGroup !== undefined) {
        updated.laborGroup = updates.laborGroup ?? '';
      }
      if (updates.operationalGroup !== undefined) {
        updated.operationalGroup = updates.operationalGroup ?? '';
      }
      if (updates.category !== undefined) {
        updated.category = updates.category ?? '';
      }
      if (updates.accountType !== undefined) {
        updated.accountType = updates.accountType ?? '';
      }
      if (updates.subCategory !== undefined) {
        updated.subCategory = updates.subCategory ?? '';
      }
      // Update account number if labor or operational group code changed
      if (updates.laborGroupCode !== undefined || updates.operationalGroupCode !== undefined) {
        const parts = row.accountNumber.split('-');
        if (parts.length === 3) {
          const core = updates.coreAccount ?? parts[0];
          const opCode = updates.operationalGroupCode ?? parts[1];
          const laborCode = updates.laborGroupCode ?? parts[2];
          updated.accountNumber = `${core}-${opCode.padStart(3, '0')}-${laborCode.padStart(3, '0')}`;
        }
      }
      return updated;
    });

    set(state => ({
      rows: nextRows,
      changedRowIds: new Set([...state.changedRowIds, rowId]),
      rowUpdateStatus: {
        ...state.rowUpdateStatus,
        [rowId]: { state: 'pending' },
      },
      rowValidationErrors: {
        ...state.rowValidationErrors,
        [rowId]: null,
      },
    }));

    try {
      await updateIndustryAccount(selectedIndustry, rowId, updates);
      set(state => ({
        rowUpdateStatus: {
          ...state.rowUpdateStatus,
          [rowId]: { state: 'success' },
        },
      }));
      applyStatusReset(set, [rowId]);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Update failed.';
      // Revert to previous value from originalRows
      const { originalRows } = get();
      const original = originalRows.find(r => r.id === rowId);
      set(state => ({
        rows: original
          ? state.rows.map(row => (row.id === rowId ? { ...original } : row))
          : state.rows,
        rowUpdateStatus: {
          ...state.rowUpdateStatus,
          [rowId]: { state: 'error', message },
        },
      }));
      return { success: false, error: message };
    }
  },

  deleteAccount: async (accountNumber: string) => {
    const { selectedIndustry, rows } = get();
    if (!selectedIndustry) {
      return { success: false, error: 'No industry selected.' };
    }

    const targetRow = rows.find(row => row.accountNumber === accountNumber);
    if (!targetRow) {
      return { success: false, error: 'Account not found.' };
    }

    // Optimistically remove from local state
    set(state => ({
      rows: state.rows.filter(row => row.accountNumber !== accountNumber),
      deletedRowIds: new Set([...state.deletedRowIds, targetRow.id]),
      rowUpdateStatus: {
        ...state.rowUpdateStatus,
        [targetRow.id]: { state: 'pending' },
      },
    }));

    try {
      await deleteIndustryAccount(selectedIndustry, accountNumber);
      set(state => {
        const nextStatus = { ...state.rowUpdateStatus };
        delete nextStatus[targetRow.id];
        return { rowUpdateStatus: nextStatus };
      });
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Delete failed.';
      // Restore the row
      set(state => ({
        rows: [...state.rows, targetRow],
        deletedRowIds: new Set([...state.deletedRowIds].filter(id => id !== targetRow.id)),
        rowUpdateStatus: {
          ...state.rowUpdateStatus,
          [targetRow.id]: { state: 'error', message },
        },
      }));
      return { success: false, error: message };
    }
  },

  undoRowChanges: async (rowId: string) => {
    const { selectedIndustry, originalRows } = get();
    if (!selectedIndustry) {
      return;
    }

    const original = originalRows.find(r => r.id === rowId);
    if (!original) {
      return;
    }

    // Update local state immediately
    set(state => ({
      rows: state.rows.map(row => (row.id === rowId ? { ...original } : row)),
      changedRowIds: new Set([...state.changedRowIds].filter(id => id !== rowId)),
      rowUpdateStatus: {
        ...state.rowUpdateStatus,
        [rowId]: { state: 'pending' },
      },
      rowValidationErrors: {
        ...state.rowValidationErrors,
        [rowId]: null,
      },
    }));

    // Persist the original values back to the database
    try {
      const parts = original.accountNumber.split('-');
      const updates: CoaManagerAccountUpdateInput = {
        coreAccount: parts[0] ?? null,
        accountName: original.accountName,
        laborGroup: original.laborGroup,
        operationalGroup: original.operationalGroup,
        category: original.category,
        accountType: original.accountType,
        subCategory: original.subCategory,
      };
      if (parts.length === 3) {
        updates.operationalGroupCode = parts[1];
        updates.laborGroupCode = parts[2];
      }
      await updateIndustryAccount(selectedIndustry, rowId, updates);
      set(state => ({
        rowUpdateStatus: {
          ...state.rowUpdateStatus,
          [rowId]: { state: 'success' },
        },
      }));
      applyStatusReset(set, [rowId]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Undo failed.';
      set(state => ({
        rowUpdateStatus: {
          ...state.rowUpdateStatus,
          [rowId]: { state: 'error', message },
        },
      }));
    }
  },

  undoAllChanges: async () => {
    const { changedRowIds, originalRows, selectedIndustry } = get();
    if (!selectedIndustry || changedRowIds.size === 0) {
      return;
    }

    const idsToUndo = Array.from(changedRowIds);

    // Update local state immediately
    set(state => {
      const originalLookup = new Map(originalRows.map(r => [r.id, r]));
      return {
        rows: state.rows.map(row => {
          const original = originalLookup.get(row.id);
          return original ? { ...original } : row;
        }),
        changedRowIds: new Set(),
        rowUpdateStatus: idsToUndo.reduce(
          (acc, id) => {
            acc[id] = { state: 'pending' };
            return acc;
          },
          { ...state.rowUpdateStatus },
        ),
        rowValidationErrors: {},
      };
    });

    // Persist each undo
    const results = await Promise.allSettled(
      idsToUndo.map(async rowId => {
        const original = originalRows.find(r => r.id === rowId);
        if (!original) {
          return;
        }
        const parts = original.accountNumber.split('-');
        const updates: CoaManagerAccountUpdateInput = {
          coreAccount: parts[0] ?? null,
          accountName: original.accountName,
          laborGroup: original.laborGroup,
          operationalGroup: original.operationalGroup,
          category: original.category,
          accountType: original.accountType,
          subCategory: original.subCategory,
        };
        if (parts.length === 3) {
          updates.operationalGroupCode = parts[1];
          updates.laborGroupCode = parts[2];
        }
        await updateIndustryAccount(selectedIndustry, rowId, updates);
      }),
    );

    // Update status based on results
    set(state => {
      const nextStatus = { ...state.rowUpdateStatus };
      results.forEach((result, index) => {
        const rowId = idsToUndo[index];
        if (result.status === 'fulfilled') {
          nextStatus[rowId] = { state: 'success' };
        } else {
          nextStatus[rowId] = {
            state: 'error',
            message: result.reason instanceof Error ? result.reason.message : 'Undo failed.',
          };
        }
      });
      return { rowUpdateStatus: nextStatus };
    });

    applyStatusReset(set, idsToUndo);
  },

  hasUndoableChanges: (rowId: string) => {
    const { changedRowIds } = get();
    return changedRowIds.has(rowId);
  },

  hasAnyUndoableChanges: () => {
    const { changedRowIds } = get();
    return changedRowIds.size > 0;
  },

  validateField: async (
    rowId: string,
    field: 'accountNumber' | 'accountName',
    value: string,
  ) => {
    const { selectedIndustry } = get();
    if (!selectedIndustry) {
      return { valid: false, message: 'No industry selected.' };
    }

    try {
      const response = await validateAccountField(selectedIndustry, field, value, rowId);
      if (!response.valid) {
        const message =
          field === 'accountNumber'
            ? 'This account number already exists.'
            : 'This account name already exists.';
        set(state => ({
          rowValidationErrors: {
            ...state.rowValidationErrors,
            [rowId]: { field, message },
          },
        }));
        return { valid: false, message };
      }
      set(state => ({
        rowValidationErrors: {
          ...state.rowValidationErrors,
          [rowId]: null,
        },
      }));
      return { valid: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Validation failed.';
      return { valid: false, message };
    }
  },

  clearRowValidationError: (rowId: string) => {
    set(state => ({
      rowValidationErrors: {
        ...state.rowValidationErrors,
        [rowId]: null,
      },
    }));
  },
}));
