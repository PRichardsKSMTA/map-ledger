import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Save, X } from 'lucide-react';
import type { UserClientOperation } from '../../types';
import { normalizeGlMonth } from '../../utils/extractDateFromText';
import {
  ClientSurveyRow,
  ClientSurveyUpdateInput,
  fetchClientSurveyData,
  updateClientSurveyValues,
} from '../../services/clientSurveyService';

interface ClientSurveyModalProps {
  open: boolean;
  clientId: string | null;
  clientName?: string | null;
  operations?: UserClientOperation[];
  onClose: () => void;
}

type ValueMap = Record<string, string>;
type OriginalMap = Record<string, number>;

const buildRowKey = (row: ClientSurveyRow): string =>
  `${row.operationCd}|||${row.glMonth}|||${row.accountNumber}`;

const getCurrentMonthInput = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const toMonthInputValue = (normalizedMonth: string): string =>
  normalizedMonth.length >= 7 ? normalizedMonth.slice(0, 7) : normalizedMonth;

const parseDraftValue = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

export default function ClientSurveyModal({
  open,
  clientId,
  clientName,
  operations = [],
  onClose,
}: ClientSurveyModalProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthInput());
  const [surveyRows, setSurveyRows] = useState<ClientSurveyRow[]>([]);
  const [activeOperation, setActiveOperation] = useState<string | null>(null);
  const [draftValues, setDraftValues] = useState<ValueMap>({});
  const [originalValues, setOriginalValues] = useState<OriginalMap>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const normalizedMonth = useMemo(
    () => (selectedMonth ? normalizeGlMonth(selectedMonth) : ''),
    [selectedMonth],
  );

  const operationNameLookup = useMemo(() => {
    const lookup = new Map<string, string>();
    operations.forEach(operation => {
      if (!operation.code) {
        return;
      }
      lookup.set(operation.code, operation.name || operation.code);
    });
    return lookup;
  }, [operations]);

  const rowLookup = useMemo(() => {
    const lookup: Record<string, ClientSurveyRow> = {};
    surveyRows.forEach(row => {
      lookup[buildRowKey(row)] = row;
    });
    return lookup;
  }, [surveyRows]);

  const operationsInSurvey = useMemo(() => {
    const unique = new Set<string>();
    surveyRows.forEach(row => {
      if (row.operationCd) {
        unique.add(row.operationCd);
      }
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [surveyRows]);

  const rowsByOperation = useMemo(() => {
    const grouped = new Map<string, ClientSurveyRow[]>();
    surveyRows.forEach(row => {
      const bucket = grouped.get(row.operationCd) ?? [];
      bucket.push(row);
      grouped.set(row.operationCd, bucket);
    });
    return grouped;
  }, [surveyRows]);

  const activeRows = activeOperation
    ? rowsByOperation.get(activeOperation) ?? []
    : [];

  const invalidKeys = useMemo(() => {
    return Object.entries(draftValues).filter(([, value]) => {
      if (!value.trim()) {
        return false;
      }
      return Number.isNaN(Number(value));
    });
  }, [draftValues]);

  const dirtyKeys = useMemo(() => {
    return Object.keys(draftValues).filter(key => {
      const parsed = parseDraftValue(draftValues[key]);
      if (parsed === null) {
        return false;
      }
      return parsed !== originalValues[key];
    });
  }, [draftValues, originalValues]);

  useEffect(() => {
    if (open) {
      setError(null);
      setSaveError(null);
      setIsSaving(false);
      if (!selectedMonth) {
        setSelectedMonth(getCurrentMonthInput());
      }
    }
  }, [open, selectedMonth]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (!clientId) {
      setSurveyRows([]);
      setDraftValues({});
      setOriginalValues({});
      setActiveOperation(null);
      setError('Select a client to load survey data.');
      return;
    }

    if (!normalizedMonth) {
      setSurveyRows([]);
      setDraftValues({});
      setOriginalValues({});
      setActiveOperation(null);
      setError('Select a valid GL month to load survey data.');
      return;
    }

    let isActive = true;
    setIsLoading(true);
    setError(null);
    setSaveError(null);

    fetchClientSurveyData(clientId, normalizedMonth)
      .then(rows => {
        if (!isActive) {
          return;
        }
        setSurveyRows(rows);
        const nextDraftValues: ValueMap = {};
        const nextOriginalValues: OriginalMap = {};
        rows.forEach(row => {
          const key = buildRowKey(row);
          nextDraftValues[key] = row.glValue.toString();
          nextOriginalValues[key] = row.glValue;
        });
        setDraftValues(nextDraftValues);
        setOriginalValues(nextOriginalValues);
      })
      .catch(fetchError => {
        if (!isActive) {
          return;
        }
        const message =
          fetchError instanceof Error ? fetchError.message : 'Unable to load survey data.';
        setError(message);
        setSurveyRows([]);
        setDraftValues({});
        setOriginalValues({});
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [open, clientId, normalizedMonth]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (operationsInSurvey.length === 0) {
      setActiveOperation(null);
      return;
    }

    if (!activeOperation || !operationsInSurvey.includes(activeOperation)) {
      setActiveOperation(operationsInSurvey[0]);
    }
  }, [activeOperation, open, operationsInSurvey]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose, isSaving]);

  if (!open) {
    return null;
  }

  const handleValueChange = (key: string, nextValue: string) => {
    setDraftValues(current => ({ ...current, [key]: nextValue }));
    setSaveError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving || dirtyKeys.length === 0 || invalidKeys.length > 0) {
      return;
    }

    const updates: ClientSurveyUpdateInput[] = dirtyKeys
      .map(key => {
        const row = rowLookup[key];
        const parsed = parseDraftValue(draftValues[key]);
        if (!row || parsed === null) {
          return null;
        }
        return {
          operationCd: row.operationCd,
          glMonth: row.glMonth,
          accountNumber: row.accountNumber,
          glValue: parsed,
        };
      })
      .filter((entry): entry is ClientSurveyUpdateInput => Boolean(entry));

    if (!updates.length) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      await updateClientSurveyValues(updates);
      setSurveyRows(previous =>
        previous.map(row => {
          const key = buildRowKey(row);
          const parsed = parseDraftValue(draftValues[key]);
          if (parsed === null) {
            return row;
          }
          if (!dirtyKeys.includes(key)) {
            return row;
          }
          return { ...row, glValue: parsed };
        }),
      );
      setOriginalValues(previous => {
        const next = { ...previous };
        updates.forEach(update => {
          const key = `${update.operationCd}|||${update.glMonth}|||${update.accountNumber}`;
          next[key] = update.glValue;
        });
        return next;
      });
    } catch (updateError) {
      const message =
        updateError instanceof Error ? updateError.message : 'Unable to update survey values.';
      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const pendingCount = dirtyKeys.length;
  const canSave = pendingCount > 0 && invalidKeys.length === 0 && !isSaving;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={() => {
        if (!isSaving) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-survey-title"
        className="w-full max-w-4xl rounded-xl bg-white shadow-xl"
        onClick={event => event.stopPropagation()}
      >
        <form onSubmit={handleSubmit} className="flex max-h-[85vh] flex-col">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
            <div className="space-y-1">
              <h2 id="client-survey-title" className="text-lg font-semibold text-slate-900">
                Monthly client survey
              </h2>
              <p className="text-sm text-slate-600">
                {clientName ?? clientId ?? 'Select a client'} ·{' '}
                {normalizedMonth ? toMonthInputValue(normalizedMonth) : 'No month selected'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed"
                aria-label="Close survey modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div className="flex flex-1 flex-col gap-6 overflow-hidden px-6 py-5">
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                GL month
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={event => setSelectedMonth(event.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  disabled={isLoading}
                />
              </label>
              <div className="text-xs text-slate-500">
                {pendingCount > 0
                  ? `${pendingCount} change${pendingCount === 1 ? '' : 's'} pending`
                  : 'No pending changes'}
              </div>
            </div>

            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            {saveError ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                {saveError}
              </div>
            ) : null}

            {isLoading ? (
              <div className="flex items-center gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                Loading survey datapoints
              </div>
            ) : operationsInSurvey.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
                No survey datapoints found for this client and month.
              </div>
            ) : (
              <div className="flex flex-1 flex-col gap-4 overflow-hidden">
                <div role="tablist" className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
                  {operationsInSurvey.map(operationCd => {
                    const isActive = operationCd === activeOperation;
                    const label = operationNameLookup.get(operationCd) ?? operationCd;
                    return (
                      <button
                        key={operationCd}
                        type="button"
                        role="tab"
                        id={`survey-tab-${operationCd}`}
                        aria-selected={isActive}
                        aria-controls={`survey-panel-${operationCd}`}
                        onClick={() => setActiveOperation(operationCd)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                          isActive
                            ? 'bg-indigo-600 text-white'
                            : 'border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                <div
                  id={`survey-panel-${activeOperation ?? 'none'}`}
                  role="tabpanel"
                  aria-labelledby={`survey-tab-${activeOperation ?? 'none'}`}
                  className="flex-1 overflow-y-auto rounded-lg border border-slate-200"
                >
                  <div className="divide-y divide-slate-100">
                    {activeRows.map(row => {
                      const key = buildRowKey(row);
                      const value = draftValues[key] ?? '';
                      return (
                        <div key={key} className="grid gap-4 px-4 py-3 md:grid-cols-[minmax(0,1fr)_180px]">
                          <div className="space-y-1">
                            <div className="text-sm font-medium text-slate-900">
                              {row.accountName || row.accountNumber}
                            </div>
                            <div className="text-xs text-slate-500">
                              Account {row.accountNumber}
                              {row.operationalGroup ? ` · ${row.operationalGroup}` : ''}
                              {row.laborGroup ? ` · ${row.laborGroup}` : ''}
                            </div>
                          </div>
                          <div>
                            <label className="sr-only" htmlFor={`survey-value-${key}`}>
                              {row.accountName || row.accountNumber}
                            </label>
                            <input
                              id={`survey-value-${key}`}
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              value={value}
                              onChange={event => handleValueChange(key, event.target.value)}
                              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {invalidKeys.length > 0 ? (
              <div className="flex items-center gap-2 text-xs text-amber-600">
                <AlertTriangle className="h-3.5 w-3.5" />
                Enter a valid number for every edited field before saving.
              </div>
            ) : null}
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-4">
            <div className="text-xs text-slate-500">
              Values are saved to client GL data for {normalizedMonth || 'the selected month'}.
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={!canSave}
                className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-indigo-400"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save changes
                  </>
                )}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}
