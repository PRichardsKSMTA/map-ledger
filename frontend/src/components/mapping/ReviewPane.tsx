import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, Download, Loader2 } from 'lucide-react';
import {
  selectAccounts,
  selectAccountsByPeriod,
  selectAllPeriodDistributionTargets,
  selectOperationalBasisAccounts,
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
  DistributionSourceSummary,
} from '../../types';
import { useRatioAllocationStore } from '../../store/ratioAllocationStore';
import { useOrganizationStore } from '../../store/organizationStore';
import { useClientStore } from '../../store/clientStore';
import { formatCurrencyAmount, formatCurrencyWhole } from '../../utils/currency';
import {
  buildOperationScoaActivitySheets,
  exportOperationScoaWorkbook,
} from '../../utils/exportScoaActivity';
import { formatPeriodDate } from '../../utils/period';
import {
  type DetailedSubCategoryRow,
  buildDetailedStatementData,
  calculateReviewMetrics,
  findMilesDenominatorAccounts,
  formatCostPerMile,
  formatGlMonth,
  formatPercentage,
  getMilesByPeriod,
  getNetIncomeMetricsByPeriod,
  getRevenueExpenseTrend,
} from '../../utils/detailedStatementUtils';
import SubCategoryDetailModal from './SubCategoryDetailModal';
import ReviewSummaryCards from './ReviewSummaryCards';
import DualLineChart from '../ui/DualLineChart';

const normalizeOperationKey = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed.toUpperCase() : '';
};

