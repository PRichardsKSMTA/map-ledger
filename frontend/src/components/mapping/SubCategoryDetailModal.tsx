import React from 'react';
import { X } from 'lucide-react';
import ModalBackdrop from '../ui/ModalBackdrop';
import Sparkline from '../ui/Sparkline';
import { formatCurrencyAmount } from '../../utils/currency';
import {
  type DetailedSubCategoryRow,
  formatCostPerMile,
  formatGlMonth,
  formatPercentage,
  getTrendData,
} from '../../utils/detailedStatementUtils';

interface SubCategoryDetailModalProps {
  open: boolean;
  onClose: () => void;
  subCategory: DetailedSubCategoryRow | null;
  milesByPeriod: Record<string, number> | null;
  sortedGlMonths: string[];
  hasMilesData: boolean;
}

const SubCategoryDetailModal: React.FC<SubCategoryDetailModalProps> = ({
  open,
  onClose,
  subCategory,
  milesByPeriod,
  sortedGlMonths,
  hasMilesData,
}) => {
  if (!open || !subCategory) {
    return null;
  }

  const trendData = getTrendData(subCategory.metricsByPeriod, sortedGlMonths);
  const displayMonths = sortedGlMonths.slice(0, 5);

  // Determine account type based on accountType from chart of accounts
  const isRevenue = subCategory.accountType === 'Revenue';
  const accountTypeLabel = isRevenue ? 'Revenue Account' : 'Expense Account';
  const accountTypeBgClass = isRevenue
    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
    : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300';
  const percentColor = isRevenue
    ? 'text-blue-600 dark:text-blue-400'
    : 'text-red-600 dark:text-red-400';

  return (
    <ModalBackdrop
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={e => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="w-full max-w-6xl rounded-xl bg-white shadow-2xl ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"
      >
        {/* Header */}
        <div className="border-b border-slate-200 px-8 py-5 dark:border-slate-700">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {subCategory.coreAccount}
                </span>
                <span
                  className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ${accountTypeBgClass}`}
                >
                  {accountTypeLabel}
                </span>
              </div>
              <h2 id="modal-title" className="text-2xl font-bold text-slate-900 dark:text-white">
                {subCategory.subCategory}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Detailed breakdown by sub-ledger accounts
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              aria-label="Close modal"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="max-h-[75vh] overflow-y-auto px-8 py-6">
          {/* Trend Chart Section */}
          <div className="mb-8 rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-800/30">
            <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {sortedGlMonths.length}-Month Trend Analysis
            </h3>
            <div className="flex justify-center">
              <Sparkline
                data={trendData.values}
                labels={trendData.labels}
                width={700}
                height={120}
                strokeColor={isRevenue ? '#3b82f6' : '#ef4444'}
                fillColor={isRevenue ? '#3b82f6' : '#ef4444'}
                isRevenue={isRevenue}
              />
            </div>
          </div>

          {/* Account Breakdown Table */}
          <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Sub-Account
                  </th>
                  {displayMonths.map(glMonth => (
                    <th key={glMonth} className="min-w-[130px] px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {formatGlMonth(glMonth)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {subCategory.accounts.map(account => (
                  <tr
                    key={account.accountNumber}
                    className="border-b border-slate-100 bg-white transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/30"
                  >
                    <td className="px-4 py-4">
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {account.description}
                      </div>
                    </td>
                    {displayMonths.map(glMonth => {
                      const metrics = account.metricsByPeriod[glMonth];
                      if (!metrics) {
                        return (
                          <td key={glMonth} className="px-4 py-4 text-right text-slate-400">
                            $0
                            <div className="text-xs text-slate-400">0.0%</div>
                          </td>
                        );
                      }
                      return (
                        <td key={glMonth} className="px-4 py-4 text-right">
                          <div className="text-sm font-semibold text-slate-900 dark:text-white">
                            {formatCurrencyAmount(Math.abs(metrics.amount))}
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
                <tr className="bg-slate-100 dark:bg-slate-800">
                  <td className="px-4 py-4 font-bold text-slate-900 dark:text-white">
                    Category Total
                  </td>
                  {displayMonths.map(glMonth => {
                    const metrics = subCategory.metricsByPeriod[glMonth];
                    if (!metrics) {
                      return (
                        <td key={glMonth} className="px-4 py-4 text-right text-slate-400">
                          $0
                        </td>
                      );
                    }
                    return (
                      <td key={glMonth} className="px-4 py-4 text-right">
                        <div className="text-sm font-bold text-slate-900 dark:text-white">
                          {formatCurrencyAmount(Math.abs(metrics.amount))}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-slate-200 px-8 py-5 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:focus-visible:ring-offset-slate-900"
          >
            Close View
          </button>
        </div>
      </div>
    </ModalBackdrop>
  );
};

export default SubCategoryDetailModal;
