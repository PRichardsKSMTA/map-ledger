import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
  Filter,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import AddCoaAccountsModal from '../components/coa/AddCoaAccountsModal';
import DeleteAccountModal from '../components/coa/DeleteAccountModal';
import EditableCoreAccountCell from '../components/coa/EditableCoreAccountCell';
import EditableTextCell from '../components/coa/EditableTextCell';
import IndustryImportModal from '../components/coa/IndustryImportModal';
import {
  createIndustry as createIndustryService,
  createIndustryAccounts,
  importIndustryCoaFile,
  IndustryAlreadyExistsError,
  type CoaManagerAccountCreateInput,
} from '../services/coaManagerService';
import { useAuthStore } from '../store/authStore';
import { getCurrentAppUser } from '../services/appUserService';
import type { AppUserRole } from '../services/appUserService';
import { useCoaManagerStore } from '../store/coaManagerStore';
import toProperCase from '../utils/properCase';
import scrollPageToTop from '../utils/scroll';

const costTypeOptions = [
  { label: 'None', value: '' },
  { label: 'Balance Sheet', value: 'Balance Sheet' },
  { label: 'Overhead', value: 'Overhead' },
  { label: 'Variable', value: 'Variable' },
  { label: 'Revenue', value: 'Revenue' },
] as const;

const flagOptions = [
  { label: 'Any', value: '' },
  { label: 'Yes', value: 'true' },
  { label: 'No', value: 'false' },
] as const;
const isFinancialTooltip =
  'True marks the account as a financial account for reporting; false marks it as an operational account.';
const isSurveyTooltip = 'True marks the account as a survey account; false marks it as non-survey.';

type CostType = (typeof costTypeOptions)[number]['value'];
type FlagValue = (typeof flagOptions)[number]['value'];
type SortKey =
  | 'accountNumber'
  | 'accountName'
  | 'laborGroup'
  | 'operationalGroup'
  | 'category'
  | 'accountType'
  | 'subCategory'
  | 'isFinancial'
  | 'isSurvey'
  | 'costType';
type SortDirection = 'asc' | 'desc';
type FilterKey = 'laborGroup' | 'operationalGroup' | 'category' | 'accountType' | 'subCategory';

