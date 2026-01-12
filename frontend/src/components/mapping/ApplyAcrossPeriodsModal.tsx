import { useEffect, useState } from 'react';
import { Calendar } from 'lucide-react';
import ModalBackdrop from '../ui/ModalBackdrop';

export type ApplyAcrossPeriodsScope = 'selected' | 'filtered';

interface ApplyAcrossPeriodsModalProps {
  open: boolean;
  periodLabel: string;
  contextLabel: string;
  selectedCount: number;
  filteredCount: number;
  onClose: () => void;
  onConfirm: (scope: ApplyAcrossPeriodsScope) => void;
}

const ApplyAcrossPeriodsModal = ({
  open,
  periodLabel,
  contextLabel,
  selectedCount,
  filteredCount,
  onClose,
  onConfirm,
}: ApplyAcrossPeriodsModalProps) => {
  const [scope, setScope] = useState<ApplyAcrossPeriodsScope>(
    selectedCount > 0 ? 'selected' : 'filtered',
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    setScope(selectedCount > 0 ? 'selected' : 'filtered');
  }, [open, selectedCount]);

  if (!open) {
    return null;
  }

  const canApplySelected = selectedCount > 0;
  const canApplyFiltered = filteredCount > 0;
  const canConfirm =
    (scope === 'selected' && canApplySelected) ||
    (scope === 'filtered' && canApplyFiltered);

  const handleConfirm = () => {
    if (!canConfirm) {
      return;
    }
    onConfirm(scope);
  };

  return (
    <ModalBackdrop className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg rounded-lg bg-white shadow-xl dark:bg-slate-900"
      >
        <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" aria-hidden="true" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Apply {contextLabel} to all periods
            </h3>
          </div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Copy {contextLabel} from {periodLabel} to every reporting period for matching
            accounts. Existing {contextLabel} in other periods will be overwritten.
          </p>
        </div>
        <div className="space-y-3 px-6 py-4">
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
            <input
              type="radio"
              name="apply-scope"
              value="selected"
              checked={scope === 'selected'}
              onChange={() => setScope('selected')}
              disabled={!canApplySelected}
              className="h-4 w-4 text-blue-600"
            />
            <div>
              <div className="font-medium text-slate-900 dark:text-slate-100">
                Selected rows
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                {selectedCount} row{selectedCount === 1 ? '' : 's'} selected
              </div>
            </div>
          </label>
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
            <input
              type="radio"
              name="apply-scope"
              value="filtered"
              checked={scope === 'filtered'}
              onChange={() => setScope('filtered')}
              disabled={!canApplyFiltered}
              className="h-4 w-4 text-blue-600"
            />
            <div>
              <div className="font-medium text-slate-900 dark:text-slate-100">
                All filtered rows
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                {filteredCount} row{filteredCount === 1 ? '' : 's'} in the current view
              </div>
            </div>
          </label>
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Apply to all periods
          </button>
        </div>
      </div>
    </ModalBackdrop>
  );
};

export default ApplyAcrossPeriodsModal;
