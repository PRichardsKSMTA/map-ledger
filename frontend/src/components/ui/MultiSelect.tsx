import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface MultiSelectProps {
  label?: string;
  options: Option[];
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function MultiSelect({ label, options, value, onChange, disabled, placeholder = 'Select...' }: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const allSelected = options.length > 0 && value.length === options.length;
  const someSelected = value.length > 0 && value.length < options.length;

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelectAll = () => {
    if (allSelected) {
      onChange([]);
    } else {
      onChange(options.map(opt => opt.value));
    }
  };

  const toggle = (val: string) => {
    if (value.includes(val)) {
      onChange(value.filter(v => v !== val));
    } else {
      onChange([...value, val]);
    }
  };

  const getDisplayText = () => {
    if (value.length === 0) return placeholder;
    if (allSelected) return 'All sheets selected';
    if (value.length === 1) {
      const selectedOption = options.find(opt => opt.value === value[0]);
      return selectedOption?.label ?? '1 selected';
    }
    return `${value.length} sheets selected`;
  };

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-full cursor-pointer rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-10 text-left shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:disabled:bg-gray-700 dark:disabled:text-gray-400 sm:text-sm"
      >
        <span className="block truncate text-gray-900 dark:text-gray-100">{getDisplayText()}</span>
        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none dark:bg-gray-800 dark:ring-gray-600 sm:text-sm">
          {/* Select All option */}
          <div
            onClick={handleSelectAll}
            className="relative cursor-pointer select-none py-2 pl-3 pr-9 hover:bg-blue-50 dark:hover:bg-gray-700"
          >
            <div className="flex items-center">
              <span className={`block truncate ${allSelected ? 'font-semibold text-blue-600 dark:text-blue-400' : 'font-medium text-gray-900 dark:text-gray-100'}`}>
                Select All
              </span>
            </div>
            {(allSelected || someSelected) && (
              <span className="absolute inset-y-0 right-0 flex items-center pr-3">
                <Check className={`h-4 w-4 ${allSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`} />
              </span>
            )}
          </div>

          <div className="border-t border-gray-100 my-1 dark:border-gray-700" />

          {/* Individual options */}
          {options.map(opt => {
            const isSelected = value.includes(opt.value);
            return (
              <div
                key={opt.value}
                onClick={() => toggle(opt.value)}
                className="relative cursor-pointer select-none py-2 pl-3 pr-9 hover:bg-blue-50 dark:hover:bg-gray-700"
              >
                <span className={`block truncate ${isSelected ? 'font-semibold text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'}`}>
                  {opt.label}
                </span>
                {isSelected && (
                  <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-blue-600 dark:text-blue-400">
                    <Check className="h-4 w-4" />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

