import { ChangeEvent } from 'react';
import { Search } from 'lucide-react';
import {
  selectActiveStatuses,
  selectSearchTerm,
  useMappingStore,
} from '../../store/mappingStore';
import type { GLAccountMappingRow } from '../../types';

interface MappingToolbarProps {
  onApplyAcrossPeriods?: () => void;
  canApplyAcrossPeriods?: boolean;
  onApplyToFuturePeriods?: () => void;
  canApplyToFuturePeriods?: boolean;
}

const STATUS_DEFINITIONS: {
  value: GLAccountMappingRow['status'];
  label: string;
  className: string;
}[] = [
  {
    value: 'New',
    label: 'New',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200',
  },
  {
    value: 'Unmapped',
    label: 'Unmapped',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200',
  },
  {
    value: 'Mapped',
    label: 'Mapped',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200',
  },
  {
    value: 'Excluded',
    label: 'Excluded',
    className: 'bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200',
  },
];

export default function MappingToolbar({
  onApplyAcrossPeriods,
  canApplyAcrossPeriods = false,
  onApplyToFuturePeriods,
  canApplyToFuturePeriods = false,
}: MappingToolbarProps) {
  const searchTerm = useMappingStore(selectSearchTerm);
  const activeStatuses = useMappingStore(selectActiveStatuses);
  const setSearchTerm = useMappingStore(state => state.setSearchTerm);
  const toggleStatusFilter = useMappingStore(state => state.toggleStatusFilter);
  const clearStatusFilters = useMappingStore(state => state.clearStatusFilters);
  const saveError = useMappingStore(state => state.saveError);
  const showApplyAcrossPeriods = Boolean(onApplyAcrossPeriods);
  const showApplyToFuturePeriods = Boolean(onApplyToFuturePeriods);

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
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
        <div
          role="group"
          aria-label="Filter by status"
          className="flex flex-wrap items-center gap-2 lg:mt-6"
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
          <button
            type="button"
            onClick={handleClearFilters}
            className="text-sm font-medium text-blue-600 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:text-blue-300 dark:hover:text-blue-200 dark:focus:ring-offset-slate-900"
          >
            Clear filters
          </button>
        </div>
      </div>
      {(showApplyAcrossPeriods || showApplyToFuturePeriods || saveError) && (
        <div className="flex flex-col items-start gap-2 lg:items-end">
          <div className="flex flex-wrap gap-2">
            {showApplyAcrossPeriods && (
              <button
                type="button"
                onClick={onApplyAcrossPeriods}
                disabled={!canApplyAcrossPeriods}
                className={`rounded-md px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${
                  canApplyAcrossPeriods
                    ? 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                    : 'cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400 focus:ring-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-600'
                }`}
              >
                Apply to all periods
              </button>
            )}
            {showApplyToFuturePeriods && (
              <button
                type="button"
                onClick={onApplyToFuturePeriods}
                disabled={!canApplyToFuturePeriods}
                className={`rounded-md px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${
                  canApplyToFuturePeriods
                    ? 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                    : 'cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400 focus:ring-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-600'
                }`}
              >
                Apply to future periods
              </button>
            )}
          </div>
          {saveError && (
            <div className="space-y-1" role="alert">
              <p className="text-sm text-rose-600 dark:text-rose-300">{saveError}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
