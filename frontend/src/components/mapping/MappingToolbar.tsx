import { ChangeEvent } from 'react';
import { Search } from 'lucide-react';
import { useMappingStore } from '../../store/mappingStore';
import { useMappingSelectionStore } from '../../store/mappingSelectionStore';
import type { GLAccountMappingRow } from '../../types';

const STATUS_DEFINITIONS: {
  value: GLAccountMappingRow['status'];
  label: string;
  className: string;
}[] = [
  {
    value: 'unreviewed',
    label: 'Unreviewed',
    className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  },
  {
    value: 'in-review',
    label: 'In Review',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200',
  },
  {
    value: 'approved',
    label: 'Approved',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200',
  },
  {
    value: 'rejected',
    label: 'Rejected',
    className: 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200',
  },
];

export default function MappingToolbar() {
  const {
    searchTerm,
    setSearchTerm,
    activeStatuses,
    toggleStatusFilter,
    clearStatusFilters,
    bulkAccept,
    finalizeMappings,
  } = useMappingStore();
  const { selectedIds, clearSelection } = useMappingSelectionStore();
  const hasSelection = selectedIds.size > 0;
  const selectedCount = selectedIds.size;

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const handleBulkAccept = () => {
    if (!selectedIds.size) return;
    bulkAccept(Array.from(selectedIds));
  };

  const handleFinalize = () => {
    if (!selectedIds.size) return;
    finalizeMappings(Array.from(selectedIds));
    clearSelection();
  };

  const handleClearFilters = () => {
    clearStatusFilters();
  };

  return (
    <div
      role="region"
      aria-label="Mapping controls"
      className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"
    >
      <div className="flex flex-1 flex-col gap-4 lg:flex-row lg:items-center">
        <div className="flex max-w-sm flex-col">
          <label
            htmlFor="mapping-search"
            className="text-sm font-medium text-slate-700 dark:text-slate-200"
          >
            Search mappings
          </label>
          <div className="mt-1 flex items-center rounded-md border border-slate-300 bg-white text-slate-900 focus-within:ring-2 focus-within:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
            <span className="pl-2 text-slate-500">
              <Search className="h-4 w-4" aria-hidden="true" />
            </span>
            <input
              id="mapping-search"
              type="search"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Search by account, company, or entity"
              className="w-full rounded-md border-0 bg-transparent px-2 py-2 text-sm placeholder-slate-400 focus:outline-none"
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div
            role="group"
            aria-label="Filter by status"
            className="flex flex-wrap items-center gap-2"
          >
            {STATUS_DEFINITIONS.map(status => {
              const isActive = activeStatuses.includes(status.value);
              return (
                <button
                  key={status.value}
                  type="button"
                  onClick={() => toggleStatusFilter(status.value)}
                  aria-pressed={isActive}
                  className={`rounded-full px-3 py-1 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${
                    isActive ? status.className : 'border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'
                  }`}
                >
                  {status.label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={handleClearFilters}
            className="self-start text-sm font-medium text-blue-600 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:text-blue-300 dark:hover:text-blue-200 dark:focus:ring-offset-slate-900"
          >
            Clear filters
          </button>
        </div>
      </div>
      <div className="flex flex-col items-start gap-2 lg:items-end">
        <span className="text-sm text-slate-600 dark:text-slate-300" aria-live="polite">
          {hasSelection ? `${selectedCount} row${selectedCount === 1 ? '' : 's'} selected` : 'No rows selected'}
        </span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleBulkAccept}
            disabled={!hasSelection}
            className={`rounded-md px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${
              hasSelection
                ? 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500'
                : 'cursor-not-allowed bg-slate-200 text-slate-500 focus:ring-0 dark:bg-slate-800 dark:text-slate-500'
            }`}
          >
            Accept suggested
          </button>
          <button
            type="button"
            onClick={handleFinalize}
            disabled={!hasSelection}
            className={`rounded-md px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${
              hasSelection
                ? 'bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500'
                : 'cursor-not-allowed bg-slate-200 text-slate-500 focus:ring-0 dark:bg-slate-800 dark:text-slate-500'
            }`}
          >
            Finalize selection
          </button>
        </div>
      </div>
    </div>
  );
}
