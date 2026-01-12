import { useState, useEffect, useRef, useCallback } from 'react';

interface EditableTextCellProps {
  value: string;
  onSave: (value: string) => void;
  formatOnBlur?: (value: string) => string;
  className?: string;
  validationError?: string | null;
}

/**
 * A text input cell that manages its own local state to prevent parent re-renders on every keystroke.
 * Only triggers onSave when the input loses focus and the value has changed.
 */
export default function EditableTextCell({
  value,
  onSave,
  formatOnBlur,
  className = '',
  validationError,
}: EditableTextCellProps) {
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastSavedValue = useRef(value);

  // Sync local value when prop changes (e.g., after undo or external update)
  useEffect(() => {
    if (value !== lastSavedValue.current) {
      setLocalValue(value);
      lastSavedValue.current = value;
    }
  }, [value]);

  const handleBlur = useCallback(() => {
    let finalValue = localValue;
    if (formatOnBlur) {
      finalValue = formatOnBlur(localValue);
      setLocalValue(finalValue);
    }

    if (finalValue !== lastSavedValue.current) {
      lastSavedValue.current = finalValue;
      onSave(finalValue);
    }
  }, [localValue, formatOnBlur, onSave]);

  return (
    <div className="flex flex-col gap-1">
      <input
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={e => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        className={className}
      />
      {validationError && (
        <span className="text-xs text-red-600">{validationError}</span>
      )}
    </div>
  );
}
