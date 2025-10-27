import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Moon, Sun, Building2 } from 'lucide-react';
import { useClientStore } from '../../store/clientStore';
import { useMappingStore } from '../../store/mappingStore';
import { useRatioAllocationStore } from '../../store/ratioAllocationStore';

interface MappingHeaderProps {
  clientId?: string;
  glUploadId?: string;
}

const MappingHeader = ({ clientId, glUploadId }: MappingHeaderProps) => {
  const clients = useClientStore(state => state.clients);
  const operations = useMappingStore(state =>
    state.accounts.map(account => account.operation)
  );
  const { metrics, selectedPeriod, setSelectedPeriod } = useRatioAllocationStore(
    state => ({
      metrics: state.metrics,
      selectedPeriod: state.selectedPeriod,
      setSelectedPeriod: state.setSelectedPeriod,
    })
  );

  const [isDark, setIsDark] = useState(false);

  const activeClient = useMemo(() => {
    if (clients.length === 0) {
      return undefined;
    }
    return clients.find(client => client.clientId === clientId) ?? clients[0];
  }, [clients, clientId]);

  const uniqueOperations = useMemo(() => {
    return Array.from(new Set(operations)).filter(Boolean);
  }, [operations]);

  const availablePeriods = useMemo(() => {
    return Array.from(new Set(metrics.map(metric => metric.period))).sort();
  }, [metrics]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  useEffect(() => {
    if (!selectedPeriod && availablePeriods.length > 0) {
      setSelectedPeriod(availablePeriods[0]);
    }
  }, [selectedPeriod, availablePeriods, setSelectedPeriod]);

  return (
    <div className="bg-white dark:bg-slate-900 shadow-sm rounded-lg p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            {activeClient && (
              <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 dark:bg-blue-900/60 dark:text-blue-100">
                <Building2 className="mr-2 h-4 w-4" />
                {activeClient.clientId}
              </span>
            )}
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                {activeClient?.name ?? 'Mapping Workspace'}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {glUploadId ? `Upload ${glUploadId}` : 'Latest general ledger import'}
              </p>
            </div>
          </div>
          {uniqueOperations.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <span className="font-medium">Operations:</span>
              {uniqueOperations.map(operation => (
                <span
                  key={operation}
                  className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 dark:bg-slate-800"
                >
                  {operation}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-4 lg:items-end">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
            <CalendarDays className="h-4 w-4" />
            <span>Reporting period</span>
            <select
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-100"
              value={selectedPeriod ?? ''}
              onChange={event => {
                const next = event.target.value;
                if (next) {
                  setSelectedPeriod(next);
                }
              }}
            >
              <option value="" disabled>
                Select period
              </option>
              {availablePeriods.map(period => (
                <option key={period} value={period}>
                  {period}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setIsDark(current => !current)}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-slate-700 dark:text-gray-200 dark:hover:bg-slate-800"
          >
            {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            <span>{isDark ? 'Dark theme' : 'Light theme'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MappingHeader;
