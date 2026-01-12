import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import ModalBackdrop from '../ui/ModalBackdrop';

interface DeleteAccountModalProps {
  accountNumber: string;
  accountName: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export default function DeleteAccountModal({
  accountNumber,
  accountName,
  onConfirm,
  onCancel,
}: DeleteAccountModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
      setIsDeleting(false);
    }
  };

  return (
    <ModalBackdrop
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white shadow-xl dark:bg-slate-800"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-modal-title"
        onClick={event => event.stopPropagation()}
      >
        <div className="space-y-4 p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <h3
                id="delete-modal-title"
                className="text-lg font-semibold text-slate-900 dark:text-slate-100"
              >
                Delete Account
              </h3>
            </div>
            <button
              type="button"
              onClick={onCancel}
              disabled={isDeleting}
              className="rounded-full p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200 disabled:cursor-not-allowed"
              aria-label="Close modal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="text-sm text-slate-600 dark:text-slate-400">
            Are you sure you want to delete this account? This action cannot be undone.
          </p>

          <div className="rounded-md bg-slate-50 p-3 dark:bg-slate-700/50">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {accountNumber}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">{accountName}</p>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isDeleting}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 dark:focus:ring-offset-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isDeleting}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus:ring-offset-slate-800"
            >
              {isDeleting ? 'Deleting...' : 'Delete Account'}
            </button>
          </div>
        </div>
      </div>
    </ModalBackdrop>
  );
}
