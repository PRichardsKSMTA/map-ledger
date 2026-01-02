import { ChangeEvent, Fragment, MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpDown, Check, ChevronRight, HelpCircle, Loader2, Minus, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import RatioAllocationManager from './RatioAllocationManager';
import DistributionDynamicAllocationRow from './DistributionDynamicAllocationRow';
import {
  useDistributionStore,
  type DistributionOperationCatalogItem,
} from '../../store/distributionStore';
import {
  DEFAULT_PRESET_CONTEXT,
  useRatioAllocationStore,
} from '../../store/ratioAllocationStore';
import {
  selectActiveEntityId,
  selectAccounts,
  selectDistributionTargets,
  useMappingStore,
} from '../../store/mappingStore';
import { useOrganizationStore } from '../../store/organizationStore';
import { useClientStore } from '../../store/clientStore';
import { useDistributionSelectionStore } from '../../store/distributionSelectionStore';
import DistributionToolbar from './DistributionToolbar';
import DistributionSplitRow, {
  type DistributionOperationDraft,
} from './DistributionSplitRow';
import {
  fetchDistributionPresetsFromApi,
  mapDistributionPresetsToDynamic,
  toDistributionPresetType,
  type DistributionPresetPayload,
} from '../../services/distributionPresetService';
import type {
  DistributionOperationShare,
  DistributionRow,
  DistributionStatus,
  DistributionType,
  MappingPresetLibraryEntry,
} from '../../types';
import { getOperationLabel } from '../../utils/operationLabel';
import { getBasisValue } from '../../utils/dynamicAllocation';
import { normalizeDistributionStatus } from '../../utils/distributionStatus';

interface DistributionTableProps {
  focusMappingId?: string | null;
}

const STATUS_DEFINITIONS: { value: DistributionStatus; label: string }[] = [
  { value: 'Undistributed', label: 'Undistributed' },
  { value: 'Distributed', label: 'Distributed' },
  { value: 'No balance', label: 'No balance' },
];

const STATUS_BADGE_CLASSES: Record<DistributionStatus, string> = {
  Undistributed:
    'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200',
  Distributed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200',
  'No balance': 'bg-slate-200 text-slate-700 dark:bg-slate-700/60 dark:text-slate-200',
};

const TYPE_OPTIONS: { value: DistributionType; label: string }[] = [
  { value: 'direct', label: 'Direct' },
  { value: 'percentage', label: 'Percentage' },
  { value: 'dynamic', label: 'Dynamic' },
];

type SortKey =
  | 'glAccount'
  | 'glDescription'
  | 'accountId'
  | 'description'
  | 'activity'
  | 'type'
  | 'operations'
  | 'status';
type SortDirection = 'asc' | 'desc';

const COLUMN_DEFINITIONS: { key: SortKey; label: string; align?: 'right' }[] = [
  { key: 'accountId', label: 'SCoA ID' },
  { key: 'description', label: 'SCoA Description' },
  { key: 'activity', label: 'Activity', align: 'right' },
  { key: 'type', label: 'Distribution Type' },
  { key: 'operations', label: 'Target Operation' },
  { key: 'status', label: 'Status', align: 'right' },
];

const DESCRIPTION_COLUMN_INDEX = COLUMN_DEFINITIONS.findIndex(
  column => column.key === 'description',
);
const COLUMNS_BEFORE_USER_DEFINED = COLUMN_DEFINITIONS.slice(
  0,
  DESCRIPTION_COLUMN_INDEX + 1,
);
const COLUMNS_AFTER_USER_DEFINED = COLUMN_DEFINITIONS.slice(
  DESCRIPTION_COLUMN_INDEX + 1,
);

const COLUMN_WIDTH_CLASSES: Partial<Record<SortKey, string>> = {
  accountId: 'w-32',
  description: 'min-w-[18rem]',
  activity: 'min-w-[11rem]',
  type: 'w-44',
  operations: 'min-w-[20rem]',
  status: 'w-32',
};

const GL_COLUMN_WIDTH_CLASSES = {
  account: 'min-w-[10rem]',
  description: 'min-w-[16rem]',
};

const USER_DEFINED_COLUMN_WIDTH_CLASS = 'min-w-[12rem]';

const COLUMN_SPACING_CLASSES: Partial<Record<SortKey, string>> = {
  activity: 'pr-10',
  type: 'pr-10',
  operations: 'pr-6',
};

const DEFAULT_PAGE_SIZE = 50;
const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

const STATUS_ICONS: Record<DistributionStatus, LucideIcon> = {
  Distributed: Check,
  Undistributed: HelpCircle,
  'No balance': Minus,
};

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const formatCurrency = (value: number): string => currencyFormatter.format(value);

const statusLabel = (value: DistributionStatus) =>
  STATUS_DEFINITIONS.find(status => status.value === value)?.label ?? value;

const formatOperationLabel = (operation: DistributionOperationShare) =>
  getOperationLabel({
    code: operation.code,
    id: operation.id,
    name: operation.name,
  });

const formatOperations = (row: DistributionRow) => {
  const validOperations = row.operations.filter(operation => Boolean(operation.id?.trim()));
  if (!validOperations.length) {
    return 'No operations assigned';
  }

  if (row.type === 'percentage') {
    return validOperations
      .map(operation => `${formatOperationLabel(operation)} (${operation.allocation ?? 0}%)`)
      .join(', ');
  }

  return validOperations.map(operation => formatOperationLabel(operation)).join(', ');
};

const createDraftId = () => `op-draft-${Math.random().toString(36).slice(2, 9)}`;

const toDraftOperations = (operations: DistributionOperationShare[]): DistributionOperationDraft[] =>
  operations.map(operation => ({
    ...operation,
    draftId: operation.id || createDraftId(),
  }));

const operationsAreEqual = (
  previous: DistributionOperationShare[],
  next: DistributionOperationShare[],
): boolean => {
  if (previous.length !== next.length) {
    return false;
  }

  return previous.every((operation, index) => {
    const comparison = next[index];
    if (!comparison) {
      return false;
    }

    return (
      operation.id === comparison.id &&
      (operation.code ?? null) === (comparison.code ?? null) &&
      operation.name === comparison.name &&
      (operation.allocation ?? null) === (comparison.allocation ?? null) &&
      (operation.notes ?? '') === (comparison.notes ?? '') &&
      (operation.basisDatapoint ?? null) === (comparison.basisDatapoint ?? null)
    );
  });
};

const resolveUserDefinedValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '-';
  }
  const normalized =
    typeof value === 'string' ? value.trim() : String(value).trim();
  return normalized.length > 0 ? normalized : '-';
};

