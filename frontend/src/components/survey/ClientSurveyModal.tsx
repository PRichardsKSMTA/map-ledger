import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, Loader2, X } from 'lucide-react';
import ModalBackdrop from '../ui/ModalBackdrop';
import type { UserClientOperation } from '../../types';
import { normalizeGlMonth } from '../../utils/extractDateFromText';
import type {
  ClientSurveySnapshot,
  ClientSurveyValue,
  SurveyAccount,
} from '../../services/clientSurveyService';
import { fetchClientSurveyData, updateClientSurveyValues } from '../../services/clientSurveyService';

interface ClientSurveyModalProps {
  open: boolean;
  clientId: string | null;
  clientName?: string | null;
  operations?: UserClientOperation[];
  onClose: () => void;
}

type ValueMap = Record<string, string>;
type SavedMap = Record<string, number>;
type PreviousMap = Record<string, { glMonth: string; glValue: number }>;
type SaveState = 'idle' | 'queued' | 'saving' | 'saved' | 'error';
type SaveStateMap = Record<string, SaveState>;

interface SurveyAccountDisplay extends SurveyAccount {
  displaySubCategory: string;
  displayLaborGroup: string;
  displayOperationalGroup: string;
}

interface SurveySection {
  key: string;
  label: string;
  laborGroups: {
    key: string;
    label: string;
    accounts: SurveyAccountDisplay[];
  }[];
}

const buildValueKey = (operationCd: string, accountNumber: string): string =>
  `${operationCd}|||${accountNumber}`;

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

const toTitleCase = (value: string): string =>
  value
    .split(' ')
    .map(token => {
      const trimmed = token.trim();
      if (!trimmed) {
        return '';
      }
      if (trimmed === trimmed.toUpperCase() && trimmed.length <= 3) {
        return trimmed;
      }
      return trimmed[0]?.toUpperCase() + trimmed.slice(1).toLowerCase();
    })
    .filter(Boolean)
    .join(' ');

const formatGroupLabel = (value: string | null | undefined, fallback: string): string => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return fallback;
  }
  if (/[a-z]/.test(trimmed)) {
    return trimmed;
  }
  return toTitleCase(trimmed);
};

const compareLabels = (left: string, right: string): number =>
  left.localeCompare(right, undefined, { sensitivity: 'base', numeric: true });

