import type { ChangeEvent, KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

type Option = { id: string; value: string; label: string };

interface SearchableSelectProps<TOption extends Option> {
  id?: string;
  value: string;
  options: TOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  getOptionValue?: (option: TOption) => string;
  getOptionLabel?: (option: TOption) => string;
  getOptionSecondaryLabel?: (option: TOption) => string;
  getOptionSecondaryClassName?: (option: TOption) => string;
  noOptionsMessage?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  selectOnTab?: boolean;
  allowClear?: boolean;
  allowEmptyValue?: boolean;
}

const baseInputClasses =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

type MenuStyles = {
  top: number;
  left: number;
  width: number;
};

const DROPDOWN_VERTICAL_OFFSET = 4;

export default function SearchableSelect<TOption extends Option>({
  id,
  value,
  options,
  placeholder = 'Search and select',
  disabled = false,
  className = '',
  inputClassName = '',
  getOptionValue,
  getOptionLabel,
  getOptionSecondaryLabel,
  getOptionSecondaryClassName,
  noOptionsMessage = 'No matches found',
  onChange,
  onBlur,
  selectOnTab = false,
  allowClear = true,
  allowEmptyValue = true,
}: SearchableSelectProps<TOption>) {
  const inputId = useId();
  const listboxId = `${inputId}-listbox`;
  const resolvedId = id ?? inputId;
  const valueSelector = useCallback(
    (option: TOption) => (getOptionValue ? getOptionValue(option) : option.value),
    [getOptionValue],
  );
  const labelSelector = useCallback(
    (option: TOption) => (getOptionLabel ? getOptionLabel(option) : option.label),
    [getOptionLabel],
  );
  const secondaryLabelSelector = useCallback(
    (option: TOption) =>
      getOptionSecondaryLabel ? getOptionSecondaryLabel(option) : valueSelector(option),
    [getOptionSecondaryLabel, valueSelector],
  );
  const secondaryClassSelector = useCallback(
    (option: TOption) => (getOptionSecondaryClassName ? getOptionSecondaryClassName(option) : ''),
    [getOptionSecondaryClassName],
  );

  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const listboxRef = useRef<HTMLUListElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const previousValueRef = useRef<string | null>(null);
  const lastSyncedLabelRef = useRef<string>('');
  const hasKeyboardNavigatedRef = useRef(false);
  const hasInitiallyScrolledRef = useRef(false);
  const [menuStyles, setMenuStyles] = useState<MenuStyles | null>(null);

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredOptions = useMemo(() => {
    if (!normalizedSearch) {
      return options;
    }

    return options.filter(option => {
      const label = labelSelector(option).toLowerCase();
      const optionValue = valueSelector(option).toLowerCase();
      return label.includes(normalizedSearch) || optionValue.includes(normalizedSearch);
    });
  }, [normalizedSearch, options, labelSelector, valueSelector]);

  const selectedOption = useMemo(
    () => options.find(option => valueSelector(option) === value),
    [options, value, valueSelector],
  );

  useEffect(() => {
    const nextLabel = selectedOption ? labelSelector(selectedOption) : '';
    if (
      value === previousValueRef.current &&
      nextLabel === lastSyncedLabelRef.current
    ) {
      return;
    }
    previousValueRef.current = value;
    lastSyncedLabelRef.current = nextLabel;
    setSearchTerm(nextLabel);
  }, [labelSelector, selectedOption, value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current?.contains(target)) {
        return;
      }
      if (menuRef.current?.contains(target)) {
        return;
      }
      hasKeyboardNavigatedRef.current = false;
      setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) {
      setMenuStyles(null);
      return undefined;
    }

    if (typeof window === 'undefined') {
      setMenuStyles(null);
      return undefined;
    }

    const updateMenuPosition = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) {
        setMenuStyles(null);
        return;
      }
      setMenuStyles({
        top: rect.bottom + DROPDOWN_VERTICAL_OFFSET,
        left: rect.left,
        width: rect.width,
      });
    };

    updateMenuPosition();
    window.addEventListener('scroll', updateMenuPosition, true);
    window.addEventListener('resize', updateMenuPosition);

    return () => {
      window.removeEventListener('scroll', updateMenuPosition, true);
      window.removeEventListener('resize', updateMenuPosition);
    };
  }, [isOpen]);

  // When the dropdown opens with no search term, highlight the selected option
  // When searching, reset to the first result
  useEffect(() => {
    if (normalizedSearch) {
      setHighlightedIndex(0);
    } else if (isOpen && selectedOption) {
      const selectedIndex = filteredOptions.findIndex(
        option => valueSelector(option) === value,
      );
      if (selectedIndex !== -1) {
        setHighlightedIndex(selectedIndex);
      }
    }
  }, [normalizedSearch, isOpen, selectedOption, filteredOptions, valueSelector, value]);

  const handleSelect = (option: TOption) => {
    const optionValue = valueSelector(option);
    setSearchTerm(labelSelector(option));
    setIsOpen(false);
    hasKeyboardNavigatedRef.current = false;
    inputRef.current?.blur();
    onChange(optionValue);
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    setSearchTerm(nextValue);
    setIsOpen(true);
    hasKeyboardNavigatedRef.current = false;

    if (!nextValue.trim() && allowEmptyValue) {
      onChange('');
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
      setIsOpen(true);
      hasKeyboardNavigatedRef.current = true;
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      hasKeyboardNavigatedRef.current = true;
      setHighlightedIndex(previous => {
        if (filteredOptions.length === 0) {
          return 0;
        }
        return Math.min(previous + 1, filteredOptions.length - 1);
      });
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      hasKeyboardNavigatedRef.current = true;
      setHighlightedIndex(previous => {
        if (filteredOptions.length === 0) {
          return 0;
        }
        return Math.max(previous - 1, 0);
      });
    } else if (event.key === 'Enter' && isOpen && filteredOptions[highlightedIndex]) {
      event.preventDefault();
      handleSelect(filteredOptions[highlightedIndex]);
    } else if (event.key === 'Tab') {
      if (selectOnTab && hasKeyboardNavigatedRef.current) {
        const option = filteredOptions[highlightedIndex];
        if (option) {
          const optionValue = valueSelector(option);
          if (optionValue !== value) {
            handleSelect(option);
            return;
          }
        }
      }
      hasKeyboardNavigatedRef.current = false;
      setIsOpen(false);
    } else if (event.key === 'Escape') {
      hasKeyboardNavigatedRef.current = false;
      setIsOpen(false);
    }
  };

  // Reset initial scroll flag when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      hasInitiallyScrolledRef.current = false;
    }
  }, [isOpen]);

  // Scroll to selected option once when dropdown first opens
  useEffect(() => {
    if (!isOpen || !menuStyles || hasInitiallyScrolledRef.current) {
      return;
    }

    // Find selected option index directly (don't rely on highlightedIndex state)
    const selectedIndex = selectedOption
      ? filteredOptions.findIndex(option => valueSelector(option) === value)
      : -1;

    if (selectedIndex === -1) {
      hasInitiallyScrolledRef.current = true;
      return;
    }

    // Use requestAnimationFrame to ensure DOM is rendered
    const frameId = requestAnimationFrame(() => {
      if (!listboxRef.current) {
        return;
      }
      const activeOption = listboxRef.current.querySelector<HTMLElement>(
        `[data-option-index="${selectedIndex}"]`,
      );
      if (activeOption) {
        activeOption.scrollIntoView({ block: 'nearest' });
      }
      hasInitiallyScrolledRef.current = true;
    });

    return () => cancelAnimationFrame(frameId);
  }, [isOpen, menuStyles, selectedOption, filteredOptions, valueSelector, value]);

  // Scroll to highlighted option during keyboard navigation
  useEffect(() => {
    if (!isOpen || !listboxRef.current || !hasKeyboardNavigatedRef.current) {
      return;
    }

    const activeOption = listboxRef.current.querySelector<HTMLElement>(
      `[data-option-index="${highlightedIndex}"]`,
    );
    if (activeOption) {
      activeOption.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, isOpen]);

  const activeOption = filteredOptions[highlightedIndex];
  const activeDescendant = activeOption ? `${resolvedId}-option-${valueSelector(activeOption)}` : undefined;
  const portalContainer = typeof document !== 'undefined' ? document.body : null;
  const dropdownMenu =
    isOpen && !disabled && menuStyles ? (
      <div
        ref={menuRef}
        role="presentation"
        className="z-50 w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
        style={{
          position: 'fixed',
          top: menuStyles.top,
          left: menuStyles.left,
          width: menuStyles.width,
          zIndex: 1000,
        }}
      >
        <ul
          id={listboxId}
          role="listbox"
          ref={listboxRef}
          className="max-h-60 overflow-y-auto py-1 text-sm"
          aria-label="Search results"
        >
          {filteredOptions.length === 0 ? (
            <li className="px-3 py-2 text-slate-500 dark:text-slate-400">{noOptionsMessage}</li>
          ) : (
            filteredOptions.map((option, index) => {
              const optionId = `${resolvedId}-option-${valueSelector(option)}`;
              const isActive = index === highlightedIndex;
              const secondaryLabel = secondaryLabelSelector(option);

              return (
                <li key={optionId} role="option" id={optionId} aria-selected={valueSelector(option) === value}>
                  <button
                    type="button"
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => handleSelect(option)}
                    data-option-index={index}
                    className={`flex w-full items-start gap-2 px-3 py-2 text-left transition ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-100'
                        : 'text-slate-700 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="flex-1">{labelSelector(option)}</span>
                    {secondaryLabel ? (
                      <span
                        className={`text-xs ${secondaryClassSelector(option) || 'text-slate-500 dark:text-slate-400'}`}
                      >
                        {secondaryLabel}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    ) : null;
  const renderedDropdown =
    dropdownMenu && portalContainer ? createPortal(dropdownMenu, portalContainer) : dropdownMenu;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        ref={inputRef}
        id={resolvedId}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-activedescendant={isOpen ? activeDescendant : undefined}
        value={searchTerm}
        placeholder={placeholder}
        onFocus={() => {
          hasKeyboardNavigatedRef.current = false;
          setSearchTerm('');
          setIsOpen(true);
        }}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          hasKeyboardNavigatedRef.current = false;
          setIsOpen(false);
          if (!allowEmptyValue && selectedOption) {
            setSearchTerm(labelSelector(selectedOption));
          }
          onBlur?.();
        }}
        disabled={disabled}
        className={`${baseInputClasses} ${inputClassName} ${disabled ? 'cursor-not-allowed opacity-75' : ''}`}
      />
      {allowClear && value && !disabled ? (
        <button
          type="button"
          aria-label="Clear selection"
          onMouseDown={event => event.preventDefault()}
          onClick={() => {
            setSearchTerm('');
            onChange('');
          }}
          className="absolute inset-y-0 right-2 my-1 flex items-center rounded px-2 text-xs text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 dark:focus:ring-offset-slate-900"
        >
          Clear
        </button>
      ) : null}
      {renderedDropdown}
    </div>
  );
}
