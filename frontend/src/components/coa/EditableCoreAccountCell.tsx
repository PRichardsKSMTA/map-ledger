import { useState, useEffect, useRef, useCallback } from 'react';

interface EditableCoreAccountCellProps {
  accountNumber: string;
  onSave: (coreAccount: string) => void;
  validationError?: string | null;
}

/**
 * A specialized cell for editing only the core account portion of an account number.
 * Displays: [editable core]-[readonly suffix]
 */
export default function EditableCoreAccountCell({
  accountNumber,
  onSave,
  validationError,
}: EditableCoreAccountCellProps) {
  const parts = accountNumber.split('-');
  const coreAccount = parts[0] ?? accountNumber;
  const suffix = parts.length === 3 ? `-${parts[1]}-${parts[2]}` : '';

  const [localValue, setLocalValue] = useState(coreAccount);
  const lastSavedValue = useRef(coreAccount);

  // Sync local value when prop changes (e.g., after undo or external update)
  useEffect(() => {
    const newCore = accountNumber.split('-')[0] ?? accountNumber;
    if (newCore !== lastSavedValue.current) {
      setLocalValue(newCore);
      lastSavedValue.current = newCore;
    }
  }, [accountNumber]);

  const handleBlur = useCallback(() => {
    const trimmed = localValue.trim();
    if (trimmed !== lastSavedValue.current) {
      lastSavedValue.current = trimmed;
      onSave(trimmed);
    }
  }, [localValue, onSave]);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={localValue}
          onChange={e => setLocalValue(e.target.value)}
          onBlur={handleBlur}
          className="w-20 rounded border border-gray-300 px-2 py-1 text-sm font-medium focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
        />
        <span className="text-gray-500 dark:text-gray-400">{suffix}</span>
      </div>
      {validationError && (
        <span className="text-xs text-red-600">{validationError}</span>
      )}
    </div>
  );
}
