import { Calendar } from 'lucide-react';
import ModalBackdrop from '../ui/ModalBackdrop';

interface ApplyToFuturePeriodsModalProps {
  open: boolean;
  periodLabel: string;
  contextLabel: string;
  selectedCount: number;
  futurePeriodsCount: number;
  onClose: () => void;
  onConfirm: () => void;
}

const ApplyToFuturePeriodsModal = ({
  open,
  periodLabel,
  contextLabel,
  selectedCount,
  futurePeriodsCount,
  onClose,
  onConfirm,
}: ApplyToFuturePeriodsModalProps) => {
  if (!open) {
    return null;
  }

  const canConfirm = selectedCount > 0 && futurePeriodsCount > 0;

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
              Apply {contextLabel} to future periods
            </h3>
          </div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Copy {contextLabel} from {periodLabel} to all future reporting periods for selected
            accounts. Previous periods will not be affected.
          </p>
        </div>
        <div className="space-y-3 px-6 py-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-900 dark:text-slate-100">
                  Selected accounts
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  {selectedCount} account{selectedCount === 1 ? '' : 's'} selected
                </div>
              </div>
              <div className="text-right">
                <div className="font-medium text-slate-900 dark:text-slate-100">
                  Future periods
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  {futurePeriodsCount} period{futurePeriodsCount === 1 ? '' : 's'}
                </div>
              </div>
            </div>
          </div>
          {selectedCount === 0 && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Please select accounts using the checkboxes to apply mappings.
            </p>
          )}
          {futurePeriodsCount === 0 && selectedCount > 0 && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              There are no future periods available.
            </p>
          )}
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
            onClick={onConfirm}
            disabled={!canConfirm}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Apply to future periods
          </button>
        </div>
      </div>
    </ModalBackdrop>
  );
};

export default ApplyToFuturePeriodsModal;
