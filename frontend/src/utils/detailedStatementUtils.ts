import type { ChartOfAccountOption, DynamicBasisAccount, DistributionRow } from '../types';

/** Miles account numbers for cost per mile calculation (Company Driver + Owner Operator) */
const MILES_ACCOUNT_NUMBERS = ['9000-100-100', '9000-100-200'];

/**
 * Manual overrides for accounts with "Other Income/Expense" account type.
 * These accounts need explicit classification since the generic type is ambiguous.
 */
const OTHER_INCOME_EXPENSE_OVERRIDES: Record<string, 'Revenue' | 'Expense'> = {
  // Revenue accounts
  '8000-000-000': 'Revenue', // Interest Income
  '8010-000-000': 'Revenue', // Gain on Sale of Equipment
  '8020-000-000': 'Revenue', // Other Income
  '8025-000-000': 'Revenue', // Other Income
  // Expense accounts
  '8030-000-000': 'Expense', // Interest Expense - Line of Credit
  '8040-000-000': 'Expense', // Interest Expense - Other
  '8050-000-000': 'Expense', // Loss on Sale of Equipment
};

/**
 * Parse a GL month string (e.g., "2025-11-01") and format it for display.
 * This avoids timezone issues where UTC dates get shifted back a day/month
 * when displayed in local time.
 *
 * @param glMonth - Date string in format "YYYY-MM-DD"
 * @param options - Intl.DateTimeFormat options (e.g., { month: 'short', year: 'numeric' })
 * @returns Formatted date string
 */
export const formatGlMonth = (
  glMonth: string,
  options: Intl.DateTimeFormatOptions = { month: 'short', year: 'numeric' },
): string => {
  // Parse the date string manually to avoid timezone issues
  const parts = glMonth.split('-');
  if (parts.length < 2) return glMonth;

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // JavaScript months are 0-indexed

  // Create date using local time (not UTC)
  const date = new Date(year, month, 1);
  return date.toLocaleDateString('en-US', options);
};

/** Metrics displayed for each period column */
export interface PeriodMetrics {
  amount: number;
  costPerMile: number | null;
  percentOfCategory: number;
}

/** Individual account within a sub-category */
export interface DetailedAccountItem {
  accountNumber: string;
  description: string;
  metricsByPeriod: Record<string, PeriodMetrics>;
  totalAmount: number;
}

/** Sub-category row (displayed in the main table) */
export interface DetailedSubCategoryRow {
  subCategory: string;
  coreAccount: string;
  category: string;
  accountType: 'Revenue' | 'Expense' | null;
  metricsByPeriod: Record<string, PeriodMetrics>;
  totalAmount: number;
  accounts: DetailedAccountItem[];
}

/** Category group (top-level grouping) */
export interface DetailedCategoryGroup {
  category: string;
  accountType: 'Revenue' | 'Expense' | null;
  totalByPeriod: Record<string, number>;
  grandTotal: number;
  subCategories: DetailedSubCategoryRow[];
}

/** Complete statement data structure */
export interface DetailedStatementData {
  categories: DetailedCategoryGroup[];
  sortedGlMonths: string[];
  milesByPeriod: Record<string, number> | null;
  hasMilesData: boolean;
}

/**
 * Find all miles denominator accounts from operational basis accounts
 */
export const findMilesDenominatorAccounts = (
  operationalBasisAccounts: DynamicBasisAccount[],
): DynamicBasisAccount[] => {
  return operationalBasisAccounts.filter(
    account =>
      MILES_ACCOUNT_NUMBERS.includes(account.id) ||
      MILES_ACCOUNT_NUMBERS.includes(account.mappedTargetId ?? ''),
  );
};

/**
 * @deprecated Use findMilesDenominatorAccounts instead
 */
export const findMilesDenominatorAccount = (
  operationalBasisAccounts: DynamicBasisAccount[],
): DynamicBasisAccount | null => {
  const accounts = findMilesDenominatorAccounts(operationalBasisAccounts);
  return accounts[0] ?? null;
};

/**
 * Get total miles by period by summing all miles accounts
 */