const ReviewPane = () => {
  const accounts = useMappingStore(selectAccounts);
  const accountsByPeriod = useMappingStore(selectAccountsByPeriod);
  const chartOptions = useChartOfAccountsStore(state => state.options);
  const operationalBasisAccounts = useMappingStore(selectOperationalBasisAccounts);
  const activeClientId = useClientStore(state => state.activeClientId);
  const companies = useOrganizationStore(state => state.companies);
  const { selectedPeriod, isProcessing, calculateAllocations } = useRatioAllocationStore(state => ({
    selectedPeriod: state.selectedPeriod,
    isProcessing: state.isProcessing,
    calculateAllocations: state.calculateAllocations,
  }));
  const selectedPeriodLabel =
    selectedPeriod ? formatPeriodDate(selectedPeriod) || selectedPeriod : null;
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [selectedOperationCode, setSelectedOperationCode] = useState<string | null>(null);

  // Get available operations for the current client
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

  // Auto-select first operation when operations become available
  useEffect(() => {
    if (clientOperations.length > 0 && !selectedOperationCode) {
      setSelectedOperationCode(clientOperations[0].code);
    }
  }, [clientOperations, selectedOperationCode]);

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

  const costTypeLookup = useMemo(() => {
    const lookup = new Map<string, string | null>();
    chartOptions.forEach(option => {
      const idKey = option.id?.trim();
      const valueKey = option.value?.trim();
      const costType = option.costType?.trim() ?? null;
      if (idKey) {
        lookup.set(idKey, costType);
      }
      if (valueKey) {
        lookup.set(valueKey, costType);
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

  const isBalanceSheetAccount = useCallback(
    (targetId?: string | null) => {
      const normalized = targetId?.trim();
      if (!normalized) {
        return false;
      }
      const costType = costTypeLookup.get(normalized);
      return costType === 'Balance Sheet';
    },
    [costTypeLookup],
  );

  const distributionStoreRows = useDistributionStore(state => state.rows);
  const allPeriodDistributionTargets = useMappingStore(selectAllPeriodDistributionTargets);

  // Build a lookup from period-independent key to distribution row operations
  const distributionOperationsLookup = useMemo(() => {
    const lookup = new Map<
      string,
      {
        operations: DistributionOperationShare[];
        type: DistributionRow['type'];
        status: DistributionRow['status'];
        presetId?: string | null;
        notes?: string;
      }
    >();
    distributionStoreRows.forEach(row => {
      const key = `${row.entityAccountId ?? ''}__${row.accountId}`;
      if (row.operations.length > 0 || row.status === 'Distributed') {
        lookup.set(key, {
          operations: row.operations,
          type: row.type,
          status: row.status,
          presetId: row.presetId,
          notes: row.notes,
        });
      }
    });
    return lookup;
  }, [distributionStoreRows]);

  // Build period-independent distribution rows
  const reviewDistributionRows = useMemo(() => {
    const summaryByKey = new Map<string, DistributionSourceSummary>();
    allPeriodDistributionTargets.forEach(summary => {
      const key = `${summary.entityAccountId ?? ''}__${summary.accountId}`;
      if (!summaryByKey.has(key)) {
        summaryByKey.set(key, summary);
      }
    });

    const rows: DistributionRow[] = [];
    summaryByKey.forEach((summary, key) => {
      const existingOps = distributionOperationsLookup.get(key);
      const row: DistributionRow = {
        id: summary.id,
        mappingRowId: summary.mappingRowId,
        entityAccountId: summary.entityAccountId,
        entityAccountName: summary.entityAccountName,
        accountId: summary.accountId,
        description: summary.description,
        activity: summary.mappedAmount,
        type: existingOps?.type ?? 'direct',
        operations: existingOps?.operations ?? [],
        presetId: existingOps?.presetId ?? null,
        notes: existingOps?.notes,
        status: existingOps?.status ?? 'Undistributed',
      };
      rows.push(row);
    });

    return rows.filter(
      row => isFinancialTarget(row.accountId) && !isBalanceSheetAccount(row.accountId),
    );
  }, [
    allPeriodDistributionTargets,
    distributionOperationsLookup,
    isFinancialTarget,
    isBalanceSheetAccount,
  ]);

  const distributedRows = useMemo(
    () => reviewDistributionRows.filter(row => row.status === 'Distributed'),
    [reviewDistributionRows],
  );

  // Get sorted list of all GL months and build activity lookup
  const { sortedGlMonths, activityByAccountPeriod } = useMemo(() => {
    const periods = Array.from(accountsByPeriod.keys())
      .filter(period => period !== 'unknown')
      .sort()
      .reverse();

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

  // Get miles data for cost per mile calculations (sum of all miles accounts)
  const milesAccounts = useMemo(
    () => findMilesDenominatorAccounts(operationalBasisAccounts),
    [operationalBasisAccounts],
  );
  const milesByPeriod = useMemo(() => getMilesByPeriod(milesAccounts), [milesAccounts]);
  const hasMilesData = milesByPeriod !== null && Object.keys(milesByPeriod).length > 0;

  // Build detailed statement data grouped by category, filtered by selected operation
  const detailedStatementData = useMemo(() => {
    return buildDetailedStatementData(
      distributedRows,
      chartOptions,
      activityByAccountPeriod,
      sortedGlMonths,
      operationalBasisAccounts,
      selectedOperationCode,
    );
  }, [distributedRows, chartOptions, activityByAccountPeriod, sortedGlMonths, operationalBasisAccounts, selectedOperationCode]);

  // Calculate review metrics for summary cards
  const reviewMetrics = useMemo(() => {
    return calculateReviewMetrics(detailedStatementData, milesByPeriod, 95.0);
  }, [detailedStatementData, milesByPeriod]);

  // Get revenue/expense trend data for dual-line chart
  const trendData = useMemo(() => {
    return getRevenueExpenseTrend(detailedStatementData);
  }, [detailedStatementData]);

  // Calculate net income metrics by period for the summary row
  const netIncomeMetricsByPeriod = useMemo(() => {
    return getNetIncomeMetricsByPeriod(detailedStatementData, milesByPeriod);
  }, [detailedStatementData, milesByPeriod]);

  // Get the most recent month for display
  const mostRecentMonth = sortedGlMonths[0] ?? '';

  // Format period range for trend chart title
  const periodRangeLabel = useMemo(() => {
    if (sortedGlMonths.length === 0) return '';
    const oldest = sortedGlMonths[sortedGlMonths.length - 1];
    const newest = sortedGlMonths[0];
    const formatMonth = (m: string) => new Date(m).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    return `${formatMonth(oldest)} - ${formatMonth(newest)}`;
  }, [sortedGlMonths]);

  // Get selected operation label for display
  const selectedOperationLabel = useMemo(() => {
    if (!selectedOperationCode) return null;
    const op = clientOperations.find(o => o.code === selectedOperationCode);
    return op ? `${op.code} - ${op.name}` : selectedOperationCode;
  }, [selectedOperationCode, clientOperations]);

  // Modal state
  const [selectedSubCategory, setSelectedSubCategory] = useState<DetailedSubCategoryRow | null>(
    null,
  );

  const handleSubCategoryClick = (subCategory: DetailedSubCategoryRow) => {
    setSelectedSubCategory(subCategory);
  };

  const handleCloseModal = () => {
    setSelectedSubCategory(null);
  };

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

  // Limit displayed months to 5 most recent
  const displayMonths = sortedGlMonths.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Review Summary Cards */}
      <ReviewSummaryCards metrics={reviewMetrics} mostRecentMonth={mostRecentMonth} />

      {/* Revenue/Expense Trend Chart */}
      {trendData.labels.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h3 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">
            {sortedGlMonths.length}-Month Financial Trend
          </h3>
          <div className="flex justify-center">
            <DualLineChart
              revenueData={trendData.revenueData}
              expenseData={trendData.expenseData}
              labels={trendData.labels}
              width={1100}
              height={280}
            />
          </div>
        </div>
      )}

      {/* Header Actions */}
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

      {/* Detailed Statement Table */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        {/* Table Header with Operation Dropdown */}
        <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-4 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Detailed Statement For Operation
            </h2>
            {/* Operation Dropdown */}
            {clientOperations.length > 0 && (
              <div className="relative">
                <select
                  value={selectedOperationCode ?? ''}
                  onChange={e => setSelectedOperationCode(e.target.value || null)}
                  className="appearance-none rounded-md border border-slate-300 bg-white py-1.5 pl-3 pr-8 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  {clientOperations.map(op => (
                    <option key={op.code} value={op.code}>
                      {op.code}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              </div>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              % of Rev
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-slate-400" />
              Per Mile
            </span>
          </div>
        </div>

        {/* Show message when loading or empty */}
        {clientOperations.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
            No operations are configured for the selected client yet. Configure operations to view the detailed statement.
          </div>
        ) : detailedStatementData.categories.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
            No distributed activity has been mapped to operation {selectedOperationCode} yet. Complete your mappings and distribution to
            see the detailed statement.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="w-72 py-3 pl-6 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Account Description
                  </th>
                  {displayMonths.map(glMonth => (
                    <th key={glMonth} className="min-w-[140px] px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {formatGlMonth(glMonth)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {detailedStatementData.categories.map(category => {
                  const isRevenueAccount = category.accountType === 'Revenue';
                  const accountColor = isRevenueAccount
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-red-600 dark:text-red-400';
                  const percentColor = accountColor;

                  return (
                    <React.Fragment key={category.category}>
                      {/* Category Header */}
                      <tr className="border-t border-slate-200 dark:border-slate-700">
                        <td
                          colSpan={1 + displayMonths.length}
                          className="bg-slate-50 py-2.5 pl-6 pr-4 text-xs font-bold uppercase tracking-wider text-slate-600 dark:bg-slate-800/50 dark:text-slate-300"
                        >
                          {category.category}
                        </td>
                      </tr>

                      {/* Sub-Category Rows */}
                      {category.subCategories.map(subCategory => (
                        <tr
                          key={`${category.category}-${subCategory.coreAccount}`}
                          className="group cursor-pointer border-b border-slate-100 transition hover:bg-blue-50/50 dark:border-slate-800 dark:hover:bg-slate-800/30"
                          onClick={() => handleSubCategoryClick(subCategory)}
                        >
                          <td className="py-4 pl-6 pr-4">
                            <div className="flex items-baseline gap-2">
                              <span className={`text-sm font-medium ${accountColor}`}>
                                {subCategory.coreAccount}
                              </span>
                              <span className="text-sm text-slate-700 dark:text-slate-200">
                                {subCategory.subCategory}
                              </span>
                            </div>
                          </td>
                          {displayMonths.map(glMonth => {
                            const metrics = subCategory.metricsByPeriod[glMonth];
                            if (!metrics) {
                              return (
                                <td
                                  key={glMonth}
                                  className="px-4 py-4 text-right text-slate-400 dark:text-slate-500"
                                >
                                  $0
                                  <div className="text-xs text-slate-400">0.0%</div>
                                </td>
                              );
                            }

                            return (
                              <td key={glMonth} className="px-4 py-4 text-right">
                                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                  {formatCurrencyWhole(Math.abs(metrics.amount))}
                                </div>
                                <div className="mt-0.5 flex items-center justify-end gap-2 text-xs">
                                  {hasMilesData && metrics.costPerMile !== null && (
                                    <span className="text-slate-500 dark:text-slate-400">
                                      {formatCostPerMile(metrics.costPerMile)}/mi
                                    </span>
                                  )}
                                  <span className={percentColor}>
                                    {formatPercentage(metrics.percentOfCategory)}
                                  </span>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}

                      {/* Category Total Row */}
                      <tr className="border-b-2 border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-800/40">
                        <td className="py-5 pl-6 pr-4 text-base font-bold text-slate-900 dark:text-white">
                          Total {category.category}
                        </td>
                        {displayMonths.map(glMonth => {
                          const total = category.totalByPeriod[glMonth] ?? 0;
                          const miles = milesByPeriod?.[glMonth] ?? null;
                          const costPerMile =
                            miles && miles > 0 ? Math.abs(total) / miles : null;
                          return (
                            <td
                              key={glMonth}
                              className="px-4 py-5 text-right"
                            >
                              <div className="text-base font-bold text-slate-900 dark:text-white">
                                {formatCurrencyWhole(Math.abs(total))}
                              </div>
                              {hasMilesData && costPerMile !== null && (
                                <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                  {formatCostPerMile(costPerMile)}/mi
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>

              {/* Net Income Footer */}
              <tfoot>
                <tr className="border-t-2 border-slate-400 bg-slate-100 dark:border-slate-500 dark:bg-slate-800">
                  <td className="py-5 pl-6 pr-4 text-lg font-bold text-slate-900 dark:text-white">
                    Net Income
                  </td>
                  {displayMonths.map(glMonth => {
                    const metrics = netIncomeMetricsByPeriod[glMonth];
                    const netIncome = metrics?.netIncome ?? 0;
                    const isPositive = netIncome >= 0;
                    return (
                      <td
                        key={glMonth}
                        className="px-4 py-5 text-right"
                      >
                        <div className={`text-lg font-bold ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {formatCurrencyWhole(netIncome)}
                        </div>
                        <div className="mt-1 flex items-center justify-end gap-2 text-xs">
                          {hasMilesData && metrics?.costPerMile !== null && (
                            <span className="text-slate-500 dark:text-slate-400">
                              {formatCostPerMile(metrics.costPerMile)}/mi
                            </span>
                          )}
                          <span className={isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                            {formatPercentage(metrics?.margin ?? 0)}
                          </span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Sub-Category Detail Modal */}
      <SubCategoryDetailModal
        open={selectedSubCategory !== null}
        onClose={handleCloseModal}
        subCategory={selectedSubCategory}
        milesByPeriod={milesByPeriod}
        sortedGlMonths={sortedGlMonths}
        hasMilesData={hasMilesData}
      />
    </div>
  );
};

export default ReviewPane;
