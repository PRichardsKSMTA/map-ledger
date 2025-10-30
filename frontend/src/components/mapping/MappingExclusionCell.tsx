import type { GLAccountMappingRow } from '../../types';
import { getAccountExcludedAmount } from '../../store/mappingStore';

interface MappingExclusionCellProps {
  account: GLAccountMappingRow;
}

const percentageFormatter = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const formatPercentage = (value: number): string => percentageFormatter.format(value);

const MappingExclusionCell = ({ account }: MappingExclusionCellProps) => {
  const isFullyExcluded = account.mappingType === 'exclude' || account.status === 'Excluded';

  if (isFullyExcluded) {
    return (
      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">100%</span>
    );
  }

  const excludedAmount = Math.abs(getAccountExcludedAmount(account));
  const totalAmount = Math.abs(account.netChange);

  if (excludedAmount <= 0 || totalAmount <= 0) {
    return <span className="text-sm text-slate-500 dark:text-slate-400">—</span>;
  }

  const ratio = Math.min(1, excludedAmount / totalAmount);
  const formattedPercentage = formatPercentage(ratio);

  return (
    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
      {formattedPercentage}
    </span>
  );
};

export default MappingExclusionCell;