const DistributionTable = ({ focusMappingId }: DistributionTableProps) => {
  const distributionTargets = useMappingStore(selectDistributionTargets);
  const mappedAccounts = useMappingStore(selectAccounts);
  const userDefinedHeaders = useMappingStore(state => state.userDefinedHeaders);
  const activeEntityId = useMappingStore(selectActiveEntityId);
  const activeClientId = useClientStore(state => state.activeClientId);
  const companies = useOrganizationStore(state => state.companies);
  const currentEmail = useOrganizationStore(state => state.currentEmail);
  const summarySignature = useMemo(
    () => distributionTargets.map(target => `${target.id}:${target.mappedAmount}`).join('|'),
    [distributionTargets],
  );
  const previousSignature = useRef<string | null>(null);
  const mappingRowLookup = useMemo(
    () => new Map(mappedAccounts.map(account => [account.id, account])),
    [mappedAccounts],
  );
  const totalColumnSpan = COLUMN_DEFINITIONS.length + 4 + userDefinedHeaders.length;
  const clientOperations = useMemo<DistributionOperationCatalogItem[]>(() => {
    const map = new Map<string, DistributionOperationCatalogItem>();
    companies.forEach(company => {
      company.clients.forEach(client => {
        if (activeClientId && client.id !== activeClientId) {
          return;
        }
        client.operations.forEach(operation => {
          const code = (operation.code || operation.id || '').trim();
          if (!code) {
            return;
          }
          const name = operation.name?.trim() || code;
          map.set(code, { id: code, code, name });
        });
      });
    });
    return Array.from(map.values()).sort((a, b) => a.id.localeCompare(b.id));
  }, [companies, activeClientId]);
  const {
    rows,
    operationsCatalog,
    searchTerm,
    statusFilters,
    syncRowsFromStandardTargets,
    updateRowType,
    updateRowOperations,
    updateRowPreset,
    applyOperationsToRows,
    applyBatchDistribution,
    applyPresetToRows,
    queueAutoSave,
    setSaveContext,
    setOperationsCatalog,
    loadHistoryForEntity,
  } = useDistributionStore(state => ({
    rows: state.rows,
    operationsCatalog: state.operationsCatalog,
    searchTerm: state.searchTerm,
    statusFilters: state.statusFilters,
    syncRowsFromStandardTargets: state.syncRowsFromStandardTargets,
    updateRowType: state.updateRowType,
    updateRowOperations: state.updateRowOperations,
    updateRowPreset: state.updateRowPreset,
    applyOperationsToRows: state.applyOperationsToRows,
    applyBatchDistribution: state.applyBatchDistribution,
    applyPresetToRows: state.applyPresetToRows,
    queueAutoSave: state.queueAutoSave,
    setSaveContext: state.setSaveContext,
    setOperationsCatalog: state.setOperationsCatalog,
    loadHistoryForEntity: state.loadHistoryForEntity,
  }));

  const [expandedRows, setExpandedRows] = useState<Set<string>>(() => new Set());
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [operationsDraft, setOperationsDraft] = useState<DistributionOperationDraft[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection } | null>(null);
  const [activeDynamicAccountId, setActiveDynamicAccountId] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [pageIndex, setPageIndex] = useState(0);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const previousTypesRef = useRef<Map<string, DistributionType>>(new Map());
  const lastSyncedOperationsRef = useRef<{
    rowId: string;
    operations: DistributionOperationShare[];
  } | null>(null);

  const { selectedIds, toggleSelection, setSelection, clearSelection } = useDistributionSelectionStore();
  const selectedIdList = useMemo(() => Array.from(selectedIds), [selectedIds]);
  const selectedRows = useMemo(() => {
    if (selectedIdList.length === 0) {
      return [];
    }
    const lookup = new Map(rows.map(row => [row.id, row]));
    return selectedIdList
      .map(id => lookup.get(id))
      .filter((row): row is DistributionRow => Boolean(row));
  }, [rows, selectedIdList]);
  const selectedAccountIds = useMemo(
    () =>
      Array.from(
        new Set(
          selectedRows
            .map(row => row.accountId)
            .filter((value): value is string => Boolean(value)),
        ),
      ),
    [selectedRows],
  );
  const dynamicPresetAccountIds = useMemo(() => {
    if (!activeDynamicAccountId) {
      return [];
    }
    if (selectedAccountIds.length > 1 && selectedAccountIds.includes(activeDynamicAccountId)) {
      return selectedAccountIds;
    }
    return [activeDynamicAccountId];
  }, [activeDynamicAccountId, selectedAccountIds]);

  const { getActivePresetForSource, basisAccounts, presets, selectedPeriod } =
    useRatioAllocationStore(state => ({
      getActivePresetForSource: state.getActivePresetForSource,
      basisAccounts: state.basisAccounts,
      presets: state.presets,
      selectedPeriod: state.selectedPeriod,
    }));
  const setDistributionPresets = useRatioAllocationStore(state => state.setContextPresets);
  const [distributionPresetLibrary, setDistributionPresetLibrary] = useState<
    MappingPresetLibraryEntry[]
  >([]);
  const percentageDistributionPresetOptions = useMemo(
    () => distributionPresetLibrary.filter(entry => entry.type === 'percentage'),
    [distributionPresetLibrary],
  );
  const distributionContextPresets = useMemo(
    () =>
      presets.filter(
        preset => (preset.context ?? DEFAULT_PRESET_CONTEXT) === 'distribution',
      ),
    [presets],
  );

  const normalizeOperationId = useCallback((value?: string | null): string => {
    if (!value) {
      return '';
    }
    return value.trim().toUpperCase();
  }, []);

  const operationLabelLookup = useMemo(() => {
    const lookup = new Map<string, DistributionOperationCatalogItem>();
    operationsCatalog.forEach(operation => {
      const key = normalizeOperationId(operation.code) || normalizeOperationId(operation.id);
      if (!key) {
        return;
      }
      lookup.set(key, operation);
    });
    return lookup;
  }, [normalizeOperationId, operationsCatalog]);

  const buildPresetOperations = useCallback(
    (presetId: string | null) => {
      if (!presetId) {
        return [];
      }
      const preset = distributionContextPresets.find(item => item.id === presetId);
      if (!preset) {
        return [];
      }

      const rowsWithBasis = preset.rows.map(presetRow => {
        const basisAccount = basisAccounts.find(acc => acc.id === presetRow.dynamicAccountId);
        const basisValue = basisAccount ? getBasisValue(basisAccount, selectedPeriod) : 0;
        return { presetRow, basisValue };
      });
      const totalBasis = rowsWithBasis.reduce((sum, item) => sum + item.basisValue, 0);

      return rowsWithBasis
        .map(({ presetRow, basisValue }) => {
          const targetId = normalizeOperationId(presetRow.targetAccountId);
          if (!targetId) {
            return null;
          }
          const catalogMatch = operationLabelLookup.get(targetId);
          const code = targetId;
          const allocationPct = totalBasis > 0 ? (basisValue / totalBasis) * 100 : 0;
          return {
            id: code,
            code,
            name: getOperationLabel({
              code,
              id: catalogMatch?.id ?? code,
              name: catalogMatch?.name ?? code,
            }),
            basisDatapoint: presetRow.dynamicAccountId?.trim() || undefined,
            allocation: allocationPct,
          } satisfies DistributionOperationShare;
        })
        .filter((operation): operation is DistributionOperationShare => Boolean(operation))
        .sort((a, b) => a.code.localeCompare(b.code));
    },
    [
      basisAccounts,
      distributionContextPresets,
      normalizeOperationId,
      operationLabelLookup,
      selectedPeriod,
    ],
  );

  const handleDynamicPresetApplied = useCallback(
    (presetId: string, sourceAccountIds: string[]) => {
      if (!presetId || sourceAccountIds.length === 0) {
        return;
      }
      const accountIdSet = new Set(sourceAccountIds);
      const targetRowIds = rows
        .filter(row => accountIdSet.has(row.accountId))
        .map(row => row.id);
      if (targetRowIds.length === 0) {
        return;
      }
      const derivedOperations = buildPresetOperations(presetId);
      applyPresetToRows(targetRowIds, presetId);
      applyOperationsToRows(targetRowIds, derivedOperations);
    },
    [
      applyOperationsToRows,
      applyPresetToRows,
      buildPresetOperations,
      rows,
    ],
  );

  const operationTargetCatalog = useMemo(
    () =>
      clientOperations.map(operation => ({
        id: operation.id,
        label: getOperationLabel(operation),
      })),
    [clientOperations],
  );

  const resolveOperationCanonicalTargetId = useCallback((targetId?: string | null) => {
    if (!targetId) {
      return null;
    }
    const normalized = targetId.trim();
    if (!normalized) {
      return null;
    }
    return normalized.toUpperCase();
  }, []);

  const sanitizeOperationsDraft = useCallback(
    (draft: DistributionOperationShare[]): DistributionOperationShare[] => {
      const sanitized = draft.reduce<DistributionOperationShare[]>((acc, operation) => {
        const id = operation.id?.trim();
        if (!id) {
          return acc;
        }
        const code = operation.code?.trim() || id;
        const allocation =
          typeof operation.allocation === 'number' && Number.isFinite(operation.allocation)
            ? operation.allocation
            : undefined;
        const notes = operation.notes?.trim();
        const basisDatapoint = operation.basisDatapoint?.trim();
        acc.push({
          id,
          code,
          name: operation.name?.trim() || code,
          allocation,
          notes: notes || undefined,
          basisDatapoint: basisDatapoint || undefined,
        });
        return acc;
      }, []);

      return sanitized;
    },
    [],
  );

const mapDistributionPayloadToLibraryEntry = (
  payload: DistributionPresetPayload,
): MappingPresetLibraryEntry => ({
  id: payload.presetGuid,
  entityId: payload.entityId,
  name: payload.presetDescription?.trim() || payload.presetGuid,
  type: toDistributionPresetType(payload.presetType),
  description: payload.presetDescription ?? null,
  presetDetails:
    (payload.presetDetails ?? [])
      .map(detail => ({
        targetDatapoint: detail.operationCd?.trim() ?? '',
        basisDatapoint: detail.basisDatapoint?.trim() ?? null,
        isCalculated: detail.isCalculated ?? null,
        specifiedPct: detail.specifiedPct ?? null,
      }))
      .filter(detail => detail.targetDatapoint.length > 0),
});

const buildDistributionPresetLibraryEntries = (
  payloads: DistributionPresetPayload[],
): MappingPresetLibraryEntry[] => {
  const entries = new Map<string, MappingPresetLibraryEntry>();
  payloads.forEach(payload => {
    const entry = mapDistributionPayloadToLibraryEntry(payload);
    if (!entries.has(entry.id)) {
      entries.set(entry.id, entry);
    }
  });
  return Array.from(entries.values());
};

  useEffect(() => {
    if (previousSignature.current === summarySignature) {
      return;
    }
    previousSignature.current = summarySignature;
    syncRowsFromStandardTargets(distributionTargets);
  }, [distributionTargets, summarySignature, syncRowsFromStandardTargets]);

  useEffect(() => {
    setOperationsCatalog(clientOperations);
  }, [clientOperations, setOperationsCatalog]);

  useEffect(() => {
    setSaveContext(activeEntityId ?? null, currentEmail ?? null);
  }, [activeEntityId, currentEmail, setSaveContext]);

  useEffect(() => {
    let canceled = false;

    const hydrateDistributionPresets = async () => {
      if (!activeEntityId) {
        setDistributionPresets('distribution', []);
        setDistributionPresetLibrary([]);
        await loadHistoryForEntity(null);
        return;
      }

      try {
        const payload = await fetchDistributionPresetsFromApi(activeEntityId);
        if (canceled) {
          return;
        }
        const dynamicPresets = mapDistributionPresetsToDynamic(payload);
        setDistributionPresets('distribution', dynamicPresets);
        setDistributionPresetLibrary(buildDistributionPresetLibraryEntries(payload));
      } catch (error) {
        console.error('Unable to load distribution presets', error);
      } finally {
        if (!canceled) {
          await loadHistoryForEntity(activeEntityId);
        }
      }
    };

    void hydrateDistributionPresets();

    return () => {
      canceled = true;
    };
  }, [
    activeEntityId,
    loadHistoryForEntity,
    setDistributionPresetLibrary,
    setDistributionPresets,
  ]);

  useEffect(() => {
    if (!focusMappingId) {
      return;
    }
    const targetRow = rows.find(row => row.mappingRowId === focusMappingId);
    if (!targetRow || targetRow.type === 'direct') {
      return;
    }
    setExpandedRows(new Set([targetRow.id]));
    setEditingRowId(targetRow.id);
    setOperationsDraft(toDraftOperations(targetRow.operations));
  }, [focusMappingId, rows]);

  useEffect(() => {
    const previousTypes = previousTypesRef.current;
    const requiresExpanded = (type: DistributionType) => type === 'percentage' || type === 'dynamic';

    const nextExpanded = new Set<string>();
    expandedRows.forEach(id => {
      const matchingRow = rows.find(row => row.id === id);
      if (matchingRow && matchingRow.type !== 'direct') {
        nextExpanded.add(id);
      }
    });

    let autoOpenedId: string | null = null;
    rows.forEach(row => {
      if (!requiresExpanded(row.type)) {
        return;
      }
      const previousType = previousTypes.get(row.id);
      const previouslyRequired = previousType ? requiresExpanded(previousType) : false;
      if (!previouslyRequired && !nextExpanded.has(row.id)) {
        nextExpanded.add(row.id);
        autoOpenedId = row.id;
      }
    });

    const expandedChanged =
      nextExpanded.size !== expandedRows.size ||
      Array.from(nextExpanded).some(id => !expandedRows.has(id));
    if (expandedChanged) {
      setExpandedRows(nextExpanded);
    }

    let nextEditingId = editingRowId;
    if (autoOpenedId) {
      nextEditingId = autoOpenedId;
    } else if (editingRowId) {
      const row = rows.find(item => item.id === editingRowId);
      if (!row || row.type === 'direct') {
        nextEditingId = null;
      }
    }
    if (nextEditingId !== editingRowId) {
      setEditingRowId(nextEditingId);
    }

    if (autoOpenedId) {
      const targetRow = rows.find(item => item.id === autoOpenedId);
      if (targetRow) {
        const nextDraft = toDraftOperations(targetRow.operations);
        const draftsMatch =
          operationsDraft.length === nextDraft.length &&
          operationsDraft.every((draft, index) => {
            const candidate = nextDraft[index];
            return (
              candidate &&
              (draft.id ?? '').trim() === (candidate.id ?? '').trim() &&
              (draft.code ?? '').trim() === (candidate.code ?? '').trim() &&
              (draft.name ?? '').trim() === (candidate.name ?? '').trim() &&
              (draft.allocation ?? null) === (candidate.allocation ?? null) &&
              (draft.notes ?? '').trim() === (candidate.notes ?? '').trim() &&
              (draft.basisDatapoint ?? '').trim() === (candidate.basisDatapoint ?? '').trim()
            );
          });
        if (!draftsMatch) {
          setOperationsDraft(nextDraft);
        }
      }
    }

    previousTypesRef.current = new Map(rows.map(row => [row.id, row.type]));
  }, [editingRowId, expandedRows, operationsDraft, rows]);

  const normalizedStatusFilters = useMemo(
    () => statusFilters.map(normalizeDistributionStatus),
    [statusFilters],
  );
  const statusSignature = normalizedStatusFilters.join('|');

  const filteredRows = useMemo(() => {
    const normalizedQuery = searchTerm.trim().toLowerCase();
    const activeStatuses = new Set(normalizedStatusFilters);
    return rows.filter(row => {
      const mappingRow = mappingRowLookup.get(row.mappingRowId);
      const userDefinedValues = userDefinedHeaders
        .map(header => resolveUserDefinedValue(mappingRow?.[header.key]))
        .filter(value => value !== '-');
      const matchesSearch =
        !normalizedQuery ||
        [
          row.accountId,
          row.description,
          formatCurrency(row.activity),
          mappingRow?.accountId,
          mappingRow?.accountName,
          mappingRow?.entityName,
          ...userDefinedValues,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery);
      const rowStatus = normalizeDistributionStatus(row.status);
      const matchesStatus = activeStatuses.size === 0 || activeStatuses.has(rowStatus);
      return matchesSearch && matchesStatus;
    });
  }, [mappingRowLookup, normalizedStatusFilters, rows, searchTerm, userDefinedHeaders]);

  const getRowSortValue = useCallback(
    (row: DistributionRow, key: SortKey): string | number => {
      const mappingRow = mappingRowLookup.get(row.mappingRowId);

      switch (key) {
        case 'glAccount':
          return mappingRow?.accountId ?? '';
        case 'glDescription':
          return mappingRow?.accountName ?? '';
        case 'accountId':
          return row.accountId;
        case 'description':
          return row.description;
        case 'activity':
          return row.activity;
        case 'type':
          return row.type;
        case 'operations':
          return formatOperations(row);
        case 'status':
          return row.status;
        default:
          return '';
      }
    },
    [mappingRowLookup],
  );

  const sortedRows = useMemo(() => {
    if (!sortConfig) {
      return filteredRows;
    }
    const multiplier = sortConfig.direction === 'asc' ? 1 : -1;
    return [...filteredRows].sort((a, b) => {
      const valueA = getRowSortValue(a, sortConfig.key);
      const valueB = getRowSortValue(b, sortConfig.key);
      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return (valueA - valueB) * multiplier;
      }
      return valueA.toString().localeCompare(valueB.toString()) * multiplier;
    });
  }, [filteredRows, getRowSortValue, sortConfig]);

  useEffect(() => {
    setPageIndex(0);
  }, [pageSize, searchTerm, sortConfig?.direction, sortConfig?.key, statusSignature]);

  const totalRows = sortedRows.length;
  const totalPages = totalRows > 0 ? Math.ceil(totalRows / pageSize) : 0;
  const safePageIndex = totalPages > 0 ? Math.min(pageIndex, totalPages - 1) : 0;
  const pageStart = totalPages > 0 ? safePageIndex * pageSize : 0;
  const pageEnd = totalPages > 0 ? Math.min(pageStart + pageSize, totalRows) : 0;
  const pagedRows = useMemo(
    () => sortedRows.slice(pageStart, pageEnd),
    [pageEnd, pageStart, sortedRows],
  );
  const pageLabelStart = totalRows === 0 ? 0 : pageStart + 1;
  const pageLabelEnd = totalRows === 0 ? 0 : pageEnd;
  const currentPage = totalPages === 0 ? 0 : safePageIndex + 1;
  const lastPageIndex = Math.max(totalPages - 1, 0);

  useEffect(() => {
    if (pageIndex !== safePageIndex) {
      setPageIndex(safePageIndex);
    }
  }, [pageIndex, safePageIndex]);

  useEffect(() => {
    if (!selectAllRef.current) {
      return;
    }
    const allIds = sortedRows.map(row => row.id);
    const isAllSelected = allIds.length > 0 && allIds.every(id => selectedIds.has(id));
    selectAllRef.current.checked = isAllSelected;
    selectAllRef.current.indeterminate =
      selectedIds.size > 0 && !isAllSelected && allIds.some(id => selectedIds.has(id));
  }, [sortedRows, selectedIds]);

  const handleSort = (key: SortKey) => {
    setSortConfig(previous => {
      if (previous?.key === key) {
        const nextDirection: SortDirection = previous.direction === 'asc' ? 'desc' : 'asc';
        return { key, direction: nextDirection };
      }
      return { key, direction: 'asc' };
    });
  };

  const handleSelectAll = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelection(sortedRows.map(row => row.id));
    } else {
      clearSelection();
    }
  };

  const handleRowSelection = (id: string) => {
    toggleSelection(id);
  };

  const handleToggleRow = (row: DistributionRow) => {
    if (row.type === 'direct') {
      return;
    }
    const isExpanded = expandedRows.has(row.id);
    if (isExpanded) {
      setExpandedRows(new Set());
      if (editingRowId === row.id) {
        setEditingRowId(null);
        setOperationsDraft([]);
      }
      return;
    }
    setExpandedRows(new Set([row.id]));
    setEditingRowId(row.id);
    setOperationsDraft(toDraftOperations(row.operations));
  };

  useEffect(() => {
    if (!editingRowId) {
      lastSyncedOperationsRef.current = null;
      return;
    }

    const targetRow = rows.find(row => row.id === editingRowId);
    if (!targetRow || targetRow.type === 'direct') {
      lastSyncedOperationsRef.current = null;
      return;
    }

    // Dynamic rows manage operations via the preset builder/ratio store, not the inline draft state,
    // so avoid overwriting those values with an empty operationsDraft.
    if (targetRow.type === 'dynamic') {
      lastSyncedOperationsRef.current = null;
      return;
    }

    const sanitized = sanitizeOperationsDraft(operationsDraft);

    // Check if store already has these exact operations
    if (operationsAreEqual(targetRow.operations, sanitized)) {
      lastSyncedOperationsRef.current = null;
      return;
    }

    // Prevent infinite loop: skip if we just synced these exact operations
    // This can happen when the store update triggers a re-render but the
    // comparison still fails due to subtle differences in sanitization
    if (
      lastSyncedOperationsRef.current &&
      lastSyncedOperationsRef.current.rowId === editingRowId &&
      operationsAreEqual(lastSyncedOperationsRef.current.operations, sanitized)
    ) {
      return;
    }

    const hasBatchSelection = selectedIds.has(editingRowId) && selectedIds.size > 1;

    lastSyncedOperationsRef.current = { rowId: editingRowId, operations: sanitized };
    if (hasBatchSelection) {
      applyOperationsToRows(selectedIdList, sanitized);
    } else {
      updateRowOperations(editingRowId, sanitized);
    }
  }, [
    applyOperationsToRows,
    editingRowId,
    operationsDraft,
    rows,
    sanitizeOperationsDraft,
    selectedIdList,
    selectedIds,
    updateRowOperations,
  ]);

  const handleDirectOperationChange = (row: DistributionRow, operationId: string) => {
    const hasBatchSelection = selectedIds.has(row.id) && selectedIds.size > 1;
    if (!operationId) {
      if (hasBatchSelection) {
        applyBatchDistribution(selectedIdList, { operation: null });
      } else {
        updateRowOperations(row.id, []);
      }
      return;
    }
    const catalogItem = operationsCatalog.find(item => item.id === operationId);
    if (!catalogItem) {
      if (hasBatchSelection) {
        applyBatchDistribution(selectedIdList, { operation: null });
      } else {
        updateRowOperations(row.id, []);
      }
      return;
    }
    const operationShare = {
      id: catalogItem.id,
      code: catalogItem.code,
      name: catalogItem.name,
    };
    if (hasBatchSelection) {
      applyBatchDistribution(selectedIdList, { operation: operationShare });
      clearSelection();
      return;
    }
    updateRowOperations(row.id, [operationShare]);
    queueAutoSave([row.id], { immediate: true });
  };

  const handleDistributionTypeChange = (rowId: string, type: DistributionType) => {
    const hasBatchSelection = selectedIds.has(rowId) && selectedIds.size > 1;
    if (hasBatchSelection) {
      applyBatchDistribution(selectedIdList, { type });
      return;
    }
    updateRowType(rowId, type);
  };

  const getAriaSort = (columnKey: SortKey): 'ascending' | 'descending' | 'none' => {
    if (sortConfig?.key !== columnKey) {
      return 'none';
    }
    return sortConfig.direction === 'asc' ? 'ascending' : 'descending';
  };

  const renderSortableHeader = (column: {
    key: SortKey;
    label: string;
    align?: 'right';
    className?: string;
  }) => {
    const widthClass = column.className ?? COLUMN_WIDTH_CLASSES[column.key] ?? '';
    const spacingClass = COLUMN_SPACING_CLASSES[column.key] ?? '';
    const buttonAlignmentClass = column.align === 'right' ? 'justify-end text-right' : '';
    return (
      <th
        key={column.key}
        scope="col"
        aria-sort={getAriaSort(column.key)}
        onClick={() => handleSort(column.key)}
        className={`cursor-pointer px-3 py-3 ${widthClass} ${spacingClass} ${column.align === 'right' ? 'text-right' : ''}`}
      >
        <button
          type="button"
          onClick={(event: MouseEvent<HTMLButtonElement>) => {
            event.stopPropagation();
            handleSort(column.key);
          }}
          className={`flex w-full items-center gap-1 font-semibold text-slate-700 transition hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:text-slate-200 dark:hover:text-blue-300 dark:focus:ring-offset-slate-900 ${buttonAlignmentClass}`}
        >
          {column.label}
          <ArrowUpDown className="h-4 w-4" aria-hidden="true" />
        </button>
      </th>
    );
  };

  return (
    <div className="space-y-6">
      <DistributionToolbar />

      <div className="overflow-x-auto">
        <table
          className="divide-y divide-slate-200 dark:divide-slate-700"
          role="table"
          style={{ minWidth: '100%' }}
        >
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <tr>
              <th scope="col" className="w-10 px-3 py-3">
                <span className="sr-only">Toggle distribution operations</span>
              </th>
              <th scope="col" className="w-12 px-3 py-3">
                <span className="sr-only">Select all rows</span>
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  aria-label="Select all distribution rows"
                  onChange={handleSelectAll}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              {renderSortableHeader({
                key: 'glAccount',
                label: 'GL Account',
                className: `normal-case ${GL_COLUMN_WIDTH_CLASSES.account}`,
              })}
              {renderSortableHeader({
                key: 'glDescription',
                label: 'GL Description',
                className: `normal-case ${GL_COLUMN_WIDTH_CLASSES.description}`,
              })}
              {COLUMNS_BEFORE_USER_DEFINED.map(renderSortableHeader)}
              {userDefinedHeaders.map(header => (
                <th
                  key={header.key}
                  scope="col"
                  className={`px-3 py-3 text-left normal-case ${USER_DEFINED_COLUMN_WIDTH_CLASS}`}
                >
                  {header.label}
                </th>
              ))}
              {COLUMNS_AFTER_USER_DEFINED.map(renderSortableHeader)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white text-sm dark:divide-slate-700 dark:bg-slate-900">
            {pagedRows.map(row => {
              const isExpanded = expandedRows.has(row.id);
              const isEditing = editingRowId === row.id;
              const operationsSummary = formatOperations(row);
              const statusBadgeClass = STATUS_BADGE_CLASSES[row.status];
              const isSelected = selectedIds.has(row.id);
              const hasBatchSelection = isSelected && selectedIds.size > 1;
              const activePreset = row.type === 'dynamic' ? getActivePresetForSource(row.accountId) : null;
              const hasAccordion = row.type !== 'direct';
              const mappingRow = mappingRowLookup.get(row.mappingRowId);
              const glAccountId = mappingRow?.accountId ?? '';
              const glAccountName = mappingRow?.accountName ?? '';
              const hasGlAccount = Boolean(glAccountId || glAccountName);
              const userDefinedValues = userDefinedHeaders.map(header => ({
                key: header.key,
                label: header.label,
                value: resolveUserDefinedValue(mappingRow?.[header.key]),
              }));
              const rowClasses = [
                'align-middle transition',
                isSelected
                  ? 'bg-blue-50 dark:bg-slate-800/50'
                  : hasAccordion
                    ? 'bg-slate-50/60 dark:bg-slate-900/60'
                    : 'bg-white dark:bg-slate-900',
                hasAccordion ? 'ring-1 ring-slate-900/40 dark:ring-slate-700/80' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <Fragment key={row.id}>
                  <tr className={rowClasses}>
                    <td className="px-3 py-4 text-center align-middle">
                      {row.type !== 'direct' ? (
                        <button
                          type="button"
                          onClick={() => handleToggleRow(row)}
                          aria-expanded={isExpanded}
                          aria-controls={`distribution-panel-${row.id}`}
                          aria-label={`${isExpanded ? 'Hide' : 'Show'} operations for ${row.accountId}`}
                          className="inline-flex h-6 w-6 items-center justify-center rounded border border-transparent text-slate-500 transition hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:text-slate-300 dark:hover:text-blue-300 dark:focus:ring-offset-slate-900"
                        >
                          <ChevronRight
                            className={`h-6 w-6 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                            aria-hidden="true"
                          />
                        </button>
                      ) : (
                        <span className="inline-flex h-6 w-6 items-center justify-center" aria-hidden="true" />
                      )}
                    </td>
                    <td className="px-3 py-4 align-middle">
                      <input
                        type="checkbox"
                        aria-label={`Select distribution row for account ${row.accountId}`}
                        checked={isSelected}
                        onChange={() => handleRowSelection(row.id)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className={`px-3 py-4 align-top ${GL_COLUMN_WIDTH_CLASSES.account}`}>
                      {hasGlAccount ? (
                        <div className="text-xs font-medium text-slate-900 dark:text-slate-100">
                          {glAccountId || '-'}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 dark:text-slate-500">-</span>
                      )}
                    </td>
                    <td className={`px-3 py-4 align-top ${GL_COLUMN_WIDTH_CLASSES.description}`}>
                      {hasGlAccount ? (
                        <div className="text-xs text-slate-600 dark:text-slate-300">
                          {glAccountName || 'No description'}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 dark:text-slate-500">-</span>
                      )}
                    </td>
                    <td className={`whitespace-nowrap px-3 py-4 ${COLUMN_WIDTH_CLASSES.accountId ?? ''}`}>
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{row.accountId}</span>
                      </div>
                    </td>
                    <td className={`px-3 py-4 text-slate-700 dark:text-slate-200 ${COLUMN_WIDTH_CLASSES.description ?? ''}`}>
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{row.description}</span>
                      </div>
                    </td>
                    {userDefinedValues.map(entry => (
                      <td
                        key={`${row.id}-${entry.key}`}
                        className={`px-3 py-4 align-top ${USER_DEFINED_COLUMN_WIDTH_CLASS}`}
                      >
                        <span
                          className={`text-xs ${
                            entry.value === '-'
                              ? 'text-slate-400 dark:text-slate-500'
                              : 'text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {entry.value}
                        </span>
                      </td>
                    ))}
                    <td
                      className={`pl-3 py-4 text-right font-medium tabular-nums text-slate-600 dark:text-slate-300 ${COLUMN_WIDTH_CLASSES.activity ?? ''} ${COLUMN_SPACING_CLASSES.activity ?? ''}`}
                    >
                      {formatCurrency(row.activity)}
                    </td>
                    <td className={`px-3 py-4 ${COLUMN_WIDTH_CLASSES.type ?? ''} ${COLUMN_SPACING_CLASSES.type ?? ''}`}>
                      <label htmlFor={`distribution-type-${row.id}`} className="sr-only">
                        Select distribution type
                      </label>
                      <select
                        id={`distribution-type-${row.id}`}
                        value={row.type}
                        onChange={event =>
                          handleDistributionTypeChange(
                            row.id,
                            event.target.value as DistributionType
                          )
                        }
                        className="w-full min-w-[8rem] rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        {TYPE_OPTIONS.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={`px-3 py-4 ${COLUMN_WIDTH_CLASSES.operations ?? ''} ${COLUMN_SPACING_CLASSES.operations ?? ''}`}>
                      {row.type === 'direct' ? (
                        operationsCatalog.length > 0 ? (
                          <select
                            aria-label="Select target operation"
                            value={row.operations[0]?.id ?? ''}
                            onChange={event => handleDirectOperationChange(row, event.target.value)}
                            className="w-full min-w-[12rem] rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          >
                            <option value="">Select operation</option>
                            {operationsCatalog.map(option => (
                            <option key={option.id} value={option.id}>
                                {getOperationLabel(option)}
                            </option>
                            ))}
                          </select>
                        ) : (
                          <p className="text-sm text-slate-500 dark:text-slate-400">No operations available for this client.</p>
                        )
                      ) : (
                        <div className="space-y-2">
                          <p className="text-sm text-slate-700 dark:text-slate-200">{operationsSummary}</p>
                          {row.type === 'dynamic' && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
                              {activePreset ? `Preset: ${activePreset.name}` : 'No preset selected'}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className={`px-3 py-4 text-right ${COLUMN_WIDTH_CLASSES.status ?? ''}`}>
                      {(() => {
                        const StatusIcon = STATUS_ICONS[row.status];
                        const isSavingRow = row.autoSaveState === 'saving';
                        return (
                          <div className="flex flex-col items-end gap-1 text-right">
                            <div className="flex items-center gap-1">
                              {isSavingRow && (
                                <Loader2
                                  className="h-3.5 w-3.5 animate-spin text-blue-600 dark:text-blue-300"
                                  aria-hidden="true"
                                />
                              )}
                              <span
                                className={`inline-flex min-w-[7rem] items-center justify-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClass}`}
                              >
                                <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
                                {statusLabel(row.status)}
                              </span>
                            </div>
                            {row.autoSaveError && (
                              <span className="text-[11px] font-medium text-rose-700 dark:text-rose-300" role="alert">
                                {row.autoSaveError}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                  {isExpanded && isEditing && row.type === 'percentage' && (
                    <tr id={`distribution-panel-${row.id}`}>
                      <td colSpan={totalColumnSpan} className="bg-slate-50 px-4 py-6 dark:bg-slate-800/40">
                        <DistributionSplitRow
                          row={row}
                          operationsCatalog={operationsCatalog}
                          operationsDraft={operationsDraft}
                          setOperationsDraft={setOperationsDraft}
                          presetOptions={percentageDistributionPresetOptions}
                          selectedPresetId={row.presetId ?? null}
                          onApplyPreset={presetId => {
                            if (hasBatchSelection) {
                              applyPresetToRows(selectedIdList, presetId);
                              return;
                            }
                            updateRowPreset(row.id, presetId);
                          }}
                          panelId={`distribution-panel-${row.id}`}
                        />
                      </td>
                    </tr>
                  )}
                  {isExpanded && isEditing && row.type === 'dynamic' && (
                    <DistributionDynamicAllocationRow
                      row={row}
                      colSpan={totalColumnSpan}
                      panelId={`distribution-panel-${row.id}`}
                      onOpenBuilder={() => setActiveDynamicAccountId(row.accountId)}
                      operationsCatalog={operationsCatalog}
                      batchRowIds={hasBatchSelection ? selectedIdList : undefined}
                      batchAccountIds={hasBatchSelection ? selectedAccountIds : undefined}
                    />
                  )}
                </Fragment>
              );
            })}
            {totalRows === 0 && (
              <tr>
                <td colSpan={totalColumnSpan} className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-300">
                  No distribution rows match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalRows > 0 && (
        <div className="flex flex-col gap-3 border-t border-slate-200 pt-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700">
          <div className="text-sm text-slate-600 dark:text-slate-300">
            Showing {pageLabelStart.toLocaleString()}-{pageLabelEnd.toLocaleString()} of{' '}
            {totalRows.toLocaleString()} distribution rows
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label
                htmlFor="distribution-page-size"
                className="text-sm text-slate-600 dark:text-slate-300"
              >
                Rows per page
              </label>
              <select
                id="distribution-page-size"
                value={pageSize}
                onChange={event => setPageSize(Number(event.target.value))}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                {PAGE_SIZE_OPTIONS.map(size => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPageIndex(0)}
                disabled={safePageIndex === 0}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                First
              </button>
              <button
                type="button"
                onClick={() => setPageIndex(prev => Math.max(prev - 1, 0))}
                disabled={safePageIndex === 0}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Previous
              </button>
              <span className="text-sm text-slate-600 dark:text-slate-300">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPageIndex(prev => Math.min(prev + 1, lastPageIndex))}
                disabled={safePageIndex >= lastPageIndex}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Next
              </button>
              <button
                type="button"
                onClick={() => setPageIndex(lastPageIndex)}
                disabled={safePageIndex >= lastPageIndex}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Last
              </button>
            </div>
          </div>
        </div>
      )}

      {activeDynamicAccountId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-5xl overflow-hidden rounded-lg bg-white shadow-xl dark:bg-slate-900"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Preset builder</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Configure preset-based distributions for account {activeDynamicAccountId}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveDynamicAccountId(null)}
                className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100 dark:focus-visible:ring-offset-slate-900"
                aria-label="Close preset builder"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="max-h-[80vh] overflow-y-auto p-6">
              <RatioAllocationManager
                initialSourceAccountId={activeDynamicAccountId}
                applyToSourceAccountIds={dynamicPresetAccountIds}
                onPresetApplied={handleDynamicPresetApplied}
                onDone={() => setActiveDynamicAccountId(null)}
                targetCatalog={operationTargetCatalog}
                resolveCanonicalTargetId={resolveOperationCanonicalTargetId}
                targetLabel="Target operation"
                targetPlaceholder="Select target operation"
                targetEmptyLabel="No operations available"
                presetContext="distribution"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DistributionTable;
