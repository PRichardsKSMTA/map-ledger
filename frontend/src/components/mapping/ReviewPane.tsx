import React, { useCallback, useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, Download, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import {
  selectAccounts,
  selectAccountsByPeriod,
  useMappingStore,
} from '../../store/mappingStore';
import {
  type DistributionOperationCatalogItem,
  useDistributionStore,
} from '../../store/distributionStore';
import { useChartOfAccountsStore } from '../../store/chartOfAccountsStore';
import type {
  DistributionOperationShare,
  DistributionRow,
  GLAccountEntityBreakdown,
  GLAccountMappingRow,
} from '../../types';
import { useRatioAllocationStore } from '../../store/ratioAllocationStore';
import { useOrganizationStore } from '../../store/organizationStore';
import { useClientStore } from '../../store/clientStore';
import { formatCurrencyAmount } from '../../utils/currency';
import { getOperationShareFraction } from '../../utils/distributionActivity';
import {
  buildOperationScoaActivitySheets,
  exportOperationScoaWorkbook,
} from '../../utils/exportScoaActivity';
import { formatPeriodDate } from '../../utils/period';

const normalizeOperationKey = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed.toUpperCase() : '';
};

type OperationReviewItem = {
  row: DistributionRow;
  share: DistributionOperationShare;
  allocatedAmount: number;
};

/** Grouping of items by individual account (SCoA account number) */
interface AccountGroupItem {
  accountId: string;
  description: string;
  items: OperationReviewItem[];
}

/** Grouping of accounts by SUB_CATEGORY with CORE_ACCOUNT as the display ID */
interface SubCategoryGroup {
  subCategory: string;
  coreAccount: string;
  accounts: AccountGroupItem[];
}

interface OperationReviewEntry {
  operation: DistributionOperationCatalogItem;
  items: OperationReviewItem[];
  subCategoryGroups: SubCategoryGroup[];
}

/** Entity breakdown with aggregated source accounts */
interface EntitySourceGroup {
  entityId: string;
  entityName: string;
  total: number;
  sources: {
    accountId: string;
    accountName: string;
    amount: number;
  }[];
}

const resolveEntityBreakdowns = (account: GLAccountMappingRow): GLAccountEntityBreakdown[] => {
  if (account.entities && account.entities.length > 0) {
    return account.entities;
  }

  const fallbackId = account.entityId?.trim() || account.id;
  const fallbackName = account.entityName?.trim() || account.entityId?.trim() || 'Unknown Entity';
  return [
    {
      id: fallbackId,
      entity: fallbackName,
      balance: account.netChange,
    },
  ];
};

const ToggleIcon = ({ isOpen }: { isOpen: boolean }) =>
  isOpen ? (
    <ChevronDown aria-hidden className="h-4 w-4 text-slate-500 transition" />
  ) : (
    <ChevronRight aria-hidden className="h-4 w-4 text-slate-500 transition" />
  );

