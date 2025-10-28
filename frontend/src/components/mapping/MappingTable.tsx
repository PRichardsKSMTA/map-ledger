import { ChangeEvent, Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpDown, Check, ChevronDown, ChevronRight } from 'lucide-react';
import MappingToolbar from './MappingToolbar';
import { useRatioAllocationStore } from '../../store/ratioAllocationStore';
import {
  selectAccounts,
  selectActiveStatuses,
  selectSearchTerm,
  selectSplitValidationIssues,
  useMappingStore,
} from '../../store/mappingStore';
import { useTemplateStore } from '../../store/templateStore';
import { useMappingSelectionStore } from '../../store/mappingSelectionStore';
import type { GLAccountMappingRow } from '../../types';
import MappingSplitRow from './MappingSplitRow';
import { PRESET_OPTIONS } from './presets';

interface MappingTableProps {
  onConfigureAllocation?: (glAccountRawId: string) => void;
}

type SortKey =
  | 'companyName'
  | 'accountId'
  | 'accountName'
  | 'netChange'
  | 'status'
  | 'mappingType'
  | 'targetScoa'
  | 'polarity'
  | 'presetId'
  | 'aiConfidence'
  | 'notes';

type SortDirection = 'asc' | 'desc';

const STATUS_LABELS: Record<GLAccountMappingRow['status'], string> = {
  New: 'New',
  Unmapped: 'Unmapped',
  Mapped: 'Mapped',
  Excluded: 'Excluded',
};

const STATUS_STYLES: Record<GLAccountMappingRow['status'], string> = {
  New: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  Unmapped: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200',
  Mapped: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200',
  Excluded: 'bg-slate-300 text-slate-800 dark:bg-slate-700 dark:text-slate-100',
};

export const STATUS_ORDER: Record<GLAccountMappingRow['status'], number> = {
  New: 0,
  Unmapped: 1,
  Mapped: 2,
  Excluded: 3,
};

const MAPPING_TYPE_LABELS: Record<GLAccountMappingRow['mappingType'], string> = {
  direct: 'Direct',
  percentage: 'Percentage',
  dynamic: 'Dynamic',
  exclude: 'Excluded',
};

const netChangeFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  signDisplay: 'exceptZero',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const formatNetChange = (value: number) => netChangeFormatter.format(value);

const COLUMN_DEFINITIONS: { key: SortKey; label: string }[] = [
  { key: 'companyName', label: 'Company / Entity' },
  { key: 'accountId', label: 'Account ID' },
  { key: 'accountName', label: 'Description' },
  { key: 'netChange', label: 'Activity' },
  { key: 'mappingType', label: 'Mapping Type' },
  { key: 'targetScoa', label: 'Target SCoA' },
  { key: 'polarity', label: 'Polarity' },
  { key: 'presetId', label: 'Preset' },
  { key: 'aiConfidence', label: 'Confidence' },
  { key: 'status', label: 'Status' },
  { key: 'notes', label: 'Notes' },
];