export default function ClientSurveyModal({
  open,
  clientId,
  clientName,
  operations = [],
  onClose,
}: ClientSurveyModalProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthInput());
  const [surveyAccounts, setSurveyAccounts] = useState<SurveyAccount[]>([]);
  const [dataOperations, setDataOperations] = useState<string[]>([]);
  const [activeOperation, setActiveOperation] = useState<string | null>(null);
  const [draftValues, setDraftValues] = useState<ValueMap>({});
  const [savedValues, setSavedValues] = useState<SavedMap>({});
  const [previousValues, setPreviousValues] = useState<PreviousMap>({});
  const [saveStates, setSaveStates] = useState<SaveStateMap>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [subCategoryQuery, setSubCategoryQuery] = useState('');

  const saveTimersRef = useRef<Record<string, number>>({});
  const saveResetTimersRef = useRef<Record<string, number>>({});
  const savedValuesRef = useRef<SavedMap>({});

  const normalizedMonth = useMemo(
    () => (selectedMonth ? normalizeGlMonth(selectedMonth) : ''),
    [selectedMonth],
  );

  const operationCodes = useMemo(() => {
    const unique = new Set<string>();
    operations.forEach(operation => {
      if (operation.code) {
        unique.add(operation.code);
      }
    });
    dataOperations.forEach(code => {
      if (code) {
        unique.add(code);
      }
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [operations, dataOperations]);

  const invalidKeys = useMemo(() => {
    return Object.entries(draftValues)
      .filter(([, value]) => value.trim() && Number.isNaN(Number(value)))
      .map(([key]) => key);
  }, [draftValues]);

  const invalidKeySet = useMemo(() => new Set(invalidKeys), [invalidKeys]);

  const pendingSaveCount = useMemo(
    () => Object.values(saveStates).filter(state => state === 'queued' || state === 'saving').length,
    [saveStates],
  );

  const displayAccounts = useMemo<SurveyAccountDisplay[]>(
    () =>
      surveyAccounts.map(account => ({
        ...account,
        displaySubCategory: formatGroupLabel(account.subCategory, 'Other'),
        displayLaborGroup: formatGroupLabel(account.laborGroup, 'Other'),
        displayOperationalGroup: formatGroupLabel(account.operationalGroup, 'Other'),
      })),
    [surveyAccounts],
  );

  const hasPreviousForActiveOperation = useMemo(() => {
    if (!activeOperation) {
      return false;
    }
    const prefix = `${activeOperation}|||`;
    return Object.keys(previousValues).some(key => key.startsWith(prefix));
  }, [activeOperation, previousValues]);

  const sections = useMemo<SurveySection[]>(() => {
    const sectionMap = new Map<
      string,
      {
        key: string;
        label: string;
        laborGroups: Map<
          string,
          {
            key: string;
            label: string;
            accounts: SurveyAccountDisplay[];
          }
        >;
      }
    >();

    displayAccounts.forEach(account => {
      const sectionKey = account.displaySubCategory;
      if (!sectionMap.has(sectionKey)) {
        sectionMap.set(sectionKey, {
          key: sectionKey,
          label: account.displaySubCategory,
          laborGroups: new Map(),
        });
      }
      const section = sectionMap.get(sectionKey);
      if (!section) {
        return;
      }
      const laborKey = account.displayLaborGroup;
      if (!section.laborGroups.has(laborKey)) {
        section.laborGroups.set(laborKey, {
          key: laborKey,
          label: account.displayLaborGroup,
          accounts: [],
        });
      }
      const laborGroup = section.laborGroups.get(laborKey);
      if (!laborGroup) {
        return;
      }
      laborGroup.accounts.push(account);
    });

    return Array.from(sectionMap.values())
      .map(section => ({
        key: section.key,
        label: section.label,
        laborGroups: Array.from(section.laborGroups.values())
          .map(laborGroup => ({
            key: laborGroup.key,
            label: laborGroup.label,
            accounts: laborGroup.accounts.sort((left, right) => {
              const labelCompare = compareLabels(
                left.displayOperationalGroup,
                right.displayOperationalGroup,
              );
              if (labelCompare !== 0) {
                return labelCompare;
              }
              return compareLabels(left.accountNumber, right.accountNumber);
            }),
          }))
          .sort((left, right) => compareLabels(left.label, right.label)),
      }))
      .sort((left, right) => compareLabels(left.label, right.label));
  }, [displayAccounts]);

  const normalizedSubCategoryQuery = useMemo(
    () => subCategoryQuery.trim().toLowerCase(),
    [subCategoryQuery],
  );

  const filteredSections = useMemo(
    () =>
      normalizedSubCategoryQuery
        ? sections.filter(section =>
          section.label.toLowerCase().includes(normalizedSubCategoryQuery),
        )
        : sections,
    [normalizedSubCategoryQuery, sections],
  );

  useEffect(() => {
    savedValuesRef.current = savedValues;
  }, [savedValues]);

  useEffect(() => {
    if (!open) {
      setError(null);
      setSaveError(null);
      setSubCategoryQuery('');
      if (!selectedMonth) {
        setSelectedMonth(getCurrentMonthInput());
      }
    }
  }, [open, selectedMonth]);

  useEffect(() => {
    if (!open) {
      return () => undefined;
    }

    if (!clientId) {
      setSurveyAccounts([]);
      setDraftValues({});
      setSavedValues({});
      setPreviousValues({});
      setDataOperations([]);
      setActiveOperation(null);
      setError('Select a client to load survey data.');
      return () => undefined;
    }

    if (!normalizedMonth) {
      setSurveyAccounts([]);
      setDraftValues({});
      setSavedValues({});
      setPreviousValues({});
      setDataOperations([]);
      setActiveOperation(null);
      setError('Select a valid GL month to load survey data.');
      return () => undefined;
    }

    let isActive = true;
    setIsLoading(true);
    setError(null);
    setSaveError(null);

    fetchClientSurveyData(clientId, normalizedMonth)
      .then((snapshot: ClientSurveySnapshot) => {
        if (!isActive) {
          return;
        }
        setSurveyAccounts(snapshot.accounts);
        const nextDraftValues: ValueMap = {};
        const nextSavedValues: SavedMap = {};
        const nextPreviousValues: PreviousMap = {};
        const nextOperations = new Set<string>();

        snapshot.currentValues.forEach((value: ClientSurveyValue) => {
          if (value.operationCd) {
            nextOperations.add(value.operationCd);
          }
          const key = buildValueKey(value.operationCd, value.accountNumber);
          nextDraftValues[key] = value.glValue.toString();
          nextSavedValues[key] = value.glValue;
        });

        snapshot.previousValues.forEach((value: ClientSurveyValue) => {
          if (value.operationCd) {
            nextOperations.add(value.operationCd);
          }
          const key = buildValueKey(value.operationCd, value.accountNumber);
          nextPreviousValues[key] = {
            glMonth: value.glMonth,
            glValue: value.glValue,
          };
        });

        setDraftValues(nextDraftValues);
        setSavedValues(nextSavedValues);
        setPreviousValues(nextPreviousValues);
        setSaveStates({});
        setDataOperations(Array.from(nextOperations).sort((a, b) => a.localeCompare(b)));
      })
      .catch(fetchError => {
        if (!isActive) {
          return;
        }
        const message =
          fetchError instanceof Error ? fetchError.message : 'Unable to load survey data.';
        setError(message);
        setSurveyAccounts([]);
        setDraftValues({});
        setSavedValues({});
        setPreviousValues({});
        setSaveStates({});
        setDataOperations([]);
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

    if (operationCodes.length === 0) {
      setActiveOperation(null);
      return;
    }

    if (!activeOperation || !operationCodes.includes(activeOperation)) {
      setActiveOperation(operationCodes[0]);
    }
  }, [activeOperation, open, operationCodes]);

  useEffect(() => {
    if (!open) {
      Object.values(saveTimersRef.current).forEach(timeoutId => clearTimeout(timeoutId));
      saveTimersRef.current = {};
      Object.values(saveResetTimersRef.current).forEach(timeoutId => clearTimeout(timeoutId));
      saveResetTimersRef.current = {};
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && pendingSaveCount === 0) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose, pendingSaveCount]);

  useEffect(
    () => () => {
      Object.values(saveTimersRef.current).forEach(timeoutId => clearTimeout(timeoutId));
      saveTimersRef.current = {};
      Object.values(saveResetTimersRef.current).forEach(timeoutId => clearTimeout(timeoutId));
      saveResetTimersRef.current = {};
    },
    [],
  );

  const scheduleSave = (
    operationCd: string,
    accountNumber: string,
    nextValue: string,
  ) => {
    if (!normalizedMonth) {
      return;
    }
    const key = buildValueKey(operationCd, accountNumber);
    const parsed = parseDraftValue(nextValue);
    const lastSaved = savedValuesRef.current[key];
    if (saveTimersRef.current[key]) {
      clearTimeout(saveTimersRef.current[key]);
    }
    if (parsed === null || Number.isNaN(parsed) || parsed === lastSaved) {
      setSaveStates(current => ({ ...current, [key]: 'idle' }));
      return;
    }

    setSaveStates(current => ({ ...current, [key]: 'queued' }));
    saveTimersRef.current[key] = window.setTimeout(() => {
      void saveValue(operationCd, accountNumber, nextValue);
    }, 650);
  };

  const handleDuplicatePreviousValues = () => {
    if (!activeOperation) {
      return;
    }

    const updates: Array<{ accountNumber: string; value: string }> = [];
    surveyAccounts.forEach(account => {
      const key = buildValueKey(activeOperation, account.accountNumber);
      const previousEntry = previousValues[key];
      if (!previousEntry) {
        return;
      }
      updates.push({
        accountNumber: account.accountNumber,
        value: previousEntry.glValue.toString(),
      });
    });

    if (!updates.length) {
      return;
    }

    setDraftValues(current => {
      const next = { ...current };
      updates.forEach(update => {
        const key = buildValueKey(activeOperation, update.accountNumber);
        next[key] = update.value;
      });
      return next;
    });
    setSaveError(null);
    updates.forEach(update => {
      scheduleSave(activeOperation, update.accountNumber, update.value);
    });
  };

  const saveValue = async (
    operationCd: string,
    accountNumber: string,
    nextValue: string,
  ) => {
    if (!normalizedMonth) {
      return;
    }
    const key = buildValueKey(operationCd, accountNumber);
    const parsed = parseDraftValue(nextValue);
    const lastSaved = savedValuesRef.current[key];
    if (parsed === null || Number.isNaN(parsed) || parsed === lastSaved) {
      setSaveStates(current => ({ ...current, [key]: 'idle' }));
      return;
    }

    setSaveStates(current => ({ ...current, [key]: 'saving' }));
    setSaveError(null);

    try {
      await updateClientSurveyValues([
        {
          operationCd,
          glMonth: normalizedMonth,
          accountNumber,
          glValue: parsed,
        },
      ]);
      setSavedValues(current => ({ ...current, [key]: parsed }));
      setSaveStates(current => ({ ...current, [key]: 'saved' }));
      if (saveResetTimersRef.current[key]) {
        clearTimeout(saveResetTimersRef.current[key]);
      }
      saveResetTimersRef.current[key] = window.setTimeout(() => {
        setSaveStates(current => {
          if (current[key] !== 'saved') {
            return current;
          }
          return { ...current, [key]: 'idle' };
        });
      }, 900);
    } catch (updateError) {
      const message =
        updateError instanceof Error ? updateError.message : 'Unable to update survey values.';
      setSaveError(message);
      setSaveStates(current => ({ ...current, [key]: 'error' }));
    }
  };

  const handleValueChange = (
    operationCd: string,
    accountNumber: string,
    nextValue: string,
  ) => {
    const key = buildValueKey(operationCd, accountNumber);
    setDraftValues(current => ({ ...current, [key]: nextValue }));
    setSaveError(null);
    scheduleSave(operationCd, accountNumber, nextValue);
  };

  const handleValueBlur = (
    operationCd: string,
    accountNumber: string,
    nextValue: string,
  ) => {
    const key = buildValueKey(operationCd, accountNumber);
    if (saveTimersRef.current[key]) {
      clearTimeout(saveTimersRef.current[key]);
    }
    void saveValue(operationCd, accountNumber, nextValue);
  };

  const numberFormatter = useMemo(
    () => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }),
    [],
  );

  if (!open) {
    return null;
  }

  return (
    <ModalBackdrop
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 dark:bg-slate-950/70"
      onClick={() => {
        if (pendingSaveCount === 0) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-survey-title"
        className="w-full max-w-6xl rounded-xl bg-white shadow-xl dark:bg-slate-900"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex max-h-[85vh] flex-col">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 px-6 py-5 dark:border-slate-700">
            <div className="space-y-1">
              <h2 id="client-survey-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Monthly client survey
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {clientName ?? clientId ?? 'Select a client'} -{' '}
                {normalizedMonth ? toMonthInputValue(normalizedMonth) : 'No month selected'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={pendingSaveCount > 0}
                className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed dark:text-slate-400 dark:hover:bg-slate-800"
                aria-label="Close survey modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div className="flex flex-1 flex-col gap-6 overflow-hidden px-6 py-5">
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                GL month
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={event => setSelectedMonth(event.target.value)}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  disabled={isLoading}
                />
              </label>

              <div className="text-xs text-slate-500 dark:text-slate-400">
                {pendingSaveCount > 0
                  ? `Saving ${pendingSaveCount} change${pendingSaveCount === 1 ? '' : 's'}`
                  : 'All changes saved'}
              </div>
            </div>

            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
                {error}
              </div>
            ) : null}

            {saveError ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
                {saveError}
              </div>
            ) : null}

            {isLoading ? (
              <div className="flex items-center gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                Loading survey datapoints
              </div>
            ) : operationCodes.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                No operations are available for this client.
              </div>
            ) : sections.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                No survey fields are configured. Update the chart of accounts to mark survey fields.
              </div>
            ) : (
              <div className="flex flex-1 flex-col gap-4 overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2 pt-1 dark:border-slate-700">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                    Search:
                    <input
                      type="search"
                      value={subCategoryQuery}
                      onChange={event => setSubCategoryQuery(event.target.value)}
                      className="w-64 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                      disabled={isLoading || sections.length === 0}
                    />
                  </label>
                  <div role="tablist" className="flex flex-wrap gap-2">
                    {operationCodes.map(operationCd => {
                      const isActive = operationCd === activeOperation;
                      return (
                        <button
                          key={operationCd}
                          type="button"
                          role="tab"
                          id={`survey-tab-${operationCd}`}
                          aria-selected={isActive}
                          aria-controls={`survey-panel-${operationCd}`}
                          onClick={() => setActiveOperation(operationCd)}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${isActive
                              ? 'bg-blue-600 text-white'
                              : 'border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600 dark:border-slate-600 dark:text-slate-300 dark:hover:border-blue-400 dark:hover:text-blue-200'
                            }`}
                        >
                          {operationCd}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={handleDuplicatePreviousValues}
                    disabled={
                      !activeOperation ||
                      !hasPreviousForActiveOperation ||
                      isLoading ||
                      pendingSaveCount > 0
                    }
                    className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-blue-400 dark:focus:ring-offset-slate-900"
                  >
                    Duplicate Previous Values
                  </button>
                </div>

                {filteredSections.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                    No survey categories match "{subCategoryQuery}".
                  </div>
                ) : (
                  <div
                    id={`survey-panel-${activeOperation ?? 'none'}`}
                    role="tabpanel"
                    aria-labelledby={`survey-tab-${activeOperation ?? 'none'}`}
                    className="flex-1 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700"
                  >
                    <div className="flex flex-col gap-4 p-4">
                      {filteredSections.map(section => (
                        <section
                          key={section.key}
                          className="rounded-lg border border-slate-200 bg-white/80 shadow-sm dark:border-slate-700 dark:bg-slate-900/70"
                        >
                        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {section.label}
                          </h3>
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                          {section.laborGroups.map(laborGroup => {
                            const previousEntries = laborGroup.accounts
                              .map(account =>
                                activeOperation
                                  ? previousValues[
                                  buildValueKey(activeOperation, account.accountNumber)
                                  ]
                                  : undefined,
                              )
                              .filter(Boolean) as { glMonth: string; glValue: number }[];
                            const previousMonths = new Set(
                              previousEntries.map(entry => entry.glMonth),
                            );
                            const previousMonthLabel =
                              previousMonths.size === 1
                                ? toMonthInputValue(Array.from(previousMonths)[0])
                                : previousMonths.size > 1
                                  ? 'recent months'
                                  : null;
                            const showPerEntryMonth = previousMonths.size > 1;

                            return (
                              <div key={laborGroup.key} className="px-4 py-4">
                                <div className="space-y-2">
                                  <div className="flex flex-wrap items-center gap-4">
                                    <div className="w-40 shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                      {laborGroup.label}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-4">
                                      {laborGroup.accounts.map(account => {
                                        if (!activeOperation) {
                                          return null;
                                        }
                                        const key = buildValueKey(
                                          activeOperation,
                                          account.accountNumber,
                                        );
                                        const value = draftValues[key] ?? '';
                                        const state = saveStates[key] ?? 'idle';
                                        const isInvalid = invalidKeySet.has(key);
                                        return (
                                          <div
                                            key={key}
                                            className="flex w-[200px] shrink-0 items-center gap-2"
                                          >
                                            <label
                                              htmlFor={`survey-value-${key}`}
                                              className="text-xs font-medium text-slate-600 dark:text-slate-300"
                                            >
                                              {account.displayOperationalGroup}:
                                            </label>
                                            <div className="relative">
                                              <input
                                                id={`survey-value-${key}`}
                                                type="number"
                                                inputMode="decimal"
                                                step="0.01"
                                                value={value}
                                                onChange={event =>
                                                  handleValueChange(
                                                    activeOperation,
                                                    account.accountNumber,
                                                    event.target.value,
                                                  )
                                                }
                                                onBlur={event =>
                                                  handleValueBlur(
                                                    activeOperation,
                                                    account.accountNumber,
                                                    event.target.value,
                                                  )
                                                }
                                                title={account.description ?? account.accountNumber}
                                                className={`w-32 rounded-md border px-2 py-1 pr-7 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:text-slate-100 ${isInvalid
                                                    ? 'border-red-400 text-red-600 focus:border-red-500 focus:ring-red-500 dark:border-red-500 dark:text-red-200'
                                                    : 'border-slate-300 text-slate-900 dark:border-slate-600'
                                                  }`}
                                              />
                                              {state === 'saving' ? (
                                                <Loader2 className="absolute right-2 top-2 h-4 w-4 animate-spin text-blue-500" />
                                              ) : state === 'saved' ? (
                                                <Check className="absolute right-2 top-2 h-4 w-4 text-emerald-500" />
                                              ) : state === 'error' ? (
                                                <AlertTriangle className="absolute right-2 top-2 h-4 w-4 text-red-500" />
                                              ) : null}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                                    <div className="w-40 shrink-0">
                                      {previousMonthLabel
                                        ? `Values from ${previousMonthLabel}:`
                                        : 'No historical values available yet.'}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-4">
                                      {laborGroup.accounts.map(account => {
                                        if (!activeOperation) {
                                          return null;
                                        }
                                        const key = buildValueKey(
                                          activeOperation,
                                          account.accountNumber,
                                        );
                                        const previousEntry = previousValues[key];
                                        const valueLabel = previousEntry
                                          ? numberFormatter.format(previousEntry.glValue)
                                          : '--';
                                        const monthSuffix =
                                          showPerEntryMonth && previousEntry?.glMonth
                                            ? ` (${toMonthInputValue(previousEntry.glMonth)})`
                                            : '';
                                        return (
                                          <span
                                            key={`prev-${key}`}
                                            className="inline-flex w-[200px] shrink-0 items-center gap-2 whitespace-nowrap"
                                          >
                                            <span className="font-medium">
                                              {account.displayOperationalGroup}:
                                            </span>
                                            <span className="pl-2">
                                              {valueLabel}
                                              {monthSuffix}
                                            </span>
                                          </span>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    ))}
                  </div>
                </div>
                )}
              </div>
            )}

            {invalidKeys.length > 0 ? (
              <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5" />
                Enter a valid number for each edited field to save changes.
              </div>
            ) : null}
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-700">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Autosave updates client survey data for {normalizedMonth || 'the selected month'}.
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={pendingSaveCount > 0}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus:ring-offset-slate-900"
              >
                Close
              </button>
            </div>
          </footer>
        </div>
      </div>
    </ModalBackdrop>
  );
}