const resolveGroupValue = (value?: string | null) => {
  if (!value) {
    return '-';
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : '-';
};

const areSelectionsEqual = (
  current: string[] | null,
  next: string[] | null,
): boolean => {
  if (current === null || next === null) {
    return current === next;
  }
  if (current.length !== next.length) {
    return false;
  }
  for (let index = 0; index < current.length; index += 1) {
    if (current[index] !== next[index]) {
      return false;
    }
  }
  return true;
};

const formatFlagValue = (value: boolean | null) => {
  if (value === true) {
    return 'true';
  }
  if (value === false) {
    return 'false';
  }
  return '';
};

const parseFlagValue = (value: FlagValue): boolean | null => {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return null;
};

export default function CoaManager() {
  const { user } = useAuthStore();
  const [currentAppUserRole, setCurrentAppUserRole] = useState<AppUserRole | null>(null);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const industries = useCoaManagerStore(state => state.industries);
  const industriesLoading = useCoaManagerStore(state => state.industriesLoading);
  const industriesError = useCoaManagerStore(state => state.industriesError);
  const selectedIndustry = useCoaManagerStore(state => state.selectedIndustry);
  const rows = useCoaManagerStore(state => state.rows);
  const rowsLoading = useCoaManagerStore(state => state.rowsLoading);
  const rowsError = useCoaManagerStore(state => state.rowsError);
  const columns = useCoaManagerStore(state => state.columns);
  const selectedRowIds = useCoaManagerStore(state => state.selectedRowIds);
  const rowStatus = useCoaManagerStore(state => state.rowUpdateStatus);
  const loadIndustries = useCoaManagerStore(state => state.loadIndustries);
  const selectIndustry = useCoaManagerStore(state => state.selectIndustry);
  const toggleRowSelection = useCoaManagerStore(state => state.toggleRowSelection);
  const setSelectedRowIds = useCoaManagerStore(state => state.setSelectedRowIds);
  const clearRowSelection = useCoaManagerStore(state => state.clearRowSelection);
  const updateRowCostType = useCoaManagerStore(state => state.updateRowCostType);
  const updateBatchCostType = useCoaManagerStore(state => state.updateBatchCostType);
  const updateRowIsFinancial = useCoaManagerStore(state => state.updateRowIsFinancial);
  const updateBatchIsFinancial = useCoaManagerStore(state => state.updateBatchIsFinancial);
  const updateRowIsSurvey = useCoaManagerStore(state => state.updateRowIsSurvey);
  const updateBatchIsSurvey = useCoaManagerStore(state => state.updateBatchIsSurvey);
  const refreshIndustryData = useCoaManagerStore(state => state.refreshIndustryData);
  // Edit mode state
  const isEditMode = useCoaManagerStore(state => state.isEditMode);
  const setEditMode = useCoaManagerStore(state => state.setEditMode);
  const laborGroups = useCoaManagerStore(state => state.laborGroups);
  const operationalGroups = useCoaManagerStore(state => state.operationalGroups);
  const rowValidationErrors = useCoaManagerStore(state => state.rowValidationErrors);
  const updateAccountField = useCoaManagerStore(state => state.updateAccountField);
  const deleteAccount = useCoaManagerStore(state => state.deleteAccount);
  const undoRowChanges = useCoaManagerStore(state => state.undoRowChanges);
  const undoAllChanges = useCoaManagerStore(state => state.undoAllChanges);
  const hasUndoableChanges = useCoaManagerStore(state => state.hasUndoableChanges);
  const hasAnyUndoableChanges = useCoaManagerStore(state => state.hasAnyUndoableChanges);
  const validateField = useCoaManagerStore(state => state.validateField);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isAddAccountsModalOpen, setIsAddAccountsModalOpen] = useState(false);
  const [deleteModalRow, setDeleteModalRow] = useState<{
    id: string;
    accountNumber: string;
    accountName: string;
  } | null>(null);
  const [sortConfig, setSortConfig] = useState<{
    key: SortKey;
    direction: SortDirection;
  } | null>(null);
  const [laborGroupFilter, setLaborGroupFilter] = useState<string[] | null>(null);
  const [operationalGroupFilter, setOperationalGroupFilter] = useState<string[] | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string[] | null>(null);
  const [accountTypeFilter, setAccountTypeFilter] = useState<string[] | null>(null);
  const [subCategoryFilter, setSubCategoryFilter] = useState<string[] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);
  const laborGroupMenuRef = useRef<HTMLDivElement | null>(null);
  const operationalGroupMenuRef = useRef<HTMLDivElement | null>(null);
  const categoryMenuRef = useRef<HTMLDivElement | null>(null);
  const accountTypeMenuRef = useRef<HTMLDivElement | null>(null);
  const subCategoryMenuRef = useRef<HTMLDivElement | null>(null);
  const laborGroupSelectAllRef = useRef<HTMLInputElement | null>(null);
  const operationalGroupSelectAllRef = useRef<HTMLInputElement | null>(null);
  const categorySelectAllRef = useRef<HTMLInputElement | null>(null);
  const accountTypeSelectAllRef = useRef<HTMLInputElement | null>(null);
  const subCategorySelectAllRef = useRef<HTMLInputElement | null>(null);
  const columnLabels = useMemo(() => {
    return new Map(columns.map(column => [column.key, column.label]));
  }, [columns]);

  const resolveLabel = (key: string, fallback: string) =>
    columnLabels.get(key) ?? fallback;

  const laborGroupOptions = useMemo(() => {
    const options = new Set<string>();
    rows.forEach(row => {
      options.add(resolveGroupValue(row.laborGroup));
    });
    return Array.from(options).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }),
    );
  }, [rows]);

  const operationalGroupOptions = useMemo(() => {
    const options = new Set<string>();
    rows.forEach(row => {
      options.add(resolveGroupValue(row.operationalGroup));
    });
    return Array.from(options).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }),
    );
  }, [rows]);

  // Filter options for category, accountType, subCategory (includes '-' for empty values)
  const categoryOptions = useMemo(() => {
    const options = new Set<string>();
    rows.forEach(row => {
      const value = row.category?.trim();
      options.add(value && value.length > 0 ? value : '-');
    });
    return Array.from(options).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }),
    );
  }, [rows]);

  const accountTypeOptions = useMemo(() => {
    const options = new Set<string>();
    rows.forEach(row => {
      const value = row.accountType?.trim();
      options.add(value && value.length > 0 ? value : '-');
    });
    return Array.from(options).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }),
    );
  }, [rows]);

  const subCategoryOptions = useMemo(() => {
    const options = new Set<string>();
    rows.forEach(row => {
      const value = row.subCategory?.trim();
      options.add(value && value.length > 0 ? value : '-');
    });
    return Array.from(options).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }),
    );
  }, [rows]);

  // Labor group dropdown options (name + code pairs)
  const laborGroupDropdownOptions = useMemo(() => {
    if (laborGroups.length > 0) {
      return laborGroups;
    }
    // Fallback to rows if group codes haven't loaded
    const options = new Map<string, string>();
    rows.forEach(row => {
      if (row.laborGroup?.trim()) {
        const parts = row.accountNumber.split('-');
        const code = parts.length === 3 ? parts[2] : '';
        if (!options.has(row.laborGroup)) {
          options.set(row.laborGroup, code);
        }
      }
    });
    return Array.from(options.entries()).map(([name, code]) => ({ name, code }));
  }, [laborGroups, rows]);

  // Operational group dropdown options (name + code pairs)
  const operationalGroupDropdownOptions = useMemo(() => {
    if (operationalGroups.length > 0) {
      return operationalGroups;
    }
    // Fallback to rows if group codes haven't loaded
    const options = new Map<string, string>();
    rows.forEach(row => {
      if (row.operationalGroup?.trim()) {
        const parts = row.accountNumber.split('-');
        const code = parts.length === 3 ? parts[1] : '';
        if (!options.has(row.operationalGroup)) {
          options.set(row.operationalGroup, code);
        }
      }
    });
    return Array.from(options.entries()).map(([name, code]) => ({ name, code }));
  }, [operationalGroups, rows]);

  // Dropdown options for inline editing (excludes '-' empty placeholder)
  const categoryDropdownOptions = useMemo(() => {
    const options = new Set<string>();
    rows.forEach(row => {
      if (row.category?.trim()) {
        options.add(row.category.trim());
      }
    });
    return Array.from(options).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const accountTypeDropdownOptions = useMemo(() => {
    const options = new Set<string>();
    rows.forEach(row => {
      if (row.accountType?.trim()) {
        options.add(row.accountType.trim());
      }
    });
    return Array.from(options).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const subCategoryDropdownOptions = useMemo(() => {
    const options = new Set<string>();
    rows.forEach(row => {
      if (row.subCategory?.trim()) {
        options.add(row.subCategory.trim());
      }
    });
    return Array.from(options).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  useEffect(() => {
    setLaborGroupFilter(previous => {
      if (previous === null) {
        return previous;
      }
      const filtered = previous.filter(option => laborGroupOptions.includes(option));
      if (filtered.length === laborGroupOptions.length) {
        return null;
      }
      return areSelectionsEqual(previous, filtered) ? previous : filtered;
    });
  }, [laborGroupOptions]);

  useEffect(() => {
    setOperationalGroupFilter(previous => {
      if (previous === null) {
        return previous;
      }
      const filtered = previous.filter(option =>
        operationalGroupOptions.includes(option),
      );
      if (filtered.length === operationalGroupOptions.length) {
        return null;
      }
      return areSelectionsEqual(previous, filtered) ? previous : filtered;
    });
  }, [operationalGroupOptions]);

  useEffect(() => {
    setCategoryFilter(previous => {
      if (previous === null) {
        return previous;
      }
      const filtered = previous.filter(option => categoryOptions.includes(option));
      if (filtered.length === categoryOptions.length) {
        return null;
      }
      return areSelectionsEqual(previous, filtered) ? previous : filtered;
    });
  }, [categoryOptions]);

  useEffect(() => {
    setAccountTypeFilter(previous => {
      if (previous === null) {
        return previous;
      }
      const filtered = previous.filter(option => accountTypeOptions.includes(option));
      if (filtered.length === accountTypeOptions.length) {
        return null;
      }
      return areSelectionsEqual(previous, filtered) ? previous : filtered;
    });
  }, [accountTypeOptions]);

  useEffect(() => {
    setSubCategoryFilter(previous => {
      if (previous === null) {
        return previous;
      }
      const filtered = previous.filter(option => subCategoryOptions.includes(option));
      if (filtered.length === subCategoryOptions.length) {
        return null;
      }
      return areSelectionsEqual(previous, filtered) ? previous : filtered;
    });
  }, [subCategoryOptions]);

  useEffect(() => {
    const selectAll = laborGroupSelectAllRef.current;
    if (!selectAll) {
      return;
    }
    if (laborGroupFilter === null) {
      selectAll.indeterminate = false;
      return;
    }
    selectAll.indeterminate =
      laborGroupFilter.length > 0 && laborGroupFilter.length < laborGroupOptions.length;
  }, [laborGroupFilter, laborGroupOptions]);

  useEffect(() => {
    const selectAll = operationalGroupSelectAllRef.current;
    if (!selectAll) {
      return;
    }
    if (operationalGroupFilter === null) {
      selectAll.indeterminate = false;
      return;
    }
    selectAll.indeterminate =
      operationalGroupFilter.length > 0 &&
      operationalGroupFilter.length < operationalGroupOptions.length;
  }, [operationalGroupFilter, operationalGroupOptions]);

  useEffect(() => {
    const selectAll = categorySelectAllRef.current;
    if (!selectAll) {
      return;
    }
    if (categoryFilter === null) {
      selectAll.indeterminate = false;
      return;
    }
    selectAll.indeterminate =
      categoryFilter.length > 0 && categoryFilter.length < categoryOptions.length;
  }, [categoryFilter, categoryOptions]);

  useEffect(() => {
    const selectAll = accountTypeSelectAllRef.current;
    if (!selectAll) {
      return;
    }
    if (accountTypeFilter === null) {
      selectAll.indeterminate = false;
      return;
    }
    selectAll.indeterminate =
      accountTypeFilter.length > 0 && accountTypeFilter.length < accountTypeOptions.length;
  }, [accountTypeFilter, accountTypeOptions]);

  useEffect(() => {
    const selectAll = subCategorySelectAllRef.current;
    if (!selectAll) {
      return;
    }
    if (subCategoryFilter === null) {
      selectAll.indeterminate = false;
      return;
    }
    selectAll.indeterminate =
      subCategoryFilter.length > 0 && subCategoryFilter.length < subCategoryOptions.length;
  }, [subCategoryFilter, subCategoryOptions]);

  useEffect(() => {
    if (!openFilter) {
      return;
    }

    const handleClickOutside = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }
      if (laborGroupMenuRef.current?.contains(target)) {
        return;
      }
      if (operationalGroupMenuRef.current?.contains(target)) {
        return;
      }
      if (categoryMenuRef.current?.contains(target)) {
        return;
      }
      if (accountTypeMenuRef.current?.contains(target)) {
        return;
      }
      if (subCategoryMenuRef.current?.contains(target)) {
        return;
      }
      if (target.closest('[data-filter-button]')) {
        return;
      }
      setOpenFilter(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenFilter(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openFilter]);

  useEffect(() => {
    scrollPageToTop({ behavior: 'auto' });
    const scrollContainer = document.getElementById('app-scroll-container');
    if (!scrollContainer) {
      return undefined;
    }

    scrollContainer.classList.add('app-scroll-locked');

    return () => {
      scrollContainer.classList.remove('app-scroll-locked');
    };
  }, []);

  useEffect(() => {
    loadIndustries();
  }, [loadIndustries]);

  useEffect(() => {
    let isMounted = true;
    const loadCurrentUser = async () => {
      try {
        const appUser = await getCurrentAppUser(user?.email);
        if (isMounted) {
          setCurrentAppUserRole(appUser?.role ?? null);
          setIsCheckingAccess(false);
        }
      } catch {
        if (isMounted) {
          setCurrentAppUserRole(null);
          setIsCheckingAccess(false);
        }
      }
    };

    loadCurrentUser();
    return () => {
      isMounted = false;
    };
  }, [user?.email]);

  // Auto-select first industry when industries are loaded and none is selected
  useEffect(() => {
    if (!industriesLoading && industries.length > 0 && !selectedIndustry) {
      selectIndustry(industries[0]);
    }
  }, [industries, industriesLoading, selectedIndustry, selectIndustry]);

  // Exit edit mode when navigating away from the page
  useEffect(() => {
    return () => {
      setEditMode(false);
    };
  }, [setEditMode]);

  const handleIndustryImport = async (payload: { name: string; file: File }) => {
    const trimmed = payload.name.trim();
    if (!trimmed) {
      throw new Error('Industry name is required.');
    }

    let resolvedName = trimmed;
    try {
      resolvedName = await createIndustryService(trimmed);
    } catch (error) {
      if (!(error instanceof IndustryAlreadyExistsError)) {
        throw error;
      }
    }

    await importIndustryCoaFile(resolvedName, payload.file);
    await loadIndustries();
    await selectIndustry(resolvedName);
  };

  const handleRowCostTypeChange = (rowId: string, costType: CostType) => {
    const hasBatchSelection =
      selectedRowIds.has(rowId) && selectedRowIds.size > 1;
    if (hasBatchSelection) {
      updateBatchCostType(Array.from(selectedRowIds), costType);
      clearRowSelection();
      return;
    }
    updateRowCostType(rowId, costType);
  };

  const handleRowIsFinancialChange = (rowId: string, value: FlagValue) => {
    const isFinancial = parseFlagValue(value);
    const hasBatchSelection =
      selectedRowIds.has(rowId) && selectedRowIds.size > 1;
    if (hasBatchSelection) {
      updateBatchIsFinancial(Array.from(selectedRowIds), isFinancial);
      clearRowSelection();
      return;
    }
    updateRowIsFinancial(rowId, isFinancial);
  };

  const handleRowIsSurveyChange = (rowId: string, value: FlagValue) => {
    const isSurvey = parseFlagValue(value);
    const hasBatchSelection =
      selectedRowIds.has(rowId) && selectedRowIds.size > 1;
    if (hasBatchSelection) {
      updateBatchIsSurvey(Array.from(selectedRowIds), isSurvey);
      clearRowSelection();
      return;
    }
    updateRowIsSurvey(rowId, isSurvey);
  };

  const handleCreateAccounts = async (payload: CoaManagerAccountCreateInput[]) => {
    if (!selectedIndustry) {
      throw new Error('Select an industry to add accounts.');
    }
    if (payload.length === 0) {
      throw new Error('No accounts were generated to add.');
    }
    await createIndustryAccounts(selectedIndustry, payload);
    await refreshIndustryData();
  };

  // ============================================================================
  // Inline Edit Handlers
  // ============================================================================

  const handleCoreAccountSave = useCallback(
    async (rowId: string, currentAccountNumber: string, newCore: string) => {
      const parts = currentAccountNumber.split('-');
      const currentCore = parts[0] ?? '';

      if (newCore === currentCore) {
        return;
      }

      // Build new full account number for validation
      const newAccountNumber =
        parts.length === 3 ? `${newCore}-${parts[1]}-${parts[2]}` : newCore;

      const validation = await validateField(rowId, 'accountNumber', newAccountNumber);
      if (!validation.valid) {
        return;
      }

      await updateAccountField(rowId, { coreAccount: newCore });
    },
    [validateField, updateAccountField],
  );

  const handleAccountNameSave = useCallback(
    async (rowId: string, currentName: string, newName: string) => {
      if (newName === currentName) {
        return;
      }

      const validation = await validateField(rowId, 'accountName', newName);
      if (!validation.valid) {
        return;
      }

      await updateAccountField(rowId, { accountName: newName });
    },
    [validateField, updateAccountField],
  );

  const handleLaborGroupChange = async (
    rowId: string,
    currentAccountNumber: string,
    newLaborGroup: string,
  ) => {
    const groupInfo = laborGroupDropdownOptions.find(g => g.name === newLaborGroup);
    if (!groupInfo) {
      return;
    }

    const parts = currentAccountNumber.split('-');
    if (parts.length !== 3) {
      return;
    }

    // Build new account number with new labor group code
    const newAccountNumber = `${parts[0]}-${parts[1]}-${groupInfo.code.padStart(3, '0')}`;

    const validation = await validateField(rowId, 'accountNumber', newAccountNumber);
    if (!validation.valid) {
      return;
    }

    await updateAccountField(rowId, {
      laborGroup: newLaborGroup,
      laborGroupCode: groupInfo.code,
    });
  };

  const handleOperationalGroupChange = async (
    rowId: string,
    currentAccountNumber: string,
    newOpGroup: string,
  ) => {
    const groupInfo = operationalGroupDropdownOptions.find(g => g.name === newOpGroup);
    if (!groupInfo) {
      return;
    }

    const parts = currentAccountNumber.split('-');
    if (parts.length !== 3) {
      return;
    }

    // Build new account number with new operational group code
    const newAccountNumber = `${parts[0]}-${groupInfo.code.padStart(3, '0')}-${parts[2]}`;

    const validation = await validateField(rowId, 'accountNumber', newAccountNumber);
    if (!validation.valid) {
      return;
    }

    await updateAccountField(rowId, {
      operationalGroup: newOpGroup,
      operationalGroupCode: groupInfo.code,
    });
  };

  const handleCategoryChange = async (rowId: string, newCategory: string) => {
    await updateAccountField(rowId, { category: newCategory });
  };

  const handleAccountTypeChange = async (rowId: string, newAccountType: string) => {
    await updateAccountField(rowId, { accountType: newAccountType });
  };

  const handleSubCategoryChange = async (rowId: string, newSubCategory: string) => {
    await updateAccountField(rowId, { subCategory: newSubCategory });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModalRow) {
      return;
    }
    await deleteAccount(deleteModalRow.accountNumber);
    setDeleteModalRow(null);
  };

  const handleSort = (key: SortKey) => {
    setSortConfig(previous => {
      if (previous?.key === key) {
        const nextDirection: SortDirection = previous.direction === 'asc' ? 'desc' : 'asc';
        return { key, direction: nextDirection };
      }
      return { key, direction: 'asc' };
    });
  };

  const getAriaSort = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) {
      return 'none';
    }
    return sortConfig.direction === 'asc' ? 'ascending' : 'descending';
  };

  const handleLaborGroupSelectAllChange = (checked: boolean) => {
    setLaborGroupFilter(checked ? null : []);
  };

  const handleLaborGroupValueToggle = (value: string, checked: boolean) => {
    setLaborGroupFilter(previous => {
      const current = previous ?? null;
      const baseSelection = current === null ? laborGroupOptions : current;
      const nextSelection = checked
        ? Array.from(new Set([...baseSelection, value]))
        : baseSelection.filter(option => option !== value);

      if (nextSelection.length === laborGroupOptions.length) {
        return null;
      }

      return nextSelection;
    });
  };

  const handleOperationalGroupSelectAllChange = (checked: boolean) => {
    setOperationalGroupFilter(checked ? null : []);
  };

  const handleOperationalGroupValueToggle = (value: string, checked: boolean) => {
    setOperationalGroupFilter(previous => {
      const current = previous ?? null;
      const baseSelection = current === null ? operationalGroupOptions : current;
      const nextSelection = checked
        ? Array.from(new Set([...baseSelection, value]))
        : baseSelection.filter(option => option !== value);

      if (nextSelection.length === operationalGroupOptions.length) {
        return null;
      }

      return nextSelection;
    });
  };

  const handleCategorySelectAllChange = (checked: boolean) => {
    setCategoryFilter(checked ? null : []);
  };

  const handleCategoryValueToggle = (value: string, checked: boolean) => {
    setCategoryFilter(previous => {
      const current = previous ?? null;
      const baseSelection = current === null ? categoryOptions : current;
      const nextSelection = checked
        ? Array.from(new Set([...baseSelection, value]))
        : baseSelection.filter(option => option !== value);

      if (nextSelection.length === categoryOptions.length) {
        return null;
      }

      return nextSelection;
    });
  };

  const handleAccountTypeSelectAllChange = (checked: boolean) => {
    setAccountTypeFilter(checked ? null : []);
  };

  const handleAccountTypeValueToggle = (value: string, checked: boolean) => {
    setAccountTypeFilter(previous => {
      const current = previous ?? null;
      const baseSelection = current === null ? accountTypeOptions : current;
      const nextSelection = checked
        ? Array.from(new Set([...baseSelection, value]))
        : baseSelection.filter(option => option !== value);

      if (nextSelection.length === accountTypeOptions.length) {
        return null;
      }

      return nextSelection;
    });
  };

  const handleSubCategorySelectAllChange = (checked: boolean) => {
    setSubCategoryFilter(checked ? null : []);
  };

  const handleSubCategoryValueToggle = (value: string, checked: boolean) => {
    setSubCategoryFilter(previous => {
      const current = previous ?? null;
      const baseSelection = current === null ? subCategoryOptions : current;
      const nextSelection = checked
        ? Array.from(new Set([...baseSelection, value]))
        : baseSelection.filter(option => option !== value);

      if (nextSelection.length === subCategoryOptions.length) {
        return null;
      }

      return nextSelection;
    });
  };

  const filteredRows = useMemo(() => {
    const laborSelected = laborGroupFilter ? new Set(laborGroupFilter) : null;
    const operationalSelected = operationalGroupFilter
      ? new Set(operationalGroupFilter)
      : null;
    const categorySelected = categoryFilter ? new Set(categoryFilter) : null;
    const accountTypeSelected = accountTypeFilter ? new Set(accountTypeFilter) : null;
    const subCategorySelected = subCategoryFilter ? new Set(subCategoryFilter) : null;
    const searchLower = searchQuery.trim().toLowerCase();

    return rows.filter(row => {
      const laborValue = resolveGroupValue(row.laborGroup);
      const operationalValue = resolveGroupValue(row.operationalGroup);
      const categoryValue = row.category?.trim() || '-';
      const accountTypeValue = row.accountType?.trim() || '-';
      const subCategoryValue = row.subCategory?.trim() || '-';

      const laborMatch = !laborSelected || laborSelected.has(laborValue);
      const operationalMatch =
        !operationalSelected || operationalSelected.has(operationalValue);
      const categoryMatch = !categorySelected || categorySelected.has(categoryValue);
      const accountTypeMatch =
        !accountTypeSelected || accountTypeSelected.has(accountTypeValue);
      const subCategoryMatch =
        !subCategorySelected || subCategorySelected.has(subCategoryValue);

      // Search filter - search across multiple fields
      let searchMatch = true;
      if (searchLower) {
        searchMatch =
          row.accountNumber.toLowerCase().includes(searchLower) ||
          row.accountName.toLowerCase().includes(searchLower) ||
          laborValue.toLowerCase().includes(searchLower) ||
          operationalValue.toLowerCase().includes(searchLower) ||
          categoryValue.toLowerCase().includes(searchLower) ||
          accountTypeValue.toLowerCase().includes(searchLower) ||
          subCategoryValue.toLowerCase().includes(searchLower) ||
          (row.costType?.toLowerCase().includes(searchLower) ?? false);
      }

      return (
        laborMatch &&
        operationalMatch &&
        categoryMatch &&
        accountTypeMatch &&
        subCategoryMatch &&
        searchMatch
      );
    });
  }, [
    laborGroupFilter,
    operationalGroupFilter,
    categoryFilter,
    accountTypeFilter,
    subCategoryFilter,
    searchQuery,
    rows,
  ]);

  const sortedRows = useMemo(() => {
    if (!sortConfig) {
      return filteredRows;
    }
    const multiplier = sortConfig.direction === 'asc' ? 1 : -1;
    return [...filteredRows].sort((a, b) => {
      const getValue = (row: typeof rows[number], key: SortKey): string | number => {
        switch (key) {
          case 'accountNumber':
            return row.accountNumber;
          case 'accountName':
            return row.accountName;
          case 'laborGroup':
            return resolveGroupValue(row.laborGroup);
          case 'operationalGroup':
            return resolveGroupValue(row.operationalGroup);
          case 'category':
            return row.category;
          case 'accountType':
            return row.accountType;
          case 'subCategory':
            return row.subCategory;
          case 'costType':
            return row.costType;
          case 'isFinancial':
            return row.isFinancial === null ? -1 : row.isFinancial ? 1 : 0;
          case 'isSurvey':
            return row.isSurvey === null ? -1 : row.isSurvey ? 1 : 0;
          default:
            return '';
        }
      };
      const valueA = getValue(a, sortConfig.key);
      const valueB = getValue(b, sortConfig.key);
      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return (valueA - valueB) * multiplier;
      }
      return (
        valueA
          .toString()
          .localeCompare(valueB.toString(), undefined, { numeric: true, sensitivity: 'base' }) *
        multiplier
      );
    });
  }, [filteredRows, sortConfig]);

  const selectedCount = selectedRowIds.size;
  // Check if all filtered/sorted rows are selected
  const filteredRowIds = useMemo(() => sortedRows.map(row => row.id), [sortedRows]);
  const isAllFilteredSelected = useMemo(() => {
    if (sortedRows.length === 0) return false;
    return filteredRowIds.every(id => selectedRowIds.has(id));
  }, [filteredRowIds, selectedRowIds, sortedRows.length]);

  const handleToggleSelectAll = useCallback(() => {
    if (sortedRows.length === 0) return;
    if (isAllFilteredSelected) {
      // Deselect all filtered rows
      const filteredSet = new Set(filteredRowIds);
      const remaining = Array.from(selectedRowIds).filter(id => !filteredSet.has(id));
      setSelectedRowIds(remaining);
    } else {
      // Select all filtered rows (add to existing selection)
      const combined = new Set([...selectedRowIds, ...filteredRowIds]);
      setSelectedRowIds(Array.from(combined));
    }
  }, [sortedRows.length, isAllFilteredSelected, filteredRowIds, selectedRowIds, setSelectedRowIds]);

  // Check if any filters are active
  const hasActiveFilters =
    laborGroupFilter !== null ||
    operationalGroupFilter !== null ||
    categoryFilter !== null ||
    accountTypeFilter !== null ||
    subCategoryFilter !== null ||
    searchQuery.trim() !== '';

  const handleClearAllFilters = useCallback(() => {
    setLaborGroupFilter(null);
    setOperationalGroupFilter(null);
    setCategoryFilter(null);
    setAccountTypeFilter(null);
    setSubCategoryFilter(null);
    setSearchQuery('');
  }, []);

  const renderSortableHeader = (key: SortKey, label: string, title?: string) => (
    <th
      key={key}
      scope="col"
      aria-sort={getAriaSort(key)}
      className="bg-gray-50 px-4 py-3"
    >
      <button
        type="button"
        onClick={() => handleSort(key)}
        className="flex w-full items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500 transition hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        <span className={title ? 'cursor-help' : undefined} title={title}>
          {label}
        </span>
        <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </th>
  );

  const renderLaborGroupHeader = () => {
    const isFilterActive = laborGroupFilter !== null;
    const isOpen = openFilter === 'laborGroup';
    const filterId = 'labor-group-filter';
    return (
      <th
        scope="col"
        aria-sort={getAriaSort('laborGroup')}
        className="bg-gray-50 px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleSort('laborGroup')}
            className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500 transition hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {resolveLabel('laborGroup', 'LABOR_GROUP')}
            <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <div className="relative flex items-center">
            <button
              type="button"
              data-filter-button="laborGroup"
              aria-label="Filter labor group"
              aria-expanded={isOpen}
              aria-controls={filterId}
              onClick={event => {
                event.stopPropagation();
                setOpenFilter(previous => (previous === 'laborGroup' ? null : 'laborGroup'));
              }}
              className={`rounded p-1 transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                isFilterActive
                  ? 'text-blue-600 hover:text-blue-700'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Filter className="h-4 w-4" aria-hidden="true" />
            </button>
            {isOpen && (
              <div
                ref={laborGroupMenuRef}
                id={filterId}
                role="dialog"
                aria-label="Labor group filters"
                onClick={event => event.stopPropagation()}
                className="absolute left-0 top-full z-20 mt-2 w-56 rounded-md border border-slate-200 bg-white py-2 text-sm shadow-lg dark:border-slate-600 dark:bg-slate-800"
              >
                <div className="border-b border-slate-100 px-3 pb-2 text-xs font-semibold uppercase text-slate-500 dark:border-slate-600 dark:text-slate-400">
                  Filter values
                </div>
                {laborGroupOptions.length > 0 ? (
                  <div className="space-y-2 px-3 pt-2">
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                      <input
                        ref={laborGroupSelectAllRef}
                        type="checkbox"
                        checked={laborGroupFilter === null}
                        onChange={event =>
                          handleLaborGroupSelectAllChange(event.target.checked)
                        }
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-500 dark:bg-slate-700"
                      />
                      Select all
                    </label>
                    <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
                      {laborGroupOptions.map(option => {
                        const isChecked =
                          laborGroupFilter === null || laborGroupFilter.includes(option);
                        return (
                          <label
                            key={option}
                            className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={event =>
                                handleLaborGroupValueToggle(option, event.target.checked)
                              }
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-500 dark:bg-slate-700"
                            />
                            {option}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="px-3 pt-2 text-xs text-slate-500 dark:text-slate-400">
                    No labor group values.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </th>
    );
  };

  const renderOperationalGroupHeader = () => {
    const isFilterActive = operationalGroupFilter !== null;
    const isOpen = openFilter === 'operationalGroup';
    const filterId = 'operational-group-filter';
    return (
      <th
        scope="col"
        aria-sort={getAriaSort('operationalGroup')}
        className="bg-gray-50 px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleSort('operationalGroup')}
            className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500 transition hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {resolveLabel('operationalGroup', 'OPERATIONAL_GROUP')}
            <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <div className="relative flex items-center">
            <button
              type="button"
              data-filter-button="operationalGroup"
              aria-label="Filter operational group"
              aria-expanded={isOpen}
              aria-controls={filterId}
              onClick={event => {
                event.stopPropagation();
                setOpenFilter(previous =>
                  previous === 'operationalGroup' ? null : 'operationalGroup',
                );
              }}
              className={`rounded p-1 transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                isFilterActive
                  ? 'text-blue-600 hover:text-blue-700'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Filter className="h-4 w-4" aria-hidden="true" />
            </button>
            {isOpen && (
              <div
                ref={operationalGroupMenuRef}
                id={filterId}
                role="dialog"
                aria-label="Operational group filters"
                onClick={event => event.stopPropagation()}
                className="absolute left-0 top-full z-20 mt-2 w-56 rounded-md border border-slate-200 bg-white py-2 text-sm shadow-lg dark:border-slate-600 dark:bg-slate-800"
              >
                <div className="border-b border-slate-100 px-3 pb-2 text-xs font-semibold uppercase text-slate-500 dark:border-slate-600 dark:text-slate-400">
                  Filter values
                </div>
                {operationalGroupOptions.length > 0 ? (
                  <div className="space-y-2 px-3 pt-2">
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                      <input
                        ref={operationalGroupSelectAllRef}
                        type="checkbox"
                        checked={operationalGroupFilter === null}
                        onChange={event =>
                          handleOperationalGroupSelectAllChange(event.target.checked)
                        }
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-500 dark:bg-slate-700"
                      />
                      Select all
                    </label>
                    <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
                      {operationalGroupOptions.map(option => {
                        const isChecked =
                          operationalGroupFilter === null ||
                          operationalGroupFilter.includes(option);
                        return (
                          <label
                            key={option}
                            className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={event =>
                                handleOperationalGroupValueToggle(
                                  option,
                                  event.target.checked,
                                )
                              }
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-500 dark:bg-slate-700"
                            />
                            {option}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="px-3 pt-2 text-xs text-slate-500 dark:text-slate-400">
                    No operational group values.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </th>
    );
  };

  const renderCategoryHeader = () => {
    const isFilterActive = categoryFilter !== null;
    const isOpen = openFilter === 'category';
    const filterId = 'category-filter';
    return (
      <th
        scope="col"
        aria-sort={getAriaSort('category')}
        className="bg-gray-50 px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleSort('category')}
            className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500 transition hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {resolveLabel('category', 'Category')}
            <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <div className="relative flex items-center">
            <button
              type="button"
              data-filter-button="category"
              aria-label="Filter category"
              aria-expanded={isOpen}
              aria-controls={filterId}
              onClick={event => {
                event.stopPropagation();
                setOpenFilter(previous => (previous === 'category' ? null : 'category'));
              }}
              className={`rounded p-1 transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                isFilterActive
                  ? 'text-blue-600 hover:text-blue-700'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Filter className="h-4 w-4" aria-hidden="true" />
            </button>
            {isOpen && (
              <div
                ref={categoryMenuRef}
                id={filterId}
                role="dialog"
                aria-label="Category filters"
                onClick={event => event.stopPropagation()}
                className="absolute left-0 top-full z-20 mt-2 w-56 rounded-md border border-slate-200 bg-white py-2 text-sm shadow-lg dark:border-slate-600 dark:bg-slate-800"
              >
                <div className="border-b border-slate-100 px-3 pb-2 text-xs font-semibold uppercase text-slate-500 dark:border-slate-600 dark:text-slate-400">
                  Filter values
                </div>
                {categoryOptions.length > 0 ? (
                  <div className="space-y-2 px-3 pt-2">
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                      <input
                        ref={categorySelectAllRef}
                        type="checkbox"
                        checked={categoryFilter === null}
                        onChange={event =>
                          handleCategorySelectAllChange(event.target.checked)
                        }
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-500 dark:bg-slate-700"
                      />
                      Select all
                    </label>
                    <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
                      {categoryOptions.map(option => {
                        const isChecked =
                          categoryFilter === null || categoryFilter.includes(option);
                        return (
                          <label
                            key={option}
                            className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={event =>
                                handleCategoryValueToggle(option, event.target.checked)
                              }
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-500 dark:bg-slate-700"
                            />
                            {option}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="px-3 pt-2 text-xs text-slate-500 dark:text-slate-400">
                    No category values.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </th>
    );
  };

  const renderAccountTypeHeader = () => {
    const isFilterActive = accountTypeFilter !== null;
    const isOpen = openFilter === 'accountType';
    const filterId = 'account-type-filter';
    return (
      <th
        scope="col"
        aria-sort={getAriaSort('accountType')}
        className="bg-gray-50 px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleSort('accountType')}
            className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500 transition hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {resolveLabel('accountType', 'Account Type')}
            <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <div className="relative flex items-center">
            <button
              type="button"
              data-filter-button="accountType"
              aria-label="Filter account type"
              aria-expanded={isOpen}
              aria-controls={filterId}
              onClick={event => {
                event.stopPropagation();
                setOpenFilter(previous =>
                  previous === 'accountType' ? null : 'accountType',
                );
              }}
              className={`rounded p-1 transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                isFilterActive
                  ? 'text-blue-600 hover:text-blue-700'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Filter className="h-4 w-4" aria-hidden="true" />
            </button>
            {isOpen && (
              <div
                ref={accountTypeMenuRef}
                id={filterId}
                role="dialog"
                aria-label="Account type filters"
                onClick={event => event.stopPropagation()}
                className="absolute left-0 top-full z-20 mt-2 w-56 rounded-md border border-slate-200 bg-white py-2 text-sm shadow-lg dark:border-slate-600 dark:bg-slate-800"
              >
                <div className="border-b border-slate-100 px-3 pb-2 text-xs font-semibold uppercase text-slate-500 dark:border-slate-600 dark:text-slate-400">
                  Filter values
                </div>
                {accountTypeOptions.length > 0 ? (
                  <div className="space-y-2 px-3 pt-2">
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                      <input
                        ref={accountTypeSelectAllRef}
                        type="checkbox"
                        checked={accountTypeFilter === null}
                        onChange={event =>
                          handleAccountTypeSelectAllChange(event.target.checked)
                        }
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-500 dark:bg-slate-700"
                      />
                      Select all
                    </label>
                    <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
                      {accountTypeOptions.map(option => {
                        const isChecked =
                          accountTypeFilter === null || accountTypeFilter.includes(option);
                        return (
                          <label
                            key={option}
                            className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={event =>
                                handleAccountTypeValueToggle(option, event.target.checked)
                              }
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-500 dark:bg-slate-700"
                            />
                            {option}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="px-3 pt-2 text-xs text-slate-500 dark:text-slate-400">
                    No account type values.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </th>
    );
  };

  const renderSubCategoryHeader = () => {
    const isFilterActive = subCategoryFilter !== null;
    const isOpen = openFilter === 'subCategory';
    const filterId = 'sub-category-filter';
    return (
      <th
        scope="col"
        aria-sort={getAriaSort('subCategory')}
        className="bg-gray-50 px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleSort('subCategory')}
            className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500 transition hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {resolveLabel('subCategory', 'SUB_CATEGORY')}
            <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <div className="relative flex items-center">
            <button
              type="button"
              data-filter-button="subCategory"
              aria-label="Filter sub category"
              aria-expanded={isOpen}
              aria-controls={filterId}
              onClick={event => {
                event.stopPropagation();
                setOpenFilter(previous =>
                  previous === 'subCategory' ? null : 'subCategory',
                );
              }}
              className={`rounded p-1 transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                isFilterActive
                  ? 'text-blue-600 hover:text-blue-700'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Filter className="h-4 w-4" aria-hidden="true" />
            </button>
            {isOpen && (
              <div
                ref={subCategoryMenuRef}
                id={filterId}
                role="dialog"
                aria-label="Sub category filters"
                onClick={event => event.stopPropagation()}
                className="absolute left-0 top-full z-20 mt-2 w-56 rounded-md border border-slate-200 bg-white py-2 text-sm shadow-lg dark:border-slate-600 dark:bg-slate-800"
              >
                <div className="border-b border-slate-100 px-3 pb-2 text-xs font-semibold uppercase text-slate-500 dark:border-slate-600 dark:text-slate-400">
                  Filter values
                </div>
                {subCategoryOptions.length > 0 ? (
                  <div className="space-y-2 px-3 pt-2">
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                      <input
                        ref={subCategorySelectAllRef}
                        type="checkbox"
                        checked={subCategoryFilter === null}
                        onChange={event =>
                          handleSubCategorySelectAllChange(event.target.checked)
                        }
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-500 dark:bg-slate-700"
                      />
                      Select all
                    </label>
                    <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
                      {subCategoryOptions.map(option => {
                        const isChecked =
                          subCategoryFilter === null || subCategoryFilter.includes(option);
                        return (
                          <label
                            key={option}
                            className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={event =>
                                handleSubCategoryValueToggle(option, event.target.checked)
                              }
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-500 dark:bg-slate-700"
                            />
                            {option}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="px-3 pt-2 text-xs text-slate-500 dark:text-slate-400">
                    No sub category values.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </th>
    );
  };

  if (isCheckingAccess) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Checking access...</p>
        </div>
      </div>
    );
  }

  if (currentAppUserRole !== 'super') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
            Access Denied
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            You don't have permission to access this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
          Chart of Accounts
        </p>
        <h1 className="text-2xl font-semibold text-gray-900">COA Manager</h1>
        <p className="text-sm text-gray-600">
          Manage chart of accounts by industry and update financial flags and cost type classifications.
        </p>
      </header>

      <section aria-labelledby="industry-heading" className="space-y-4">
        <div className="rounded-lg bg-white p-4 shadow">
          <h2 id="industry-heading" className="sr-only">
            Industry selection
          </h2>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <label htmlFor="industry" className="text-sm font-medium text-gray-700">
                Select industry:
              </label>
              <select
                id="industry"
                value={selectedIndustry}
                onChange={event => {
                  selectIndustry(event.target.value);
                }}
                disabled={industriesLoading}
                className="w-full rounded-md border border-gray-300 mx-4 px-3 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:w-72"
              >
                <option value="">Choose an industry</option>
                {industries.map(industry => (
                  <option key={industry} value={industry}>
                    {industry}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500">
                Select an industry to load its chart of accounts.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              <p className="text-sm text-gray-600">Need a new industry?</p>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(true)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <Plus className="h-4 w-4" />
                <span className="whitespace-nowrap">Add Industry</span>
              </button>
            </div>
          </div>
        </div>
        {industriesError ? (
          <p className="text-sm text-red-600">{industriesError}</p>
        ) : null}
      </section>

      {selectedIndustry ? (
        <section
          aria-label="Chart of accounts table"
          className="flex min-h-0 flex-1 flex-col gap-4"
        >
          <div className="flex flex-col gap-3 rounded-lg bg-white p-4 shadow md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-gray-900">
                {selectedIndustry} Chart of Accounts
              </h2>
              <p className="text-sm text-gray-600">
                {selectedCount} row{selectedCount === 1 ? '' : 's'} selected
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Edit Mode Toggle */}
              <button
                type="button"
                onClick={() => setEditMode(!isEditMode)}
                disabled={rowsLoading}
                className={`inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                  isEditMode
                    ? 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-gray-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
                    : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-gray-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {isEditMode ? (
                  <>
                    <X className="h-4 w-4" />
                    <span className="whitespace-nowrap">Exit Edit Mode</span>
                  </>
                ) : (
                  <>
                    <Pencil className="h-4 w-4" />
                    <span className="whitespace-nowrap">Edit Mode</span>
                  </>
                )}
              </button>

              {/* Undo All Button (only visible in edit mode with changes) */}
              {isEditMode && hasAnyUndoableChanges() && (
                <button
                  type="button"
                  onClick={undoAllChanges}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 text-sm font-medium text-gray-600 shadow-sm transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                >
                  <Undo2 className="h-4 w-4" />
                  <span className="whitespace-nowrap">Undo All Changes</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsAddAccountsModalOpen(true)}
                disabled={rowsLoading}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                <span className="whitespace-nowrap">Add Accounts</span>
              </button>
            </div>
          </div>

          {/* Edit Mode Indicator */}
          {isEditMode && (
            <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
              <span className="font-medium">Edit Mode Active:</span> Click on cells to edit. Changes
              are saved automatically. Use the undo buttons to revert changes made during this
              session.
            </div>
          )}

          {/* Search Input and Clear Filters */}
          <div className="flex items-center gap-3">
            <div className="relative max-w-md">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="h-4 w-4 text-gray-400 dark:text-gray-500" aria-hidden="true" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search accounts..."
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-10 text-sm text-gray-900 placeholder-gray-500 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
              >
                <X className="h-4 w-4" aria-hidden="true" />
                Clear all filters
              </button>
            )}
          </div>

          {rowsLoading ? (
            <div className="flex items-center gap-2 rounded-lg border border-dashed border-gray-200 bg-white p-6 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              Loading COA rows…
            </div>
          ) : rowsError ? (
            <div className="rounded-lg border border-dashed border-red-200 bg-red-50 p-6 text-sm text-red-700">
              {rowsError}
            </div>
          ) : (
            <div className="table-scroll-panel flex min-h-0 flex-1 flex-col overflow-x-auto rounded-lg border border-gray-200 bg-white shadow">
              <table className="min-w-full table-compact divide-y divide-slate-200 text-left text-sm dark:divide-slate-700">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="bg-gray-50 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isAllFilteredSelected}
                          onChange={handleToggleSelectAll}
                          aria-label="Select all filtered rows"
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Select
                        </span>
                      </div>
                    </th>
                    {renderSortableHeader(
                      'accountNumber',
                      resolveLabel('accountNumber', 'Account'),
                    )}
                    {renderSortableHeader(
                      'accountName',
                      resolveLabel('accountName', 'Description'),
                    )}
                    {renderLaborGroupHeader()}
                    {renderOperationalGroupHeader()}
                    {renderCategoryHeader()}
                    {renderAccountTypeHeader()}
                    {renderSubCategoryHeader()}
                    {renderSortableHeader(
                      'isFinancial',
                      resolveLabel('isFinancial', 'IS_FINANCIAL'),
                      isFinancialTooltip,
                    )}
                    {renderSortableHeader(
                      'isSurvey',
                      resolveLabel('isSurvey', 'IS_SURVEY'),
                      isSurveyTooltip,
                    )}
                    {renderSortableHeader('costType', resolveLabel('costType', 'COST_TYPE'))}
                    {/* Status indicator column header */}
                    <th scope="col" className="w-8 bg-gray-50 px-2 py-3 dark:bg-gray-800">
                      <span className="sr-only">Status</span>
                    </th>
                    {isEditMode && (
                      <th scope="col" className="bg-gray-50 px-4 py-3 dark:bg-gray-800">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          Actions
                        </span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {sortedRows.map(row => {
                    const status = rowStatus[row.id] ?? { state: 'idle' };
                    const validationError = rowValidationErrors[row.id];
                    const hasUndo = hasUndoableChanges(row.id);

                    return (
                      <tr
                        key={row.id}
                        className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${hasUndo ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedRowIds.has(row.id)}
                            onChange={() => toggleRowSelection(row.id)}
                            aria-label={`Select account ${row.accountNumber}`}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        {/* Account Number (Core Account only editable) */}
                        <td className="px-4 py-3">
                          {isEditMode ? (
                            <EditableCoreAccountCell
                              accountNumber={row.accountNumber}
                              onSave={newCore =>
                                handleCoreAccountSave(row.id, row.accountNumber, newCore)
                              }
                              validationError={
                                validationError?.field === 'accountNumber'
                                  ? validationError.message
                                  : null
                              }
                            />
                          ) : (
                            <span className="font-medium text-gray-900 dark:text-white">
                              {row.accountNumber}
                            </span>
                          )}
                        </td>
                        {/* Account Name */}
                        <td className="px-4 py-3">
                          {isEditMode ? (
                            <EditableTextCell
                              value={row.accountName}
                              onSave={newName =>
                                handleAccountNameSave(row.id, row.accountName, newName)
                              }
                              formatOnBlur={toProperCase}
                              className="w-full min-w-[200px] rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                              validationError={
                                validationError?.field === 'accountName'
                                  ? validationError.message
                                  : null
                              }
                            />
                          ) : (
                            <span className="text-gray-700 dark:text-gray-300">
                              {row.accountName}
                            </span>
                          )}
                        </td>
                        {/* Labor Group */}
                        <td className="px-4 py-3">
                          {isEditMode ? (
                            <select
                              value={row.laborGroup ?? ''}
                              onChange={e =>
                                handleLaborGroupChange(
                                  row.id,
                                  row.accountNumber,
                                  e.target.value,
                                )
                              }
                              className="w-full min-w-[120px] rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              <option value="">-</option>
                              {laborGroupDropdownOptions.map(opt => (
                                <option key={opt.name} value={opt.name}>
                                  {opt.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-gray-700">
                              {resolveGroupValue(row.laborGroup)}
                            </span>
                          )}
                        </td>
                        {/* Operational Group */}
                        <td className="px-4 py-3">
                          {isEditMode ? (
                            <select
                              value={row.operationalGroup ?? ''}
                              onChange={e =>
                                handleOperationalGroupChange(
                                  row.id,
                                  row.accountNumber,
                                  e.target.value,
                                )
                              }
                              className="w-full min-w-[120px] rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              <option value="">-</option>
                              {operationalGroupDropdownOptions.map(opt => (
                                <option key={opt.name} value={opt.name}>
                                  {opt.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-gray-700">
                              {resolveGroupValue(row.operationalGroup)}
                            </span>
                          )}
                        </td>
                        {/* Category */}
                        <td className="px-4 py-3">
                          {isEditMode ? (
                            <select
                              value={row.category ?? ''}
                              onChange={e => handleCategoryChange(row.id, e.target.value)}
                              className="w-full min-w-[100px] rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              <option value="">-</option>
                              {categoryDropdownOptions.map(opt => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-gray-700">{row.category}</span>
                          )}
                        </td>
                        {/* Account Type */}
                        <td className="px-4 py-3">
                          {isEditMode ? (
                            <select
                              value={row.accountType ?? ''}
                              onChange={e => handleAccountTypeChange(row.id, e.target.value)}
                              className="w-full min-w-[100px] rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              <option value="">-</option>
                              {accountTypeDropdownOptions.map(opt => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-gray-700">{row.accountType}</span>
                          )}
                        </td>
                        {/* Sub Category */}
                        <td className="px-4 py-3">
                          {isEditMode ? (
                            <select
                              value={row.subCategory ?? ''}
                              onChange={e => handleSubCategoryChange(row.id, e.target.value)}
                              className="w-full min-w-[100px] rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              <option value="">-</option>
                              {subCategoryDropdownOptions.map(opt => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-gray-700">{row.subCategory}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <label className="sr-only" htmlFor={`is-financial-${row.id}`}>
                            {resolveLabel('isFinancial', 'IS_FINANCIAL')} for account{' '}
                            {row.accountNumber}
                          </label>
                          <select
                            id={`is-financial-${row.id}`}
                            value={formatFlagValue(row.isFinancial)}
                            onChange={event =>
                              handleRowIsFinancialChange(
                                row.id,
                                event.target.value as FlagValue,
                              )
                            }
                            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                          >
                            {flagOptions.map(option => (
                              <option key={option.label} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <label className="sr-only" htmlFor={`is-survey-${row.id}`}>
                            {resolveLabel('isSurvey', 'IS_SURVEY')} for account{' '}
                            {row.accountNumber}
                          </label>
                          <select
                            id={`is-survey-${row.id}`}
                            value={formatFlagValue(row.isSurvey)}
                            onChange={event =>
                              handleRowIsSurveyChange(
                                row.id,
                                event.target.value as FlagValue,
                              )
                            }
                            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                          >
                            {flagOptions.map(option => (
                              <option key={option.label} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <label className="sr-only" htmlFor={`cost-type-${row.id}`}>
                              {resolveLabel('costType', 'COST_TYPE')} for account{' '}
                              {row.accountNumber}
                            </label>
                            <select
                              id={`cost-type-${row.id}`}
                              value={row.costType}
                              onChange={event =>
                                handleRowCostTypeChange(row.id, event.target.value as CostType)
                              }
                              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                            >
                              {costTypeOptions.map(option => (
                                <option key={option.label} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                        {/* Status Indicator Column */}
                        <td className="w-8 px-2 py-3">
                          <div
                            className="flex h-5 w-5 items-center justify-center"
                            role="status"
                            aria-live="polite"
                          >
                            {status.state === 'pending' && (
                              <Loader2
                                className="h-4 w-4 animate-spin text-blue-500"
                                aria-label="Saving changes"
                              />
                            )}
                            {status.state === 'success' && (
                              <CheckCircle2
                                className="h-4 w-4 text-emerald-500"
                                aria-label="Saved"
                              />
                            )}
                            {status.state === 'error' && (
                              <span
                                title={status.message ?? 'Update failed.'}
                                className="cursor-help"
                              >
                                <AlertTriangle
                                  className="h-4 w-4 text-red-500"
                                  aria-label={status.message ?? 'Update failed.'}
                                />
                              </span>
                            )}
                          </div>
                        </td>
                        {/* Actions Column (Undo / Delete) */}
                        {isEditMode && (
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {hasUndo && (
                                <button
                                  type="button"
                                  onClick={() => undoRowChanges(row.id)}
                                  title="Undo changes to this row"
                                  className="rounded p-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                                >
                                  <Undo2 className="h-4 w-4" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  setDeleteModalRow({
                                    id: row.id,
                                    accountNumber: row.accountNumber,
                                    accountName: row.accountName,
                                  })
                                }
                                title="Delete this account"
                                className="rounded p-1 text-red-500 transition hover:bg-red-50 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500">
          Select or add an industry to load chart of accounts details.
        </div>
      )}

      <IndustryImportModal
        open={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSubmit={handleIndustryImport}
      />
      <AddCoaAccountsModal
        open={isAddAccountsModalOpen}
        industry={selectedIndustry}
        rows={rows}
        columns={columns}
        onClose={() => setIsAddAccountsModalOpen(false)}
        onSubmit={handleCreateAccounts}
      />
      {deleteModalRow && (
        <DeleteAccountModal
          accountNumber={deleteModalRow.accountNumber}
          accountName={deleteModalRow.accountName}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteModalRow(null)}
        />
      )}
    </div>
  );
}