export default function MappingTable({ onConfigureAllocation }: MappingTableProps) {
  const { allocations } = useRatioAllocationStore();
  const { datapoints } = useTemplateStore();
  const coaOptions = datapoints['1'] || [];
  const accounts = useMappingStore(selectAccounts);
  const searchTerm = useMappingStore(selectSearchTerm);
  const activeStatuses = useMappingStore(selectActiveStatuses);
  const updateTarget = useMappingStore(state => state.updateTarget);
  const applyPresetToAccounts = useMappingStore(state => state.applyPresetToAccounts);
  const addSplitDefinition = useMappingStore(state => state.addSplitDefinition);
  const updateSplitDefinition = useMappingStore(state => state.updateSplitDefinition);
  const removeSplitDefinition = useMappingStore(state => state.removeSplitDefinition);
  const { selectedIds, toggleSelection, setSelection, clearSelection } = useMappingSelectionStore();
  const splitValidationIssues = useMappingStore(selectSplitValidationIssues);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection } | null>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(() => new Set());

  const splitIssueIds = useMemo(() => new Set(splitValidationIssues.map(issue => issue.accountId)), [
    splitValidationIssues,
  ]);

  useEffect(() => {
    const validIds = new Set(accounts.map(account => account.id));
    const filteredSelection = Array.from(selectedIds).filter(id => validIds.has(id));
    if (filteredSelection.length !== selectedIds.size) {
      setSelection(filteredSelection);
    }
  }, [accounts, selectedIds, setSelection]);

  useEffect(() => {
    setExpandedRows(previous => {
      const next = new Set<string>();
      previous.forEach(id => {
        if (accounts.some(account => account.id === id)) {
          next.add(id);
        }
      });
      return next;
    });
  }, [accounts]);

  const filteredAccounts = useMemo(() => {
    const normalizedQuery = searchTerm.trim().toLowerCase();
    return accounts.filter(account => {
      const matchesSearch =
        !normalizedQuery ||
        [
          account.accountId,
          account.accountName,
          account.companyName,
          account.entityName ?? '',
          account.activity,
          account.netChange.toString(),
          formatNetChange(account.netChange),
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery);
      const matchesStatus =
        activeStatuses.length === 0 || activeStatuses.includes(account.status);
      return matchesSearch && matchesStatus;
    });
  }, [accounts, searchTerm, activeStatuses]);

  const sortedAccounts = useMemo(() => {
    if (!sortConfig) {
      return filteredAccounts;
    }
    const { key, direction } = sortConfig;
    const multiplier = direction === 'asc' ? 1 : -1;
    const safeCompare = (a: GLAccountMappingRow, b: GLAccountMappingRow) => {
      const valueA = getSortValue(a, key);
      const valueB = getSortValue(b, key);
      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return (valueA - valueB) * multiplier;
      }
      const textA = typeof valueA === 'number' ? valueA.toString() : valueA;
      const textB = typeof valueB === 'number' ? valueB.toString() : valueB;
      return textA.localeCompare(textB, undefined, { sensitivity: 'base' }) * multiplier;
    };
    return [...filteredAccounts].sort(safeCompare);
  }, [filteredAccounts, sortConfig]);

  useEffect(() => {
    if (!selectAllRef.current) return;
    const allIds = sortedAccounts.map(account => account.id);
    const isAllSelected = allIds.length > 0 && allIds.every(id => selectedIds.has(id));
    selectAllRef.current.checked = isAllSelected;
    selectAllRef.current.indeterminate =
      selectedIds.size > 0 && !isAllSelected && allIds.some(id => selectedIds.has(id));
  }, [sortedAccounts, selectedIds]);

  const handleSort = (key: SortKey) => {
    setSortConfig(previous => {
      if (previous && previous.key === key) {
        const nextDirection: SortDirection = previous.direction === 'asc' ? 'desc' : 'asc';
        return { key, direction: nextDirection };
      }
      return { key, direction: 'asc' };
    });
  };

  const handleSelectAll = (event: ChangeEvent<HTMLInputElement>) => {
    const shouldSelectAll = event.target.checked;
    if (shouldSelectAll) {
      setSelection(sortedAccounts.map(account => account.id));
    } else {
      clearSelection();
    }
  };

  const handleRowSelection = (id: string) => {
    toggleSelection(id);
  };

  const toggleSplitRow = (id: string) => {
    setExpandedRows(previous => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getAriaSort = (columnKey: SortKey): 'ascending' | 'descending' | 'none' => {
    if (sortConfig?.key !== columnKey) {
      return 'none';
    }
    return sortConfig.direction === 'asc' ? 'ascending' : 'descending';
  };

  return (
    <div className="space-y-4">
      <MappingToolbar />
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700" role="table">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <tr>
              <th scope="col" className="w-12 px-3 py-3">
                <span className="sr-only">Select all rows</span>
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  aria-label="Select all rows"
                  onChange={handleSelectAll}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              {COLUMN_DEFINITIONS.map(column => (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={getAriaSort(column.key)}
                  className="whitespace-nowrap px-3 py-3"
                >
                  <button
                    type="button"
                    onClick={() => handleSort(column.key)}
                    className="flex items-center gap-1 font-semibold text-slate-700 transition hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:text-slate-200 dark:hover:text-blue-300 dark:focus:ring-offset-slate-900"
                  >
                    {column.label}
                    <ArrowUpDown className="h-4 w-4" aria-hidden="true" />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-slate-900">
            {sortedAccounts.map(account => {
              const isSelected = selectedIds.has(account.id);
      const targetScoa = account.manualCOAId ?? account.suggestedCOAId ?? '';
      const requiresSplit = account.mappingType === 'percentage' || account.mappingType === 'dynamic';
      const hasSplitIssue = splitIssueIds.has(account.id);
      const hasAllocation =
        (account.splitDefinitions.length > 0 && !hasSplitIssue) ||
        allocations.some(allocation => allocation.sourceAccount.id === account.id);
              const statusLabel = STATUS_LABELS[account.status];
              const isExpanded = expandedRows.has(account.id);

              return (
                <Fragment key={account.id}>
                  <tr
                    className={isSelected ? 'bg-blue-50 dark:bg-slate-800/50' : undefined}
                  >
                    <td className="px-3 py-4">
                      <input
                        type="checkbox"
                        aria-label={`Select account ${account.accountId}`}
                        checked={isSelected}
                        onChange={() => handleRowSelection(account.id)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="max-w-[220px] px-3 py-4">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{account.companyName}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{account.entityName ?? '—'}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-slate-700 dark:text-slate-200">
                      {account.accountId}
                    </td>
                    <td className="px-3 py-4">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{account.accountName}</div>
                    </td>
                    <td className="px-3 py-4">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{account.activity}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {formatNetChange(account.netChange)}
                      </div>
                    </td>
                    <td className="px-3 py-4 text-slate-700 dark:text-slate-200">{MAPPING_TYPE_LABELS[account.mappingType]}</td>
                    <td className="px-3 py-4">
                      <label className="sr-only" htmlFor={`scoa-${account.id}`}>
                        Select target SCoA for {account.accountName}
                      </label>
                      <select
                        id={`scoa-${account.id}`}
                        value={targetScoa}
                        onChange={event => updateTarget(account.id, event.target.value)}
                        className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      >
                        <option value="">Select target</option>
                        {coaOptions.map(option => (
                          <option key={option.id} value={option.coreGLAccount}>
                            {option.accountName}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-4 text-slate-700 dark:text-slate-200">{account.polarity}</td>
                    <td className="px-3 py-4">
                      <label className="sr-only" htmlFor={`preset-${account.id}`}>
                        Select preset for {account.accountName}
                      </label>
                      <select
                        id={`preset-${account.id}`}
                        value={account.presetId ?? ''}
                        onChange={event => {
                          const nextValue = event.target.value || null;
                          applyPresetToAccounts([account.id], nextValue);
                        }}
                        className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      >
                        <option value="">No preset</option>
                        {PRESET_OPTIONS.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-4 text-slate-700 dark:text-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{account.aiConfidence !== undefined ? `${account.aiConfidence}%` : '—'}</span>
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                          <div
                            className="h-full rounded-full bg-blue-600 dark:bg-blue-400"
                            style={{ width: `${Math.min(account.aiConfidence ?? 0, 100)}%` }}
                            aria-hidden="true"
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLES[account.status]}`}
                        role="status"
                        aria-label={`Status ${statusLabel}`}
                      >
                        <Check className="h-3 w-3" aria-hidden="true" />
                        {statusLabel}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-sm text-slate-700 dark:text-slate-200">
                      <div className="flex flex-col gap-1">
                        <span>{account.notes ?? '—'}</span>
                        {requiresSplit && !hasAllocation && (
                          <span className={`text-xs ${hasSplitIssue ? 'text-rose-600 dark:text-rose-300' : 'text-amber-600 dark:text-amber-300'}`}>
                            {hasSplitIssue ? 'Allocation percentages must equal 100%' : 'Allocation details required'}
                          </span>
                        )}
                        {requiresSplit && (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => onConfigureAllocation?.(account.id)}
                              className="text-xs font-medium text-blue-600 underline hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:text-blue-300 dark:hover:text-blue-200 dark:focus:ring-offset-slate-900"
                            >
                              Configure allocation
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleSplitRow(account.id)}
                              className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 underline transition hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:text-slate-300 dark:hover:text-blue-300 dark:focus:ring-offset-slate-900"
                              aria-expanded={isExpanded}
                              aria-controls={`split-panel-${account.id}`}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-3 w-3" aria-hidden="true" />
                              ) : (
                                <ChevronRight className="h-3 w-3" aria-hidden="true" />
                              )}
                              {isExpanded ? 'Hide splits' : 'Show splits'}
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                  {requiresSplit && isExpanded && (
                    <MappingSplitRow
                      account={account}
                      datapoints={coaOptions}
                      colSpan={COLUMN_DEFINITIONS.length + 1}
                      panelId={`split-panel-${account.id}`}
                      onAddSplit={() => addSplitDefinition(account.id)}
                      onUpdateSplit={(splitId, updates) => updateSplitDefinition(account.id, splitId, updates)}
                      onRemoveSplit={splitId => removeSplitDefinition(account.id, splitId)}
                    />
                  )}
                </Fragment>
              );
            })}
            {sortedAccounts.length === 0 && (
              <tr>
                <td colSpan={COLUMN_DEFINITIONS.length + 1} className="px-3 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                  No mapping rows match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function getSortValue(account: GLAccountMappingRow, key: SortKey): string | number {
  switch (key) {
    case 'companyName':
      return `${account.companyName} ${account.entityName ?? ''}`.trim();
    case 'accountId':
      return account.accountId;
    case 'accountName':
      return account.accountName;
    case 'netChange':
      return account.netChange;
    case 'status':
      return STATUS_ORDER[account.status];
    case 'mappingType':
      return account.mappingType;
    case 'targetScoa':
      return account.manualCOAId ?? account.suggestedCOAId ?? '';
    case 'polarity':
      return account.polarity;
    case 'presetId':
      return account.presetId ?? '';
    case 'aiConfidence':
      return account.aiConfidence ?? 0;
    case 'notes':
      return account.notes ?? '';
    default:
      return '';
  }
}
