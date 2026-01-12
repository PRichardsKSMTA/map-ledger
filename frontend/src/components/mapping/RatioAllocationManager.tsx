import { useCallback, useEffect, useState } from 'react';
import RatioAllocationBuilder, {
  type RatioAllocationTargetCatalogOption,
} from './RatioAllocationBuilder';
import { useRatioAllocationStore } from '../../store/ratioAllocationStore';
import type { BasisCategory, DynamicAllocationPresetContext } from '../../types';

interface RatioAllocationManagerProps {
  initialSourceAccountId?: string | null;
  applyToSourceAccountIds?: string[];
  onPresetApplied?: (presetId: string, sourceAccountIds: string[]) => void;
  onOpenClientSurvey?: () => void;
  onDone?: () => void;
  targetCatalog?: RatioAllocationTargetCatalogOption[];
  resolveCanonicalTargetId?: (targetId?: string | null) => string | null;
  targetLabel?: string;
  targetPlaceholder?: string;
  targetEmptyLabel?: string;
  presetContext?: DynamicAllocationPresetContext;
}

const RatioAllocationManager = ({
  initialSourceAccountId,
  applyToSourceAccountIds,
  onPresetApplied,
  onOpenClientSurvey,
  onDone,
  targetCatalog,
  resolveCanonicalTargetId,
  targetLabel,
  targetPlaceholder,
  targetEmptyLabel,
  presetContext,
}: RatioAllocationManagerProps) => {
  const { getOrCreateAllocation } = useRatioAllocationStore();
  const [basisCategory, setBasisCategory] = useState<BasisCategory>('financial');
  // Tracks the category of currently selected basis datapoints (null if none selected)
  const [lockedCategory, setLockedCategory] = useState<BasisCategory | null>(null);
  const showBasisToggle = presetContext === 'distribution';

  // Callback to receive locked category from RatioAllocationBuilder
  const handleBasisCategoryLock = useCallback((category: BasisCategory | null) => {
    setLockedCategory(category);
  }, []);

  // Determine if each toggle option should be disabled
  const isFinancialDisabled = lockedCategory === 'operational';
  const isOperationalDisabled = lockedCategory === 'financial';

  useEffect(() => {
    if (initialSourceAccountId) {
      getOrCreateAllocation(initialSourceAccountId);
    }
  }, [initialSourceAccountId, getOrCreateAllocation]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">Dynamic allocations</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Manage ratio-based rules that distribute standard chart of accounts balances across client operations.
        </p>
      </div>

      {showBasisToggle && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Basis datapoint type
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Financial statistics use dollar values; operational statistics use counts or volume.
              </p>
              {lockedCategory && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  Remove selected {lockedCategory} basis datapoints to switch types.
                </p>
              )}
            </div>
            <div className="inline-flex w-full overflow-hidden rounded-md border border-slate-300 bg-slate-50 text-sm font-medium shadow-sm dark:border-slate-600 dark:bg-slate-800 sm:w-auto">
              <button
                type="button"
                onClick={() => setBasisCategory('financial')}
                aria-pressed={basisCategory === 'financial'}
                disabled={isFinancialDisabled}
                title={isFinancialDisabled ? 'Remove operational basis datapoints first' : undefined}
                className={`px-4 py-2 transition ${
                  basisCategory === 'financial'
                    ? 'bg-blue-600 text-white'
                    : isFinancialDisabled
                      ? 'cursor-not-allowed text-slate-400 dark:text-slate-500'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                Financial
              </button>
              <button
                type="button"
                onClick={() => setBasisCategory('operational')}
                aria-pressed={basisCategory === 'operational'}
                disabled={isOperationalDisabled}
                title={isOperationalDisabled ? 'Remove financial basis datapoints first' : undefined}
                className={`px-4 py-2 transition ${
                  basisCategory === 'operational'
                    ? 'bg-blue-600 text-white'
                    : isOperationalDisabled
                      ? 'cursor-not-allowed text-slate-400 dark:text-slate-500'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                Operational
              </button>
            </div>
          </div>
        </div>
      )}

      <RatioAllocationBuilder
        initialSourceAccountId={initialSourceAccountId}
        applyToSourceAccountIds={applyToSourceAccountIds}
        onPresetApplied={onPresetApplied}
        onOpenClientSurvey={onOpenClientSurvey}
        targetCatalog={targetCatalog}
        resolveCanonicalTargetId={resolveCanonicalTargetId}
        targetLabel={targetLabel}
        targetPlaceholder={targetPlaceholder}
        targetEmptyLabel={targetEmptyLabel}
        presetContext={presetContext}
        basisCategory={showBasisToggle ? basisCategory : 'financial'}
        onBasisCategoryLock={showBasisToggle ? handleBasisCategoryLock : undefined}
      />

      {onDone && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onDone}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-900"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
};

export default RatioAllocationManager;