export const getMilesByPeriod = (
  milesAccounts: DynamicBasisAccount | DynamicBasisAccount[] | null,
): Record<string, number> | null => {
  // Handle legacy single account parameter
  if (!milesAccounts) {
    return null;
  }

  const accountsArray = Array.isArray(milesAccounts) ? milesAccounts : [milesAccounts];

  if (accountsArray.length === 0) {
    return null;
  }

  // Sum values from all accounts by period
  const totalByPeriod: Record<string, number> = {};

  accountsArray.forEach(account => {
    if (!account?.valuesByPeriod) return;

    Object.entries(account.valuesByPeriod).forEach(([period, value]) => {
      totalByPeriod[period] = (totalByPeriod[period] ?? 0) + value;
    });
  });

  return Object.keys(totalByPeriod).length > 0 ? totalByPeriod : null;
};

/**
 * Calculate cost per mile
 */
export const calculateCostPerMile = (amount: number, miles: number | null): number | null => {
  if (miles === null || miles === 0) {
    return null;
  }
  return Math.abs(amount) / miles;
};

/**
 * Calculate period metrics for an amount
 */
export const calculatePeriodMetrics = (
  amount: number,
  categoryTotal: number,
  miles: number | null,
): PeriodMetrics => {
  const costPerMile = calculateCostPerMile(amount, miles);
  const percentOfCategory = categoryTotal !== 0 ? (Math.abs(amount) / Math.abs(categoryTotal)) * 100 : 0;

  return {
    amount,
    costPerMile,
    percentOfCategory,
  };
};

/**
 * Format cost per mile for display
 */