const ReviewPane = () => {
  const accounts = useMappingStore(selectAccounts);
  const accountsByPeriod = useMappingStore(selectAccountsByPeriod);
  const chartOptions = useChartOfAccountsStore(state => state.options);
  const { selectedPeriod, isProcessing, calculateAllocations } =
    useRatioAllocationStore(state => ({
      selectedPeriod: state.selectedPeriod,
      isProcessing: state.isProcessing,
      calculateAllocations: state.calculateAllocations,
    }));
  const selectedPeriodLabel =
    selectedPeriod ? formatPeriodDate(selectedPeriod) || selectedPeriod : null;
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const financialTargetLookup = useMemo(() => {
    const lookup = new Map<string, boolean>();
    chartOptions.forEach(option => {
      if (option.isFinancial === null || option.isFinancial === undefined) {
        return;
      }
      const idKey = option.id?.trim();
      const valueKey = option.value?.trim();
      if (idKey) {
        lookup.set(idKey, option.isFinancial);
      }
      if (valueKey) {
        lookup.set(valueKey, option.isFinancial);
      }
    });
    return lookup;
  }, [chartOptions]);

  const isFinancialTarget = useCallback(
    (targetId?: string | null) => {
      const normalized = targetId?.trim();
      if (!normalized) {
        return true;
      }
      const flag = financialTargetLookup.get(normalized);
      return flag !== false;
    },
    [financialTargetLookup],
  );

  const activeClientId = useClientStore(state => state.activeClientId);
  const companies = useOrganizationStore(state => state.companies);
  const distributionRows = useDistributionStore(state => state.rows);
  const reviewDistributionRows = useMemo(
    () => distributionRows.filter(row => isFinancialTarget(row.accountId)),
    [distributionRows, isFinancialTarget],
  );

  const distributedRows = useMemo(
    () => reviewDistributionRows.filter(row => row.status === 'Distributed'),
    [reviewDistributionRows],
  );

  // State for nested accordion expansion
  const [expandedSubCategories, setExpandedSubCategories] = useState<Record<string, boolean>>({});
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [expandedEntities, setExpandedEntities] = useState<Record<string, boolean>>({});

  // Create a lookup from mappingRowId to GLAccountMappingRow for entity details
  // Use accountsByPeriod to include all accounts across all periods, not just the selected period
  const mappingRowLookup = useMemo(() => {
    const lookup = new Map<string, GLAccountMappingRow>();
    accountsByPeriod.forEach(accountsInPeriod => {
      accountsInPeriod.forEach(account => {
        lookup.set(account.id, account);
      });
    });
    return lookup;
  }, [accountsByPeriod]);

  // Get sorted list of all GL months and build a lookup for activity by account+entity+glMonth
  const { sortedGlMonths, activityByAccountPeriod } = useMemo(() => {
    const periods = Array.from(accountsByPeriod.keys())
      .filter(period => period !== 'unknown')
      .sort()
      .reverse(); // Descending order - most recent first

    // Build a lookup: accountId__entityId__glMonth -> netChange
    const lookup = new Map<string, number>();
    accountsByPeriod.forEach((accountsInPeriod, period) => {
      if (period === 'unknown') return;
      accountsInPeriod.forEach(account => {
        const key = `${account.accountId}__${account.entityId ?? ''}__${period}`;
        lookup.set(key, account.netChange);
      });
    });

    return { sortedGlMonths: periods, activityByAccountPeriod: lookup };
  }, [accountsByPeriod]);

  // Helper to get activity for a specific account/entity/period combination
  const getActivityForPeriod = useCallback(
    (row: DistributionRow, share: DistributionOperationShare, glMonth: string): number => {
      const mappingRow = mappingRowLookup.get(row.mappingRowId);
      if (!mappingRow) return 0;

      const key = `${mappingRow.accountId}__${mappingRow.entityId ?? ''}__${glMonth}`;
      const baseActivity = activityByAccountPeriod.get(key) ?? 0;

      // Apply the share fraction to get the allocated amount for this operation
      const fraction = getOperationShareFraction(row, share);
      if (!Number.isFinite(fraction)) return 0;

      return Number.isFinite(baseActivity) ? baseActivity * fraction : 0;
    },
    [mappingRowLookup, activityByAccountPeriod],
  );

  // Helper to get entity-level activity for a specific GL month
  const getEntityActivityForPeriod = useCallback(
    (
      row: DistributionRow,
      share: DistributionOperationShare,
      entityGroup: EntitySourceGroup,
      glMonth: string,
      allEntityGroups: EntitySourceGroup[],
    ): number => {
      // Get the total activity for this period
      const periodActivity = getActivityForPeriod(row, share, glMonth);
      if (Math.abs(periodActivity) < 1e-6) return 0;

      // Calculate the entity's proportional share based on the entity groups
      const totalEntityAmount = allEntityGroups.reduce(
        (sum, group) => sum + Math.abs(group.total),
        0,
      );
      if (totalEntityAmount < 1e-6) return 0;

      const entityWeight = Math.abs(entityGroup.total) / totalEntityAmount;
      const sign = periodActivity >= 0 ? 1 : -1;
      return sign * Math.abs(periodActivity) * entityWeight;
    },
    [getActivityForPeriod],
  );

  // Build entity source groups for a given distribution row, scaled to the allocated activity
  const getEntitySourceGroups = (row: DistributionRow, allocatedAmount: number): EntitySourceGroup[] => {
    const mappingRow = mappingRowLookup.get(row.mappingRowId);
    const normalizedAmount = Number.isFinite(allocatedAmount) ? allocatedAmount : 0;

    // If we cannot find the mapping row, show a single bucket with the allocated amount
    if (!mappingRow) {
      return [
        {
          entityId: row.id,
          entityName: 'Unassigned Entity',
          total: normalizedAmount,
          sources: [
            {
              accountId: row.accountId,
              accountName: row.description,
              amount: normalizedAmount,
            },
          ],
        },
      ];
    }

    const entityBreakdowns = resolveEntityBreakdowns(mappingRow);

    const totalBalance = entityBreakdowns.reduce(
      (sum, breakdown) => sum + Math.abs(breakdown.balance),
      0,
    );
    const allocatedMagnitude = Math.abs(normalizedAmount);
    const proportionalBasis = totalBalance || Math.abs(mappingRow.netChange) || allocatedMagnitude;
    const sign = normalizedAmount >= 0 ? 1 : -1;
    const fallbackProportion =
      entityBreakdowns.length > 0 ? 1 / entityBreakdowns.length : 1;

    return entityBreakdowns.map(breakdown => {
      const weight =
        proportionalBasis > 0
          ? Math.abs(breakdown.balance) / proportionalBasis
          : fallbackProportion;
      const entityAmount = sign * allocatedMagnitude * weight;
      return {
        entityId: breakdown.id,
        entityName: breakdown.entity || mappingRow.entityName || 'Unknown Entity',
        total: entityAmount,
        sources: [
          {
            accountId: mappingRow.accountId,
            accountName: mappingRow.accountName,
            amount: entityAmount,
          },
        ],
      };
    });
  };

  const toggleSubCategoryExpansion = (subCategoryKey: string) => {
    setExpandedSubCategories(current => ({
      ...current,
      [subCategoryKey]: !current[subCategoryKey],
    }));
  };

  const toggleRowExpansion = (rowKey: string) => {
    setExpandedRows(current => ({
      ...current,
      [rowKey]: !current[rowKey],
    }));
  };

  const toggleEntityExpansion = (entityKey: string) => {
    setExpandedEntities(current => ({
      ...current,
      [entityKey]: !current[entityKey],
    }));
  };

  const clientOperations = useMemo<DistributionOperationCatalogItem[]>(() => {
    const map = new Map<string, DistributionOperationCatalogItem>();
    companies.forEach(company => {
      company.clients.forEach(client => {
        if (activeClientId && client.id !== activeClientId) {
          return;
        }
        client.operations.forEach(operation => {
          const key = normalizeOperationKey(operation.code ?? operation.id);
          if (!key) {
            return;
          }
          if (map.has(key)) {
            return;
          }
          const code = (operation.code || operation.id || '').trim();
          const name = operation.name?.trim() || code || key;
          map.set(key, {
            id: code || key,
            code: code || key,
            name,
          });
        });
      });
    });
    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [companies, activeClientId]);

  // Build lookup from account number to SubCategory and CoreAccount
  const accountMetaLookup = useMemo(() => {
    const lookup = new Map<string, { subCategory: string; coreAccount: string }>();
    chartOptions.forEach(option => {
      const accountNumber = option.accountNumber?.trim() || option.value?.trim();
      if (!accountNumber) return;
      const subCategory = option.subCategory?.trim() || 'Uncategorized';
      const coreAccount = option.coreAccount?.trim() || accountNumber;
      lookup.set(accountNumber, { subCategory, coreAccount });
    });
    return lookup;
  }, [chartOptions]);

  // Helper to calculate total allocated amount across all GL months for a row/share
  // This is period-independent and ensures rows aren't filtered out based on selected period
  const getTotalAllocatedActivityAcrossAllPeriods = useCallback(
    (row: DistributionRow, share: DistributionOperationShare): number => {
      return sortedGlMonths.reduce((total, glMonth) => {
        return total + getActivityForPeriod(row, share, glMonth);
      }, 0);
    },
    [sortedGlMonths, getActivityForPeriod],
  );

  const operationReviewEntries = useMemo<OperationReviewEntry[]>(() => {
    const entries = new Map<string, OperationReviewEntry>();
    clientOperations.forEach(operation => {
      const key = normalizeOperationKey(operation.code ?? operation.id);
      if (!key) {
        return;
      }
      entries.set(key, { operation, items: [], subCategoryGroups: [] });
    });

    distributedRows.forEach(row => {
      row.operations.forEach(share => {
        const key = normalizeOperationKey(share.code ?? share.id ?? share.name);
        if (!key) {
          return;
        }
        // Use total activity across all GL months (period-independent) for filtering
        // This ensures items are included if they have activity in ANY period
        const allocatedAmount = getTotalAllocatedActivityAcrossAllPeriods(row, share);
        if (Math.abs(allocatedAmount) < 1e-6) {
          return;
        }
        let entry = entries.get(key);
        if (!entry) {
          const code = share.code?.trim() || share.id?.trim() || share.name?.trim() || key;
          const name = share.name?.trim() || code || key;
          entry = {
            operation: { id: share.id || code, code, name },
            items: [],
            subCategoryGroups: [],
          };
          entries.set(key, entry);
        }
        entry.items.push({ row, share, allocatedAmount });
      });
    });

    const sortedEntries = Array.from(entries.values()).sort((a, b) =>
      a.operation.code.localeCompare(b.operation.code),
    );

    // Build subCategoryGroups for each entry
    sortedEntries.forEach(entry => {
      entry.items.sort((a, b) => a.row.accountId.localeCompare(b.row.accountId));

      // Group items by SubCategory
      const subCategoryMap = new Map<string, { coreAccount: string; accountsMap: Map<string, AccountGroupItem> }>();

      entry.items.forEach(item => {
        const accountId = item.row.accountId;
        const meta = accountMetaLookup.get(accountId);
        const subCategory = meta?.subCategory || 'Uncategorized';
        const coreAccount = meta?.coreAccount || accountId;

        let subCatGroup = subCategoryMap.get(subCategory);
        if (!subCatGroup) {
          subCatGroup = { coreAccount, accountsMap: new Map() };
          subCategoryMap.set(subCategory, subCatGroup);
        }

        let accountGroup = subCatGroup.accountsMap.get(accountId);
        if (!accountGroup) {
          accountGroup = {
            accountId,
            description: item.row.description,
            items: [],
          };
          subCatGroup.accountsMap.set(accountId, accountGroup);
        }
        accountGroup.items.push(item);
      });

      // Convert maps to arrays and sort
      entry.subCategoryGroups = Array.from(subCategoryMap.entries())
        .map(([subCategory, group]) => ({
          subCategory,
          coreAccount: group.coreAccount,
          accounts: Array.from(group.accountsMap.values()).sort((a, b) =>
            a.accountId.localeCompare(b.accountId),
          ),
        }))
        .sort((a, b) => a.subCategory.localeCompare(b.subCategory));
    });

    return sortedEntries;
  }, [clientOperations, distributedRows, getTotalAllocatedActivityAcrossAllPeriods, accountMetaLookup]);

  const [isExporting, setIsExporting] = useState(false);

  const handleRunChecks = async () => {
    if (selectedPeriod) {
      await calculateAllocations(selectedPeriod);
    }
    setStatusMessage('Validation checks passed. You can publish your mappings.');
  };

  const handleExportScoaActivity = async () => {
    setIsExporting(true);
    try {
      const sheets = buildOperationScoaActivitySheets(accounts, reviewDistributionRows);
      if (!sheets.length) {
        setStatusMessage('No SCoA activity is available for export.');
        return;
      }
      await exportOperationScoaWorkbook(sheets);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to export SCoA activity.';
      setStatusMessage(message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        {statusMessage && (
          <div
            className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 dark:border-blue-500/60 dark:bg-blue-500/10 dark:text-blue-100"
            role="status"
          >
            {statusMessage}
          </div>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {selectedPeriodLabel
                ? `Previewing allocations for ${selectedPeriodLabel}.`
                : 'Choose a reporting period to run allocation checks.'}
            </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleRunChecks}
              className="inline-flex items-center rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-slate-600 dark:text-gray-200 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-900"
            >
              {isProcessing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Run checks
            </button>
            <button
              type="button"
              onClick={handleExportScoaActivity}
              disabled={isExporting}
              className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-500 dark:hover:bg-blue-400 dark:focus-visible:ring-offset-slate-900"
            >
              {isExporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Download SCoA export
            </button>
          </div>
        </div>
      </div>

      {operationReviewEntries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white/60 px-6 py-12 text-center text-sm text-slate-500 shadow-sm dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-400">
          No operations are configured for the selected client yet. Choose a client with defined operations to review distributed activity.
        </div>
      ) : (
        <div className="space-y-6">
            {operationReviewEntries.map(entry => {
              return (
                <Card key={entry.operation.code}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Operation {entry.operation.code}
                      </h3>
                      {entry.operation.name && entry.operation.name !== entry.operation.code && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">{entry.operation.name}</p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="min-w-full table-compact divide-y divide-slate-200 text-sm dark:divide-slate-700">
                      <thead className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        <tr>
                          <th className="w-8 px-2 py-2" aria-label="Expand row" />
                          <th className="px-3 py-2 text-left">Account</th>
                          <th className="px-3 py-2 text-left">Description</th>
                          {sortedGlMonths.map(glMonth => (
                            <th key={glMonth} className="whitespace-nowrap px-3 py-2 text-right">
                              {glMonth}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {entry.subCategoryGroups.length === 0 ? (
                          <tr>
                            <td
                              colSpan={3 + sortedGlMonths.length}
                              className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-300"
                            >
                              No distributed activity has been mapped to this operation yet.
                            </td>
                          </tr>
                        ) : (
                          <>
                          {entry.subCategoryGroups.map(subCatGroup => {
                            const subCatKey = `${entry.operation.code}-${subCatGroup.subCategory}`;
                            const isSubCatExpanded = expandedSubCategories[subCatKey] ?? false;

                            // Calculate totals for sub-category row by summing all accounts' items
                            const getSubCatActivityForPeriod = (glMonth: string): number => {
                              return subCatGroup.accounts.reduce((sum, accountGroup) => {
                                return sum + accountGroup.items.reduce((itemSum, { row, share }) => {
                                  return itemSum + getActivityForPeriod(row, share, glMonth);
                                }, 0);
                              }, 0);
                            };

                            return (
                              <React.Fragment key={subCatKey}>
                                {/* Sub-Category row (top level) */}
                                <tr className="bg-white text-slate-900 odd:bg-slate-50 even:bg-white dark:bg-slate-900 dark:text-slate-100 dark:odd:bg-slate-900/70 dark:even:bg-slate-900/55">
                                  <td className="px-2 py-2">
                                    <button
                                      type="button"
                                      onClick={() => toggleSubCategoryExpansion(subCatKey)}
                                      aria-expanded={isSubCatExpanded}
                                      aria-label={`${isSubCatExpanded ? 'Collapse' : 'Expand'} ${subCatGroup.subCategory}`}
                                      className="flex h-6 w-6 items-center justify-center rounded transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:hover:bg-slate-700 dark:focus-visible:ring-offset-slate-900"
                                    >
                                      <ToggleIcon isOpen={isSubCatExpanded} />
                                    </button>
                                  </td>
                                  <td className="max-w-[8rem] truncate px-3 py-2 font-semibold text-slate-900 dark:text-slate-100">
                                    {subCatGroup.coreAccount}
                                  </td>
                                  <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{subCatGroup.subCategory}</td>
                                  {sortedGlMonths.map(glMonth => (
                                    <td
                                      key={glMonth}
                                      className="whitespace-nowrap px-3 py-2 text-right font-mono font-bold text-slate-900 dark:text-slate-100"
                                    >
                                      {formatCurrencyAmount(getSubCatActivityForPeriod(glMonth))}
                                    </td>
                                  ))}
                                </tr>

                                {/* Expanded: Individual accounts within sub-category */}
                                {isSubCatExpanded &&
                                  subCatGroup.accounts.map(accountGroup => {
                                    const accountKey = `${subCatKey}-${accountGroup.accountId}`;
                                    const isAccountExpanded = expandedRows[accountKey] ?? false;

                                    // Calculate totals for account row
                                    const getAccountActivityForPeriod = (glMonth: string): number => {
                                      return accountGroup.items.reduce((sum, { row, share }) => {
                                        return sum + getActivityForPeriod(row, share, glMonth);
                                      }, 0);
                                    };

                                    return (
                                      <React.Fragment key={accountKey}>
                                        {/* Individual account row */}
                                        <tr className="bg-slate-50/80 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-700/50">
                                          <td className="py-1.5 px-2">
                                            <div className="flex items-center">
                                              <div className="ml-[11px] h-6 border-l-2 border-slate-300 dark:border-slate-600" />
                                              <button
                                                type="button"
                                                onClick={() => toggleRowExpansion(accountKey)}
                                                aria-expanded={isAccountExpanded}
                                                aria-label={`${isAccountExpanded ? 'Collapse' : 'Expand'} ${accountGroup.accountId}`}
                                                className="ml-2 flex h-6 w-6 items-center justify-center rounded transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                              >
                                                <ToggleIcon isOpen={isAccountExpanded} />
                                              </button>
                                            </div>
                                          </td>
                                          <td className="px-3 py-1.5 pl-0 text-sm font-medium text-slate-900 dark:text-white">
                                            {accountGroup.accountId}
                                          </td>
                                          <td className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300">
                                            {accountGroup.description}
                                          </td>
                                          {sortedGlMonths.map(glMonth => (
                                            <td
                                              key={glMonth}
                                              className="whitespace-nowrap px-3 py-1.5 text-right font-mono text-sm font-semibold text-slate-700 dark:text-slate-200"
                                            >
                                              {formatCurrencyAmount(getAccountActivityForPeriod(glMonth))}
                                            </td>
                                          ))}
                                        </tr>

                                        {/* Expanded: Entity breakdown for account - aggregated across all items */}
                                        {isAccountExpanded &&
                                          (() => {
                                            // Aggregate entity groups across all items in this account group
                                            const aggregatedEntities = new Map<string, {
                                              entityId: string;
                                              entityName: string;
                                              items: { row: DistributionRow; share: DistributionOperationShare; allocatedAmount: number; entityGroup: EntitySourceGroup; allEntityGroups: EntitySourceGroup[] }[];
                                            }>();

                                            accountGroup.items.forEach(({ row, share, allocatedAmount }) => {
                                              const entityGroups = getEntitySourceGroups(row, allocatedAmount);
                                              entityGroups.forEach(entityGroup => {
                                                let aggregated = aggregatedEntities.get(entityGroup.entityId);
                                                if (!aggregated) {
                                                  aggregated = {
                                                    entityId: entityGroup.entityId,
                                                    entityName: entityGroup.entityName,
                                                    items: [],
                                                  };
                                                  aggregatedEntities.set(entityGroup.entityId, aggregated);
                                                }
                                                aggregated.items.push({ row, share, allocatedAmount, entityGroup, allEntityGroups: entityGroups });
                                              });
                                            });

                                            const sortedEntities = Array.from(aggregatedEntities.values()).sort((a, b) =>
                                              a.entityName.localeCompare(b.entityName),
                                            );

                                            return sortedEntities.map(aggregatedEntity => {
                                              const entityKey = `${accountKey}-${aggregatedEntity.entityId}`;
                                              const isEntityExpanded = expandedEntities[entityKey] ?? false;

                                              // Calculate aggregated entity activity for each period
                                              const getAggregatedEntityActivityForPeriod = (glMonth: string): number => {
                                                return aggregatedEntity.items.reduce((sum, { row, share, entityGroup, allEntityGroups }) => {
                                                  return sum + getEntityActivityForPeriod(row, share, entityGroup, glMonth, allEntityGroups);
                                                }, 0);
                                              };

                                              return (
                                                <React.Fragment key={entityKey}>
                                                  {/* Entity row */}
                                                  <tr className="bg-slate-100/50 dark:bg-slate-700/30">
                                                    <td className="py-1 px-2">
                                                      <div className="flex items-center">
                                                        <div className="ml-[37px] h-5 border-l-2 border-slate-400 dark:border-slate-500" />
                                                        <button
                                                          type="button"
                                                          onClick={() => toggleEntityExpansion(entityKey)}
                                                          className="ml-2 flex h-5 w-5 items-center justify-center rounded transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                                        >
                                                          <ToggleIcon isOpen={isEntityExpanded} />
                                                        </button>
                                                      </div>
                                                    </td>
                                                    <td colSpan={2} className="px-3 py-1 pl-8 text-sm font-medium text-slate-700 dark:text-slate-300">
                                                      {aggregatedEntity.entityName}
                                                    </td>
                                                    {sortedGlMonths.map(glMonth => (
                                                      <td
                                                        key={glMonth}
                                                        className="whitespace-nowrap px-3 py-1 text-right font-mono text-sm font-normal text-slate-600 dark:text-slate-300"
                                                      >
                                                        {formatCurrencyAmount(getAggregatedEntityActivityForPeriod(glMonth))}
                                                      </td>
                                                    ))}
                                                  </tr>

                                                  {/* Source items (distribution rows contributing to this entity) */}
                                                  {isEntityExpanded &&
                                                    aggregatedEntity.items.map(({ row, share, entityGroup, allEntityGroups }, sourceIndex) => (
                                                      <tr
                                                        key={`${entityKey}-source-${row.id}-${sourceIndex}`}
                                                        className="bg-slate-200/50 dark:bg-slate-600/30"
                                                      >
                                                        <td className="py-1 px-2">
                                                          <div className="ml-[63px] h-4 border-l-2 border-slate-400 dark:border-slate-500" />
                                                        </td>
                                                        <td className="px-3 py-1 pl-12 text-xs font-medium text-slate-600 dark:text-slate-400">
                                                          {row.entityAccountId || row.accountId}
                                                        </td>
                                                        <td className="px-3 py-1 text-xs text-slate-500 dark:text-slate-400">
                                                          {row.entityAccountName || row.description}
                                                        </td>
                                                        {sortedGlMonths.map(glMonth => (
                                                          <td
                                                            key={glMonth}
                                                            className="whitespace-nowrap px-3 py-1 text-right font-mono text-xs font-normal text-slate-500 dark:text-slate-400"
                                                          >
                                                            {formatCurrencyAmount(
                                                              getEntityActivityForPeriod(row, share, entityGroup, glMonth, allEntityGroups),
                                                            )}
                                                          </td>
                                                        ))}
                                                      </tr>
                                                    ))}
                                                </React.Fragment>
                                              );
                                            });
                                          })()}
                                      </React.Fragment>
                                    );
                                  })}
                              </React.Fragment>
                            );
                          })}
                          {/* Total row for operation */}
                          <tr className="bg-slate-100 font-semibold shadow-[inset_0_4px_0_0_rgb(148,163,184)] dark:bg-slate-800 dark:shadow-[inset_0_4px_0_0_rgb(100,116,139)]">
                            <td className="!pb-3 !pt-5 px-2" />
                            <td className="!pb-3 !pt-5 px-3 text-slate-900 dark:text-white">TOTAL</td>
                            <td className="!pb-3 !pt-5 px-3 text-slate-600 dark:text-slate-300" />
                            {sortedGlMonths.map(glMonth => {
                              const periodTotal = entry.subCategoryGroups.reduce((sum, subCatGroup) => {
                                return sum + subCatGroup.accounts.reduce((accountSum, accountGroup) => {
                                  return accountSum + accountGroup.items.reduce((itemSum, { row, share }) => {
                                    return itemSum + getActivityForPeriod(row, share, glMonth);
                                  }, 0);
                                }, 0);
                              }, 0);
                              return (
                                <td
                                  key={glMonth}
                                  className="!pb-3 !pt-5 whitespace-nowrap px-3 text-right font-mono font-bold text-slate-900 dark:text-white"
                                >
                                  {formatCurrencyAmount(periodTotal)}
                                </td>
                              );
                            })}
                          </tr>
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ReviewPane;
