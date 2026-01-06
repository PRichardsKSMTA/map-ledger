import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowUpDown, CheckCircle2, Filter, Loader2, Plus } from 'lucide-react';
import IndustryImportModal from '../components/coa/IndustryImportModal';
import {
  createIndustry as createIndustryService,
  importIndustryCoaFile,
  IndustryAlreadyExistsError,
} from '../services/coaManagerService';
import { useCoaManagerStore } from '../store/coaManagerStore';
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
  | 'subCategory'
  | 'isFinancial'
  | 'isSurvey'
  | 'costType';
type SortDirection = 'asc' | 'desc';
type FilterKey = 'laborGroup' | 'operationalGroup';

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
  const toggleSelectAll = useCoaManagerStore(state => state.toggleSelectAll);
  const clearRowSelection = useCoaManagerStore(state => state.clearRowSelection);
  const updateRowCostType = useCoaManagerStore(state => state.updateRowCostType);
  const updateBatchCostType = useCoaManagerStore(state => state.updateBatchCostType);
  const updateRowIsFinancial = useCoaManagerStore(state => state.updateRowIsFinancial);
  const updateBatchIsFinancial = useCoaManagerStore(state => state.updateBatchIsFinancial);
  const updateRowIsSurvey = useCoaManagerStore(state => state.updateRowIsSurvey);
  const updateBatchIsSurvey = useCoaManagerStore(state => state.updateBatchIsSurvey);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<{
    key: SortKey;
    direction: SortDirection;
  } | null>(null);
  const [laborGroupFilter, setLaborGroupFilter] = useState<string[] | null>(null);
  const [operationalGroupFilter, setOperationalGroupFilter] = useState<string[] | null>(null);
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);
  const laborGroupMenuRef = useRef<HTMLDivElement | null>(null);
  const operationalGroupMenuRef = useRef<HTMLDivElement | null>(null);
  const laborGroupSelectAllRef = useRef<HTMLInputElement | null>(null);
  const operationalGroupSelectAllRef = useRef<HTMLInputElement | null>(null);
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

  const filteredRows = useMemo(() => {
    const laborSelected = laborGroupFilter ? new Set(laborGroupFilter) : null;
    const operationalSelected = operationalGroupFilter
      ? new Set(operationalGroupFilter)
      : null;
    return rows.filter(row => {
      const laborValue = resolveGroupValue(row.laborGroup);
      const operationalValue = resolveGroupValue(row.operationalGroup);
      const laborMatch = !laborSelected || laborSelected.has(laborValue);
      const operationalMatch =
        !operationalSelected || operationalSelected.has(operationalValue);
      return laborMatch && operationalMatch;
    });
  }, [laborGroupFilter, operationalGroupFilter, rows]);

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
  const isAllSelected = rows.length > 0 && selectedCount === rows.length;

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
        className="flex w-full items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500 transition hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
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
            className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500 transition hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
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
              className={`rounded p-1 transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                isFilterActive
                  ? 'text-indigo-600 hover:text-indigo-700'
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
                className="absolute left-0 top-full z-20 mt-2 w-56 rounded-md border border-slate-200 bg-white py-2 text-sm shadow-lg"
              >
                <div className="border-b border-slate-100 px-3 pb-2 text-xs font-semibold uppercase text-slate-500">
                  Filter values
                </div>
                {laborGroupOptions.length > 0 ? (
                  <div className="space-y-2 px-3 pt-2">
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                      <input
                        ref={laborGroupSelectAllRef}
                        type="checkbox"
                        checked={laborGroupFilter === null}
                        onChange={event =>
                          handleLaborGroupSelectAllChange(event.target.checked)
                        }
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
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
                            className="flex items-center gap-2 text-xs text-slate-600"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={event =>
                                handleLaborGroupValueToggle(option, event.target.checked)
                              }
                              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            {option}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="px-3 pt-2 text-xs text-slate-500">
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
            className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500 transition hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
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
              className={`rounded p-1 transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                isFilterActive
                  ? 'text-indigo-600 hover:text-indigo-700'
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
                className="absolute left-0 top-full z-20 mt-2 w-56 rounded-md border border-slate-200 bg-white py-2 text-sm shadow-lg"
              >
                <div className="border-b border-slate-100 px-3 pb-2 text-xs font-semibold uppercase text-slate-500">
                  Filter values
                </div>
                {operationalGroupOptions.length > 0 ? (
                  <div className="space-y-2 px-3 pt-2">
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                      <input
                        ref={operationalGroupSelectAllRef}
                        type="checkbox"
                        checked={operationalGroupFilter === null}
                        onChange={event =>
                          handleOperationalGroupSelectAllChange(event.target.checked)
                        }
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
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
                            className="flex items-center gap-2 text-xs text-slate-600"
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
                              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            {option}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="px-3 pt-2 text-xs text-slate-500">
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
                className="w-full rounded-md border border-gray-300 mx-4 px-3 py-1 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:w-72"
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
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-indigo-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
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
          </div>

          {rowsLoading ? (
            <div className="flex items-center gap-2 rounded-lg border border-dashed border-gray-200 bg-white p-6 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
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
                          checked={isAllSelected}
                          onChange={toggleSelectAll}
                          aria-label="Select all rows"
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
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
                    {renderSortableHeader('category', resolveLabel('category', 'Category'))}
                    {renderSortableHeader(
                      'subCategory',
                      resolveLabel('subCategory', 'SUB_CATEGORY'),
                    )}
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {sortedRows.map(row => {
                    const status = rowStatus[row.id] ?? { state: 'idle' };
                    return (
                      <tr key={row.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedRowIds.has(row.id)}
                            onChange={() => toggleRowSelection(row.id)}
                            aria-label={`Select account ${row.accountNumber}`}
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {row.accountNumber}
                        </td>
                        <td className="px-4 py-3 text-gray-700">{row.accountName}</td>
                        <td className="px-4 py-3 text-gray-700">
                          {resolveGroupValue(row.laborGroup)}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {resolveGroupValue(row.operationalGroup)}
                        </td>
                        <td className="px-4 py-3 text-gray-700">{row.category}</td>
                        <td className="px-4 py-3 text-gray-700">{row.subCategory}</td>
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
                            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
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
                            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                          >
                            {flagOptions.map(option => (
                              <option key={option.label} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
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
                                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                              >
                                {costTypeOptions.map(option => (
                                  <option key={option.label} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            {status.state !== 'idle' && (
                              <div
                                className="ml-auto flex items-center gap-2"
                                role="status"
                                aria-live="polite"
                              >
                                {status.state === 'pending' && (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                                    <span className="text-xs text-gray-500">Saving changes</span>
                                  </>
                                )}
                                {status.state === 'success' && (
                                  <>
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                    <span className="text-xs text-emerald-600">Updated</span>
                                  </>
                                )}
                                {status.state === 'error' && (
                                  <>
                                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                                    <span className="text-xs text-amber-700">
                                      {status.message ?? 'Update failed.'}
                                    </span>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
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
    </div>
  );
}