export const formatCostPerMile = (value: number | null): string => {
  if (value === null) {
    return '';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(value);
};

/**
 * Format percentage for display
 */
export const formatPercentage = (value: number): string => {
  return `${value.toFixed(1)}%`;
};

/** Category sort order - lower number = higher priority */
const CATEGORY_ORDER: Record<string, number> = {
  'Operating Revenue': 1,
  'Variable Expenses': 2,
  'Fixed Expenses': 3,
  'Administrative Expenses': 4,
  'Other Income': 5,
  'Other Expenses': 6,
};

const getCategorySortOrder = (category: string): number => {
  return CATEGORY_ORDER[category] ?? 99;
};

/**
 * Build an efficient lookup for activity by source account and period.
 * Groups activity from the raw lookup (accountId__entityId__period) by (accountId, period).
 */
const buildActivityBySourceAndPeriod = (
  activityLookup: Map<string, number>,
): Map<string, number> => {
  const result = new Map<string, number>();

  activityLookup.forEach((value, key) => {
    // Key format: accountId__entityId__period
    const parts = key.split('__');
    if (parts.length !== 3) return;

    const [accountId, , period] = parts;
    const newKey = `${accountId}__${period}`;
    result.set(newKey, (result.get(newKey) ?? 0) + value);
  });

  return result;
};

/**
 * Build the detailed statement data structure from distribution rows
 * @param selectedOperationCode - If provided, filter to only show activity for this operation
 */
export const buildDetailedStatementData = (
  distributionRows: DistributionRow[],
  chartOptions: ChartOfAccountOption[],
  activityLookup: Map<string, number>,
  sortedGlMonths: string[],
  operationalBasisAccounts: DynamicBasisAccount[],
  selectedOperationCode?: string | null,
): DetailedStatementData => {
  // Build chart of accounts lookup
  const coaLookup = new Map<string, ChartOfAccountOption>();
  chartOptions.forEach(option => {
    const key = option.accountNumber?.trim() || option.value?.trim();
    if (key) {
      coaLookup.set(key, option);
    }
  });

  // Get miles data (sum of all miles accounts)
  const milesAccounts = findMilesDenominatorAccounts(operationalBasisAccounts);
  const milesByPeriod = getMilesByPeriod(milesAccounts);
  const hasMilesData = milesByPeriod !== null && Object.keys(milesByPeriod).length > 0;

  // Build efficient lookup: sourceAccountId__period -> activity
  const activityBySourcePeriod = buildActivityBySourceAndPeriod(activityLookup);

  // Group distribution rows by category -> subCategory -> account
  // First, aggregate activity by target account and period
  const accountActivityMap = new Map<
    string,
    {
      accountId: string;
      description: string;
      category: string;
      accountType: 'Revenue' | 'Expenses' | null;
      subCategory: string;
      coreAccount: string;
      activityByPeriod: Record<string, number>;
    }
  >();

  distributionRows.forEach(row => {
    const accountId = row.accountId;
    const coaOption = coaLookup.get(accountId);

    const category = coaOption?.category?.trim() || 'Uncategorized';
    const subCategory = coaOption?.subCategory?.trim() || 'Other';
    const coreAccount = coaOption?.coreAccount?.trim() || accountId;
    // Get accountType from chart of accounts - normalize to expected values
    // Check for manual overrides first (for "Other Income/Expense" accounts)
    const rawAccountType = coaOption?.accountType?.trim() ?? null;
    const manualOverride = OTHER_INCOME_EXPENSE_OVERRIDES[coreAccount];
    const accountType: 'Revenue' | 'Expense' | null =
      manualOverride ?? (
        rawAccountType === 'Revenue' ? 'Revenue' :
        rawAccountType === 'Expense' ? 'Expense' : null
      );

    let accountEntry = accountActivityMap.get(accountId);
    if (!accountEntry) {
      accountEntry = {
        accountId,
        description: row.description || coaOption?.description || accountId,
        category,
        accountType,
        subCategory,
        coreAccount,
        activityByPeriod: {},
      };
      accountActivityMap.set(accountId, accountEntry);
    }

    // Get activity for each period for this row
    sortedGlMonths.forEach(glMonth => {
      const entityAccountId = row.entityAccountId;
      if (!entityAccountId) return;

      // Look up activity using the efficient lookup
      const lookupKey = `${entityAccountId}__${glMonth}`;
      const periodActivity = activityBySourcePeriod.get(lookupKey) ?? 0;

      // Apply the operation share fraction
      // If selectedOperationCode is provided, only include that operation's share
      const normalizedSelectedOp = selectedOperationCode?.trim().toUpperCase();

      row.operations.forEach(share => {
        const shareCode = (share.code ?? share.id ?? share.name ?? '').trim().toUpperCase();

        // Skip this operation if we're filtering and it doesn't match
        if (normalizedSelectedOp && shareCode !== normalizedSelectedOp) {
          return;
        }

        // Calculate the fraction of activity for this operation
        // If allocations are defined, use them; otherwise treat all operations as equal shares
        const totalOperationAllocation = row.operations.reduce(
          (sum, op) => sum + (op.allocation ?? 0),
          0,
        );

        let fraction: number;
        if (totalOperationAllocation > 0) {
          // Use defined allocations
          fraction = (share.allocation ?? 0) / totalOperationAllocation;
        } else {
          // No allocations defined - split equally among operations
          fraction = 1 / row.operations.length;
        }

        const allocatedAmount = periodActivity * fraction;
        accountEntry!.activityByPeriod[glMonth] =
          (accountEntry!.activityByPeriod[glMonth] ?? 0) + allocatedAmount;
      });

      // If no operations, use full activity (only if not filtering by operation)
      if (row.operations.length === 0 && row.status === 'Distributed' && !normalizedSelectedOp) {
        accountEntry!.activityByPeriod[glMonth] =
          (accountEntry!.activityByPeriod[glMonth] ?? 0) + periodActivity;
      }
    });
  });

  // Now build category -> subCategory -> account hierarchy
  const categoryMap = new Map<
    string,
    {
      category: string;
      accountType: 'Revenue' | 'Expense' | null;
      subCategoryMap: Map<
        string,
        {
          subCategory: string;
          coreAccount: string;
          accounts: Map<string, typeof accountActivityMap extends Map<string, infer V> ? V : never>;
        }
      >;
    }
  >();

  accountActivityMap.forEach(account => {
    let categoryEntry = categoryMap.get(account.category);
    if (!categoryEntry) {
      categoryEntry = {
        category: account.category,
        accountType: account.accountType,
        subCategoryMap: new Map(),
      };
      categoryMap.set(account.category, categoryEntry);
    }

    let subCategoryEntry = categoryEntry.subCategoryMap.get(account.subCategory);
    if (!subCategoryEntry) {
      subCategoryEntry = {
        subCategory: account.subCategory,
        coreAccount: account.coreAccount,
        accounts: new Map(),
      };
      categoryEntry.subCategoryMap.set(account.subCategory, subCategoryEntry);
    }

    subCategoryEntry.accounts.set(account.accountId, account);
  });

  // Calculate totals and build final structure
  const categories: DetailedCategoryGroup[] = [];

  categoryMap.forEach(categoryEntry => {
    // Calculate category totals by period
    const totalByPeriod: Record<string, number> = {};
    let grandTotal = 0;

    categoryEntry.subCategoryMap.forEach(subCat => {
      subCat.accounts.forEach(account => {
        Object.entries(account.activityByPeriod).forEach(([period, amount]) => {
          totalByPeriod[period] = (totalByPeriod[period] ?? 0) + amount;
          grandTotal += amount;
        });
      });
    });

    // Build sub-categories with metrics
    const subCategories: DetailedSubCategoryRow[] = [];

    categoryEntry.subCategoryMap.forEach(subCat => {
      // Calculate sub-category totals
      const subCatTotalByPeriod: Record<string, number> = {};
      let subCatTotal = 0;

      const accounts: DetailedAccountItem[] = [];

      subCat.accounts.forEach(account => {
        const accountMetricsByPeriod: Record<string, PeriodMetrics> = {};
        let accountTotal = 0;

        sortedGlMonths.forEach(glMonth => {
          const amount = account.activityByPeriod[glMonth] ?? 0;
          accountTotal += amount;
          subCatTotalByPeriod[glMonth] = (subCatTotalByPeriod[glMonth] ?? 0) + amount;

          const miles = milesByPeriod?.[glMonth] ?? null;
          const categoryPeriodTotal = totalByPeriod[glMonth] ?? 0;

          accountMetricsByPeriod[glMonth] = calculatePeriodMetrics(
            amount,
            categoryPeriodTotal,
            miles,
          );
        });

        subCatTotal += accountTotal;

        accounts.push({
          accountNumber: account.accountId,
          description: account.description,
          metricsByPeriod: accountMetricsByPeriod,
          totalAmount: accountTotal,
        });
      });

      // Calculate sub-category metrics
      const subCatMetricsByPeriod: Record<string, PeriodMetrics> = {};
      sortedGlMonths.forEach(glMonth => {
        const amount = subCatTotalByPeriod[glMonth] ?? 0;
        const miles = milesByPeriod?.[glMonth] ?? null;
        const categoryPeriodTotal = totalByPeriod[glMonth] ?? 0;

        subCatMetricsByPeriod[glMonth] = calculatePeriodMetrics(amount, categoryPeriodTotal, miles);
      });

      subCategories.push({
        subCategory: subCat.subCategory,
        coreAccount: subCat.coreAccount,
        category: categoryEntry.category,
        accountType: categoryEntry.accountType,
        metricsByPeriod: subCatMetricsByPeriod,
        totalAmount: subCatTotal,
        accounts: accounts.sort((a, b) => a.accountNumber.localeCompare(b.accountNumber)),
      });
    });

    // Sort sub-categories by core account
    subCategories.sort((a, b) => a.coreAccount.localeCompare(b.coreAccount, undefined, { numeric: true }));

    categories.push({
      category: categoryEntry.category,
      accountType: categoryEntry.accountType,
      totalByPeriod,
      grandTotal,
      subCategories,
    });
  });

  // Sort categories by predefined order
  categories.sort((a, b) => getCategorySortOrder(a.category) - getCategorySortOrder(b.category));

  return {
    categories,
    sortedGlMonths,
    milesByPeriod,
    hasMilesData,
  };
};

/**
 * Get trend data for sparkline (all periods in chronological order)
 */
export const getTrendData = (
  metricsByPeriod: Record<string, PeriodMetrics>,
  sortedGlMonths: string[],
): { labels: string[]; values: number[] } => {
  // sortedGlMonths is in descending order, reverse for chronological
  const chronological = [...sortedGlMonths].reverse();

  return {
    labels: chronological.map(month => formatGlMonth(month, { month: 'short' })),
    values: chronological.map(month => Math.abs(metricsByPeriod[month]?.amount ?? 0)),
  };
};

/**
 * Review metrics for summary cards
 */
export interface ReviewMetrics {
  totalRevenue: number;
  revenueChange: number;
  totalMiles: number;
  milesChange: number;
  netIncome: number;
  netIncomeChange: number;
  margin: number;
  operatingRatio: number;
  operatingRatioTarget: number;
}

/**
 * Revenue and expense trend data for dual-line chart
 */
export interface RevenueExpenseTrend {
  labels: string[];
  revenueData: number[];
  expenseData: number[];
}

/**
 * Calculate percent change between two values
 */
const calculatePercentChange = (current: number, previous: number): number => {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
};

/**
 * Check if a category is a revenue category
 */
const isRevenueCategory = (category: string): boolean => {
  const lower = category.toLowerCase();
  return lower.includes('revenue') || lower.includes('income');
};

/**
 * Check if a category is an expense category
 */
const isExpenseCategory = (category: string): boolean => {
  const lower = category.toLowerCase();
  return lower.includes('expense') || lower.includes('cost');
};

/**
 * Calculate review metrics from detailed statement data
 */
export const calculateReviewMetrics = (
  statementData: DetailedStatementData,
  milesByPeriod: Record<string, number> | null,
  operatingRatioTarget: number = 95.0,
): ReviewMetrics => {
  const { categories, sortedGlMonths } = statementData;

  // Get the two most recent months
  const mostRecentMonth = sortedGlMonths[0];
  const previousMonth = sortedGlMonths[1];

  // Calculate revenue and expenses for each month
  let currentRevenue = 0;
  let previousRevenue = 0;
  let currentExpenses = 0;
  let previousExpenses = 0;

  categories.forEach(category => {
    const currentTotal = Math.abs(category.totalByPeriod[mostRecentMonth] ?? 0);
    const prevTotal = Math.abs(category.totalByPeriod[previousMonth] ?? 0);

    if (category.accountType === 'Revenue') {
      currentRevenue += currentTotal;
      previousRevenue += prevTotal;
    } else if (category.accountType === 'Expense') {
      currentExpenses += currentTotal;
      previousExpenses += prevTotal;
    }
  });

  // Calculate net income
  const currentNetIncome = currentRevenue - currentExpenses;
  const previousNetIncome = previousRevenue - previousExpenses;

  // Calculate margin (net income / revenue)
  const margin = currentRevenue > 0 ? (currentNetIncome / currentRevenue) * 100 : 0;

  // Calculate operating ratio (expenses / revenue * 100)
  const operatingRatio = currentRevenue > 0 ? (currentExpenses / currentRevenue) * 100 : 0;
  const previousOperatingRatio = previousRevenue > 0 ? (previousExpenses / previousRevenue) * 100 : 0;

  // Get miles data
  const currentMiles = milesByPeriod?.[mostRecentMonth] ?? 0;
  const previousMiles = milesByPeriod?.[previousMonth] ?? 0;

  return {
    totalRevenue: currentRevenue,
    revenueChange: calculatePercentChange(currentRevenue, previousRevenue),
    totalMiles: currentMiles,
    milesChange: calculatePercentChange(currentMiles, previousMiles),
    netIncome: currentNetIncome,
    netIncomeChange: calculatePercentChange(currentNetIncome, previousNetIncome),
    margin,
    operatingRatio,
    operatingRatioTarget,
    operatingRatioChange: calculatePercentChange(operatingRatio, previousOperatingRatio),
  };
};

/**
 * Get revenue and expense trend data for dual-line chart
 */
export const getRevenueExpenseTrend = (
  statementData: DetailedStatementData,
): RevenueExpenseTrend => {
  const { categories, sortedGlMonths } = statementData;

  // Reverse to get chronological order
  const chronological = [...sortedGlMonths].reverse();

  // Calculate revenue and expenses for each month
  const revenueByMonth: Record<string, number> = {};
  const expensesByMonth: Record<string, number> = {};

  chronological.forEach(month => {
    revenueByMonth[month] = 0;
    expensesByMonth[month] = 0;
  });

  categories.forEach(category => {
    chronological.forEach(month => {
      const amount = Math.abs(category.totalByPeriod[month] ?? 0);
      if (category.accountType === 'Revenue') {
        revenueByMonth[month] += amount;
      } else if (category.accountType === 'Expense') {
        expensesByMonth[month] += amount;
      }
    });
  });

  return {
    labels: chronological.map(month => formatGlMonth(month, { month: 'short' })),
    revenueData: chronological.map(month => revenueByMonth[month]),
    expenseData: chronological.map(month => expensesByMonth[month]),
  };
};

/**
 * Net income metrics for a single period
 */
export interface NetIncomeMetrics {
  revenue: number;
  expenses: number;
  netIncome: number;
  margin: number; // (netIncome / revenue) * 100
  costPerMile: number | null;
}

/**
 * Calculate detailed net income metrics (revenue, expenses, net income, margin, cost per mile) by period
 * Returns a record mapping each GL month to its metrics
 */
export const getNetIncomeMetricsByPeriod = (
  statementData: DetailedStatementData,
  milesByPeriod: Record<string, number> | null,
): Record<string, NetIncomeMetrics> => {
  const { categories, sortedGlMonths } = statementData;

  const metricsByMonth: Record<string, NetIncomeMetrics> = {};

  // Initialize all months
  sortedGlMonths.forEach(month => {
    metricsByMonth[month] = {
      revenue: 0,
      expenses: 0,
      netIncome: 0,
      margin: 0,
      costPerMile: null,
    };
  });

  // DEBUG: Log category totals to help diagnose Net Income calculation issues
  if (sortedGlMonths.length > 0) {
    const debugMonth = sortedGlMonths[0];
    console.group(`[Net Income Debug] Month: ${debugMonth}`);
    categories.forEach(category => {
      const rawTotal = category.totalByPeriod[debugMonth] ?? 0;
      const absTotal = Math.abs(rawTotal);
      const classification = category.accountType ?? 'UNCATEGORIZED';
      console.log(
        `Category: "${category.category}" | AccountType: ${classification} | Raw: ${rawTotal.toFixed(2)} | Abs: ${absTotal.toFixed(2)}`,
      );
    });
    console.groupEnd();
  }

  // Calculate revenue and expenses for each month using accountType from chart of accounts
  categories.forEach(category => {
    sortedGlMonths.forEach(month => {
      const amount = Math.abs(category.totalByPeriod[month] ?? 0);
      if (category.accountType === 'Revenue') {
        metricsByMonth[month].revenue += amount;
      } else if (category.accountType === 'Expense') {
        metricsByMonth[month].expenses += amount;
      }
    });
  });

  // Calculate derived metrics
  sortedGlMonths.forEach(month => {
    const metrics = metricsByMonth[month];
    metrics.netIncome = metrics.revenue - metrics.expenses;
    metrics.margin = metrics.revenue > 0 ? (metrics.netIncome / metrics.revenue) * 100 : 0;

    const miles = milesByPeriod?.[month];
    if (miles && miles > 0) {
      metrics.costPerMile = metrics.netIncome / miles;
    }
  });

  // DEBUG: Log final revenue/expense totals (after calculation)
  if (sortedGlMonths.length > 0) {
    const debugMonth = sortedGlMonths[0];
    const m = metricsByMonth[debugMonth];
    console.log(
      `[Net Income Debug] Final: Revenue=${m.revenue.toFixed(2)}, Expenses=${m.expenses.toFixed(2)}, Net Income=${m.netIncome.toFixed(2)}`,
    );
  }

  return metricsByMonth;
};

/**
 * Calculate net income (revenue - expenses) by period
 * Returns a record mapping each GL month to its net income value
 * @deprecated Use getNetIncomeMetricsByPeriod for more detailed metrics
 */
export const getNetIncomeByPeriod = (
  statementData: DetailedStatementData,
): Record<string, number> => {
  const { categories, sortedGlMonths } = statementData;

  const netIncomeByMonth: Record<string, number> = {};

  // Initialize all months to 0
  sortedGlMonths.forEach(month => {
    netIncomeByMonth[month] = 0;
  });

  // Calculate revenue and expenses for each month using accountType
  categories.forEach(category => {
    sortedGlMonths.forEach(month => {
      const amount = Math.abs(category.totalByPeriod[month] ?? 0);
      if (category.accountType === 'Revenue') {
        // Add revenue
        netIncomeByMonth[month] += amount;
      } else if (category.accountType === 'Expense') {
        // Subtract expenses
        netIncomeByMonth[month] -= amount;
      }
    });
  });

  return netIncomeByMonth;
};
