import React from 'react';
import { DollarSign, Truck, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { formatCurrencyAmount } from '../../utils/currency';
import { formatGlMonth } from '../../utils/detailedStatementUtils';

export interface ReviewMetrics {
  totalRevenue: number;
  revenueChange: number; // percent change from last month
  totalMiles: number;
  milesChange: number; // percent change from last month
  netIncome: number;
  netIncomeChange: number; // percent change from last month
  margin: number; // percent margin (revenue - expenses) / revenue
  operatingRatio: number; // placeholder - will be calculated later
  operatingRatioTarget: number; // target value for comparison
}

interface ReviewSummaryCardsProps {
  metrics: ReviewMetrics;
  mostRecentMonth: string;
}

const formatPercentChange = (value: number): string => {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
};

const formatLargeNumber = (value: number): string => {
  if (Math.abs(value) >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return formatCurrencyAmount(value);
};

const formatMiles = (value: number): string => {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(0)}K`;
  }
  return value.toLocaleString();
};

const ReviewSummaryCards: React.FC<ReviewSummaryCardsProps> = ({ metrics, mostRecentMonth }) => {
  const {
    totalRevenue,
    revenueChange,
    totalMiles,
    milesChange,
    netIncome,
    netIncomeChange,
    margin,
    operatingRatio,
    operatingRatioTarget,
  } = metrics;

  // Determine if operating ratio is good (at or below target) or bad (above target)
  const isOperatingRatioGood = operatingRatio <= operatingRatioTarget;
  const operatingRatioStatus = isOperatingRatioGood ? 'Good' : 'Bad';
  const operatingRatioStatusColor = isOperatingRatioGood
    ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
    : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300';

  // Format the month label
  const monthLabel = mostRecentMonth
    ? formatGlMonth(mostRecentMonth).toUpperCase()
    : '';

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Total Revenue Card */}
      <div className="relative rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Total Revenue ({monthLabel})
            </p>
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
              {formatLargeNumber(totalRevenue)}
            </p>
            <p className="mt-1 text-sm">
              <span
                className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${
                  revenueChange >= 0
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                }`}
              >
                {formatPercentChange(revenueChange)}
              </span>
              <span className="ml-1.5 text-xs text-gray-500 dark:text-gray-400">vs Last Month</span>
            </p>
          </div>
          <div className="rounded-lg bg-blue-50 p-2 dark:bg-blue-900/30">
            <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
      </div>

      {/* Total Miles Card */}
      <div className="relative rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Total Miles
            </p>
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
              {formatMiles(totalMiles)}
            </p>
            <p className="mt-1 text-sm">
              <span
                className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${
                  milesChange >= 0
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                }`}
              >
                {formatPercentChange(milesChange)}
              </span>
              <span className="ml-1.5 text-xs text-gray-500 dark:text-gray-400">vs Last Month</span>
            </p>
          </div>
          <div className="rounded-lg bg-slate-100 p-2 dark:bg-slate-800">
            <Truck className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          </div>
        </div>
      </div>

      {/* Net Income Card */}
      <div className="relative rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Net Income
            </p>
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
              {formatLargeNumber(netIncome)}
            </p>
            <p className="mt-1 text-sm">
              <span
                className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${
                  netIncomeChange >= 0
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                }`}
              >
                {formatPercentChange(netIncomeChange)}
              </span>
              <span className="ml-1.5 text-xs text-gray-500 dark:text-gray-400">
                Margin: {margin.toFixed(1)}%
              </span>
            </p>
          </div>
          <div className={`rounded-lg p-2 ${
            netIncomeChange >= 0
              ? 'bg-emerald-50 dark:bg-emerald-900/30'
              : 'bg-red-50 dark:bg-red-900/30'
          }`}>
            {netIncomeChange >= 0 ? (
              <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
            )}
          </div>
        </div>
      </div>

      {/* Operating Ratio Card */}
      <div className="relative rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Operating Ratio
            </p>
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
              {operatingRatio.toFixed(1)}
            </p>
            <p className="mt-1 text-sm">
              <span
                className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${operatingRatioStatusColor}`}
              >
                {operatingRatioStatus}
              </span>
              <span className="ml-1.5 text-xs text-gray-500 dark:text-gray-400">
                Target: &lt; {operatingRatioTarget.toFixed(1)}
              </span>
            </p>
          </div>
          <div className="rounded-lg bg-purple-50 p-2 dark:bg-purple-900/30">
            <Activity className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewSummaryCards;
