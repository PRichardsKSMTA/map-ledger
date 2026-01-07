import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import ModalBackdrop from '../ui/ModalBackdrop';
import type {
  CoaManagerAccountCreateInput,
  CoaManagerColumn,
  CoaManagerRow,
} from '../../services/coaManagerService';

interface AddCoaAccountsModalProps {
  open: boolean;
  industry: string;
  rows: CoaManagerRow[];
  columns: CoaManagerColumn[];
  onClose: () => void;
  onSubmit: (rows: CoaManagerAccountCreateInput[]) => Promise<void>;
}

type AddMode = 'subCategory' | 'laborGroup' | 'operationalGroup' | 'account';
type FlagValue = '' | 'true' | 'false';

type DraftRow = {
  key: string;
  accountName: string;
  laborGroup: string | null;
  operationalGroup: string | null;
  subCategory: string | null;
  category: string | null;
  accountType: string | null;
  costType: string | null;
  isFinancial: boolean | null;
  isSurvey: boolean | null;
  operationalCode: number | null;
  laborCode: number | null;
  baseCore: string;
};

type ReviewRow = DraftRow & {
  coreValue: string;
  accountNumber: string | null;
  error: string | null;
};

type SubCategorySelection = {
  value: string;
  subCategory: string;
  category: string | null;
  accountType: string | null;
  metadataLabel: string | null;
  isConflict: boolean;
};

type InlineNewOptionConfig = {
  isOpen: boolean;
  value: string;
  placeholder: string;
  errorMessage: string | null;
  onToggle: () => void;
  onChange: (value: string) => void;
  onAdd: () => void;
  onCancel: () => void;
};

const NEW_OPTION = '__new__';
const MAX_CREATE_ROWS = 500;
const CORE_ACCOUNT_PATTERN = /^\d{4}$/;

const sortValues = (values: string[]): string[] =>
  [...values].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

const toTitleCase = (value: string): string =>
  value
    .trim()
    .split(/\s+/)
    .map(word => {
      if (word === '-') {
        return word;
      }
      return word
        .split('-')
        .map(part =>
          part.length > 0 ? part[0].toUpperCase() + part.slice(1).toLowerCase() : part,
        )
        .join('-');
    })
    .join(' ');

const normalizeOptionValue = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeComparable = (value: string): string => value.trim().toLowerCase();

const hasDuplicateOption = (options: string[], value: string): boolean => {
  const normalized = normalizeComparable(value);
  return options.some(option => normalizeComparable(option) === normalized);
};

const mergeOptions = (options: string[], custom: string[]): string[] => {
  const merged = [...options];
  const existing = new Set(options.map(option => normalizeComparable(option)));
  custom.forEach(entry => {
    const normalized = normalizeComparable(entry);
    if (!existing.has(normalized)) {
      merged.push(entry);
      existing.add(normalized);
    }
  });
  return sortValues(merged);
};

const buildOptionList = (rows: CoaManagerRow[], selector: (row: CoaManagerRow) => string | null) => {
  const options = new Set<string>();
  rows.forEach(row => {
    const value = normalizeOptionValue(selector(row));
    if (value) {
      options.add(value);
    }
  });
  return sortValues(Array.from(options));
};

const parseFlagValue = (value: FlagValue): boolean | null => {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return null;
};

const formatAccountName = (
  baseName: string | null,
  laborGroup: string | null,
  operationalGroup: string | null,
): string => {
  const normalizeGroupPart = (value: string | null): string | null => {
    const normalized = normalizeOptionValue(value);
    if (!normalized) {
      return null;
    }
    return normalized.toLowerCase() === 'general' ? null : normalized;
  };

  const parts = [
    normalizeOptionValue(baseName),
    normalizeGroupPart(laborGroup),
    normalizeGroupPart(operationalGroup),
  ].filter((part): part is string => Boolean(part));
  return parts.join(' - ');
};

const ACCOUNT_NUMBER_PATTERN = /^(\d{4})-(\d+)-(\d+)$/;
const ACCOUNT_NUMBER_CODES_PATTERN = /^(\d+)-(\d+)-(\d+)$/;

const parseAccountNumber = (
  value?: string | null,
): { core: string; operationalCode: number; laborCode: number } | null => {
  if (!value) {
    return null;
  }
  const match = value.trim().match(ACCOUNT_NUMBER_PATTERN);
  if (!match) {
    return null;
  }
  const [, core, operational, labor] = match;
  const operationalCode = Number(operational);
  const laborCode = Number(labor);
  if (!Number.isFinite(operationalCode) || !Number.isFinite(laborCode)) {
    return null;
  }
  return { core, operationalCode, laborCode };
};

const parseAccountNumberCodes = (
  value?: string | null,
): { core: string; operationalCode: number; laborCode: number } | null => {
  if (!value) {
    return null;
  }
  const match = value.trim().match(ACCOUNT_NUMBER_CODES_PATTERN);
  if (!match) {
    return null;
  }
  const [, core, operational, labor] = match;
  const operationalCode = Number(operational);
  const laborCode = Number(labor);
  if (!Number.isFinite(operationalCode) || !Number.isFinite(laborCode)) {
    return null;
  }
  return { core, operationalCode, laborCode };
};

const formatGroupCode = (value: number): string => value.toString().padStart(3, '0');

const buildAccountNumber = (
  core: string,
  operationalCode: number | null,
  laborCode: number | null,
): string | null => {
  if (!CORE_ACCOUNT_PATTERN.test(core)) {
    return null;
  }
  if (operationalCode === null || laborCode === null) {
    return null;
  }
  return `${core}-${formatGroupCode(operationalCode)}-${formatGroupCode(laborCode)}`;
};

const resolveSelections = (
  selections: string[],
  options: string[],
): Array<string | null> => {
  if (selections.length > 0) {
    return selections;
  }
  if (options.length === 0) {
    return [null];
  }
  return [];
};

const DEFAULT_CATEGORY = 'Other Operating Expenses';
const DEFAULT_ACCOUNT_TYPE = 'Expense';

export default function AddCoaAccountsModal({
  open,
  industry,
  rows,
  columns,
  onClose,
  onSubmit,
}: AddCoaAccountsModalProps) {
  const [mode, setMode] = useState<AddMode>('account');
  const [newValue, setNewValue] = useState('');
  const [customLaborGroups, setCustomLaborGroups] = useState<string[]>([]);
  const [customOperationalGroups, setCustomOperationalGroups] = useState<string[]>([]);
  const [customSubCategories, setCustomSubCategories] = useState<string[]>([]);
  const [showNewLaborGroup, setShowNewLaborGroup] = useState(false);
  const [showNewOperationalGroup, setShowNewOperationalGroup] = useState(false);
  const [showNewSubCategory, setShowNewSubCategory] = useState(false);
  const [newLaborGroupName, setNewLaborGroupName] = useState('');
  const [newOperationalGroupName, setNewOperationalGroupName] = useState('');
  const [newSubCategoryName, setNewSubCategoryName] = useState('');
  const [selectedLaborGroups, setSelectedLaborGroups] = useState<string[]>([]);
  const [selectedOperationalGroups, setSelectedOperationalGroups] = useState<string[]>([]);
  const [selectedSubCategories, setSelectedSubCategories] = useState<string[]>([]);
  const [categoryChoice, setCategoryChoice] = useState('');
  const [categoryCustom, setCategoryCustom] = useState('');
  const [accountTypeChoice, setAccountTypeChoice] = useState('');
  const [accountTypeCustom, setAccountTypeCustom] = useState('');
  const [coreAccount, setCoreAccount] = useState('');
  const [costType, setCostType] = useState('');
  const [isFinancial, setIsFinancial] = useState<FlagValue>('true');
  const [isSurvey, setIsSurvey] = useState<FlagValue>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [coreOverrides, setCoreOverrides] = useState<Record<string, string>>({});

  const supportsAccountType = useMemo(
    () => columns.some(column => column.key === 'accountType'),
    [columns],
  );
  const supportsAccountNumber = useMemo(
    () => columns.some(column => column.key === 'accountNumber'),
    [columns],
  );
  const supportsCategory = useMemo(
    () => columns.some(column => column.key === 'category'),
    [columns],
  );

  useEffect(() => {
    if (open) {
      setMode('account');
      setNewValue('');
      setCustomLaborGroups([]);
      setCustomOperationalGroups([]);
      setCustomSubCategories([]);
      setShowNewLaborGroup(false);
      setShowNewOperationalGroup(false);
      setShowNewSubCategory(false);
      setNewLaborGroupName('');
      setNewOperationalGroupName('');
      setNewSubCategoryName('');
      setSelectedLaborGroups([]);
      setSelectedOperationalGroups([]);
      setSelectedSubCategories([]);
      setCategoryChoice('');
      setCategoryCustom('');
      setAccountTypeChoice('');
      setAccountTypeCustom('');
      setCoreAccount('');
      setCostType('');
      setIsFinancial('true');
      setIsSurvey('');
      setError(null);
      setIsSubmitting(false);
      setHasSubmitted(false);
      setShowReview(false);
      setCoreOverrides({});
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose, isSubmitting]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (mode === 'subCategory') {
      setSelectedSubCategories([]);
    }
    if (mode === 'laborGroup') {
      setSelectedLaborGroups([]);
    }
    if (mode === 'operationalGroup') {
      setSelectedOperationalGroups([]);
    }
    if (mode !== 'subCategory') {
      setCoreAccount('');
    }
  }, [mode, open]);

  const scopedRows = useMemo(() => {
    if (isFinancial === '') {
      return rows;
    }
    const shouldBeFinancial = isFinancial === 'true';
    const filtered = rows.filter(row => row.isFinancial === shouldBeFinancial);
    return filtered.length > 0 ? filtered : rows;
  }, [rows, isFinancial]);

  const allLaborGroupOptions = useMemo(
    () => buildOptionList(rows, row => row.laborGroup),
    [rows],
  );
  const allOperationalGroupOptions = useMemo(
    () => buildOptionList(rows, row => row.operationalGroup),
    [rows],
  );
  const allSubCategoryOptions = useMemo(
    () => buildOptionList(rows, row => row.subCategory),
    [rows],
  );
  const allAccountNameOptions = useMemo(
    () => buildOptionList(rows, row => row.accountName),
    [rows],
  );
  const allCategoryOptions = useMemo(
    () => buildOptionList(rows, row => row.category),
    [rows],
  );
  const allAccountTypeOptions = useMemo(
    () => buildOptionList(rows, row => row.accountType),
    [rows],
  );

  const baseLaborGroupOptions = useMemo(
    () => buildOptionList(scopedRows, row => row.laborGroup),
    [scopedRows],
  );
  const baseOperationalGroupOptions = useMemo(
    () => buildOptionList(scopedRows, row => row.operationalGroup),
    [scopedRows],
  );
  const laborGroupOptions = useMemo(
    () => mergeOptions(baseLaborGroupOptions, customLaborGroups),
    [baseLaborGroupOptions, customLaborGroups],
  );
  const operationalGroupOptions = useMemo(
    () => mergeOptions(baseOperationalGroupOptions, customOperationalGroups),
    [baseOperationalGroupOptions, customOperationalGroups],
  );
  const categoryOptions = useMemo(
    () => buildOptionList(scopedRows, row => row.category),
    [scopedRows],
  );
  const accountTypeOptions = useMemo(
    () => buildOptionList(scopedRows, row => row.accountType),
    [scopedRows],
  );

  const subCategorySelections = useMemo<SubCategorySelection[]>(() => {
    const groups = new Map<
      string,
      Map<string, { category: string | null; accountType: string | null }>
    >();

    scopedRows.forEach(row => {
      const subCategory = normalizeOptionValue(row.subCategory);
      if (!subCategory) {
        return;
      }
      const category = supportsCategory ? normalizeOptionValue(row.category) : null;
      const accountType = supportsAccountType ? normalizeOptionValue(row.accountType) : null;
      const comboKey = `${category ?? ''}||${accountType ?? ''}`;
      const combos = groups.get(subCategory);
      if (combos) {
        if (!combos.has(comboKey)) {
          combos.set(comboKey, { category, accountType });
        }
      } else {
        groups.set(subCategory, new Map([[comboKey, { category, accountType }]]));
      }
    });

    const selections: SubCategorySelection[] = [];
    groups.forEach((combos, subCategory) => {
      if (combos.size <= 1) {
        const entry = combos.values().next().value ?? { category: null, accountType: null };
        selections.push({
          value: subCategory,
          subCategory,
          category: entry.category ?? null,
          accountType: entry.accountType ?? null,
          metadataLabel: null,
          isConflict: false,
        });
        return;
      }

      const accountTypeValues = new Set(
        Array.from(combos.values()).map(entry => entry.accountType ?? ''),
      );
      const hasAccountTypeVariance = supportsAccountType && accountTypeValues.size > 1;

      combos.forEach(entry => {
        const categoryLabel = entry.category ?? 'Unassigned category';
        const accountTypeLabel = entry.accountType ?? 'Unassigned account type';
        const metadataLabel = hasAccountTypeVariance
          ? `Category: ${categoryLabel} | Account Type: ${accountTypeLabel}`
          : `Category: ${categoryLabel}`;
        const value = `${subCategory}||${entry.category ?? ''}||${entry.accountType ?? ''}`;
        selections.push({
          value,
          subCategory,
          category: entry.category ?? null,
          accountType: entry.accountType ?? null,
          metadataLabel,
          isConflict: true,
        });
      });
    });

    const existingValues = new Set(
      selections.map(option => normalizeComparable(option.subCategory)),
    );
    customSubCategories.forEach(value => {
      const normalized = normalizeComparable(value);
      if (existingValues.has(normalized)) {
        return;
      }
      selections.push({
        value,
        subCategory: value,
        category: null,
        accountType: null,
        metadataLabel: null,
        isConflict: false,
      });
      existingValues.add(normalized);
    });

    return selections.sort((a, b) => {
      const subCompare = a.subCategory.localeCompare(b.subCategory, undefined, {
        numeric: true,
        sensitivity: 'base',
      });
      if (subCompare !== 0) {
        return subCompare;
      }
      return (a.metadataLabel ?? '').localeCompare(b.metadataLabel ?? '', undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    });
  }, [customSubCategories, scopedRows, supportsAccountType, supportsCategory]);

  const subCategoryOptionValues = useMemo(
    () => subCategorySelections.map(option => option.value),
    [subCategorySelections],
  );

  const subCategorySelectionMap = useMemo(
    () => new Map(subCategorySelections.map(option => [option.value, option])),
    [subCategorySelections],
  );

  const formattedLaborGroupName = newLaborGroupName.trim()
    ? toTitleCase(newLaborGroupName)
    : '';
  const formattedOperationalGroupName = newOperationalGroupName.trim()
    ? toTitleCase(newOperationalGroupName)
    : '';
  const formattedSubCategoryName = newSubCategoryName.trim()
    ? toTitleCase(newSubCategoryName)
    : '';

  const laborGroupDuplicate =
    formattedLaborGroupName.length > 0 &&
    (hasDuplicateOption(allLaborGroupOptions, formattedLaborGroupName) ||
      hasDuplicateOption(customLaborGroups, formattedLaborGroupName));
  const operationalGroupDuplicate =
    formattedOperationalGroupName.length > 0 &&
    (hasDuplicateOption(allOperationalGroupOptions, formattedOperationalGroupName) ||
      hasDuplicateOption(customOperationalGroups, formattedOperationalGroupName));
  const subCategoryDuplicate =
    formattedSubCategoryName.length > 0 &&
    (hasDuplicateOption(allSubCategoryOptions, formattedSubCategoryName) ||
      hasDuplicateOption(customSubCategories, formattedSubCategoryName));

  const handleAddLaborGroup = () => {
    if (!formattedLaborGroupName || laborGroupDuplicate) {
      return;
    }
    setCustomLaborGroups(prev =>
      hasDuplicateOption(prev, formattedLaborGroupName) ? prev : [...prev, formattedLaborGroupName],
    );
    setSelectedLaborGroups(prev =>
      prev.includes(formattedLaborGroupName)
        ? prev
        : [...prev, formattedLaborGroupName],
    );
    setNewLaborGroupName('');
    setShowNewLaborGroup(false);
    setError(null);
  };

  const handleAddOperationalGroup = () => {
    if (!formattedOperationalGroupName || operationalGroupDuplicate) {
      return;
    }
    setCustomOperationalGroups(prev =>
      hasDuplicateOption(prev, formattedOperationalGroupName)
        ? prev
        : [...prev, formattedOperationalGroupName],
    );
    setSelectedOperationalGroups(prev =>
      prev.includes(formattedOperationalGroupName)
        ? prev
        : [...prev, formattedOperationalGroupName],
    );
    setNewOperationalGroupName('');
    setShowNewOperationalGroup(false);
    setError(null);
  };

  const handleAddSubCategory = () => {
    if (!formattedSubCategoryName || subCategoryDuplicate) {
      return;
    }
    setCustomSubCategories(prev =>
      hasDuplicateOption(prev, formattedSubCategoryName)
        ? prev
        : [...prev, formattedSubCategoryName],
    );
    setSelectedSubCategories(prev =>
      prev.includes(formattedSubCategoryName)
        ? prev
        : [...prev, formattedSubCategoryName],
    );
    setNewSubCategoryName('');
    setShowNewSubCategory(false);
    setError(null);
  };

  const groupCodes = useMemo(() => {
    const laborCodes = new Map<string, number>();
    const operationalCodes = new Map<string, number>();
    const laborConflicts = new Set<string>();
    const operationalConflicts = new Set<string>();
    let maxLaborCode = 0;
    let maxOperationalCode = 0;

    rows.forEach(row => {
      const parsed = parseAccountNumberCodes(row.accountNumber);
      if (!parsed) {
        return;
      }
      const { operationalCode, laborCode } = parsed;
      if (row.laborGroup) {
        const existing = laborCodes.get(row.laborGroup);
        if (existing !== undefined && existing !== laborCode) {
          laborConflicts.add(row.laborGroup);
        } else if (existing === undefined) {
          laborCodes.set(row.laborGroup, laborCode);
        }
        maxLaborCode = Math.max(maxLaborCode, laborCode);
      }
      if (row.operationalGroup) {
        const existing = operationalCodes.get(row.operationalGroup);
        if (existing !== undefined && existing !== operationalCode) {
          operationalConflicts.add(row.operationalGroup);
        } else if (existing === undefined) {
          operationalCodes.set(row.operationalGroup, operationalCode);
        }
        maxOperationalCode = Math.max(maxOperationalCode, operationalCode);
      }
    });

    return {
      laborCodes,
      operationalCodes,
      laborConflicts,
      operationalConflicts,
      maxLaborCode,
      maxOperationalCode,
    };
  }, [rows]);

  const customLaborGroupCodes = useMemo(() => {
    const codes = new Map<string, number>();
    if (customLaborGroups.length === 0) {
      return codes;
    }
    let nextCode = groupCodes.maxLaborCode + 100;
    customLaborGroups.forEach(group => {
      codes.set(group, nextCode);
      nextCode += 100;
    });
    return codes;
  }, [customLaborGroups, groupCodes.maxLaborCode]);

  const customOperationalGroupCodes = useMemo(() => {
    const codes = new Map<string, number>();
    if (customOperationalGroups.length === 0) {
      return codes;
    }
    let nextCode = groupCodes.maxOperationalCode + 100;
    customOperationalGroups.forEach(group => {
      codes.set(group, nextCode);
      nextCode += 100;
    });
    return codes;
  }, [customOperationalGroups, groupCodes.maxOperationalCode]);

  const existingAccountNumbers = useMemo(() => {
    const values = new Set<string>();
    rows.forEach(row => {
      const accountNumber = normalizeOptionValue(row.accountNumber);
      if (accountNumber) {
        values.add(accountNumber);
      }
    });
    return values;
  }, [rows]);

  const existingCoreAccounts = useMemo(() => {
    const values = new Set<string>();
    rows.forEach(row => {
      const parsed = parseAccountNumberCodes(row.accountNumber);
      if (parsed?.core) {
        values.add(parsed.core);
      }
    });
    return values;
  }, [rows]);

  const subCategoryCoreMap = useMemo(() => {
    const coreCounts = new Map<string, Map<string, number>>();

    scopedRows.forEach(row => {
      const subCategory = normalizeOptionValue(row.subCategory);
      const parsed = parseAccountNumberCodes(row.accountNumber);
      if (!subCategory || !parsed) {
        return;
      }
      const counts = coreCounts.get(subCategory) ?? new Map<string, number>();
      counts.set(parsed.core, (counts.get(parsed.core) ?? 0) + 1);
      coreCounts.set(subCategory, counts);
    });

    const preferred = new Map<string, string>();
    coreCounts.forEach((counts, subCategory) => {
      let bestCore = '';
      let bestCount = -1;
      let bestNumeric = Number.POSITIVE_INFINITY;
      counts.forEach((count, core) => {
        const numeric = Number(core);
        if (
          count > bestCount ||
          (count === bestCount && Number.isFinite(numeric) && numeric < bestNumeric)
        ) {
          bestCore = core;
          bestCount = count;
          bestNumeric = numeric;
        }
      });
      if (bestCore) {
        preferred.set(subCategory, bestCore);
      }
    });

    return preferred;
  }, [scopedRows]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setSelectedLaborGroups(previous =>
      previous.filter(option => laborGroupOptions.includes(option)),
    );
  }, [laborGroupOptions, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setSelectedOperationalGroups(previous =>
      previous.filter(option => operationalGroupOptions.includes(option)),
    );
  }, [operationalGroupOptions, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setSelectedSubCategories(previous =>
      previous.filter(option => subCategoryOptionValues.includes(option)),
    );
  }, [subCategoryOptionValues, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (
      categoryChoice &&
      categoryChoice !== NEW_OPTION &&
      !categoryOptions.includes(categoryChoice)
    ) {
      const nextCategory = categoryOptions.includes(DEFAULT_CATEGORY)
        ? DEFAULT_CATEGORY
        : categoryOptions[0] ?? '';
      setCategoryChoice(nextCategory);
    }
  }, [categoryChoice, categoryOptions, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (
      accountTypeChoice &&
      accountTypeChoice !== NEW_OPTION &&
      !accountTypeOptions.includes(accountTypeChoice)
    ) {
      const nextAccountType = accountTypeOptions.includes(DEFAULT_ACCOUNT_TYPE)
        ? DEFAULT_ACCOUNT_TYPE
        : accountTypeOptions[0] ?? '';
      setAccountTypeChoice(nextAccountType);
    }
  }, [accountTypeChoice, accountTypeOptions, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (mode !== 'subCategory' && mode !== 'account') {
      return;
    }
    if (!categoryChoice) {
      const nextCategory = categoryOptions.includes(DEFAULT_CATEGORY)
        ? DEFAULT_CATEGORY
        : categoryOptions[0] ?? '';
      setCategoryChoice(nextCategory);
    }
    if (!accountTypeChoice) {
      const nextAccountType = accountTypeOptions.includes(DEFAULT_ACCOUNT_TYPE)
        ? DEFAULT_ACCOUNT_TYPE
        : accountTypeOptions[0] ?? '';
      setAccountTypeChoice(nextAccountType);
    }
  }, [accountTypeChoice, accountTypeOptions, categoryChoice, categoryOptions, mode, open]);

  const preview = useMemo(() => {
    const errors: string[] = [];
    const trimmedNewValue = newValue.trim();
    const formattedNewValue = trimmedNewValue ? toTitleCase(trimmedNewValue) : '';
    const normalizedNewValue = trimmedNewValue.toLowerCase();

    if (!trimmedNewValue) {
      errors.push('Enter a value for the new name.');
    }

    const existingValues =
      mode === 'subCategory'
        ? allSubCategoryOptions
        : mode === 'laborGroup'
          ? allLaborGroupOptions
          : mode === 'operationalGroup'
            ? allOperationalGroupOptions
            : allAccountNameOptions;
    if (
      trimmedNewValue &&
      existingValues.some(option => option.toLowerCase() === normalizedNewValue)
    ) {
      errors.push('That value already exists for this industry.');
    }

    const resolvedCategory =
      categoryChoice === NEW_OPTION ? categoryCustom.trim() : categoryChoice.trim();
    const resolvedAccountType =
      accountTypeChoice === NEW_OPTION ? accountTypeCustom.trim() : accountTypeChoice.trim();
    const normalizedCore = coreAccount.trim();

    if ((mode === 'subCategory' || mode === 'account') && supportsCategory && !resolvedCategory) {
      errors.push('Select a category to assign to the new accounts.');
    }

    if (
      (mode === 'subCategory' || mode === 'account') &&
      supportsAccountType &&
      !resolvedAccountType
    ) {
      errors.push('Select an account type to assign to the new accounts.');
    }

    if (
      (mode === 'subCategory' || mode === 'account') &&
      categoryChoice === NEW_OPTION &&
      resolvedCategory &&
      allCategoryOptions.some(
        option => option.toLowerCase() === resolvedCategory.toLowerCase(),
      )
    ) {
      errors.push('That category already exists for this industry.');
    }

    if (
      (mode === 'subCategory' || mode === 'account') &&
      accountTypeChoice === NEW_OPTION &&
      resolvedAccountType &&
      allAccountTypeOptions.some(
        option => option.toLowerCase() === resolvedAccountType.toLowerCase(),
      )
    ) {
      errors.push('That account type already exists for this industry.');
    }

    if (mode !== 'laborGroup' && laborGroupOptions.length > 0 && selectedLaborGroups.length === 0) {
      errors.push('Select at least one labor group.');
    }
    if (
      mode !== 'operationalGroup' &&
      operationalGroupOptions.length > 0 &&
      selectedOperationalGroups.length === 0
    ) {
      errors.push('Select at least one operational group.');
    }
    if (
      mode !== 'subCategory' &&
      subCategoryOptionValues.length > 0 &&
      selectedSubCategories.length === 0
    ) {
      errors.push('Select at least one sub category.');
    }

    const resolvedLaborGroups =
      mode === 'laborGroup' ? [formattedNewValue] : selectedLaborGroups;
    const resolvedOperationalGroups =
      mode === 'operationalGroup' ? [formattedNewValue] : selectedOperationalGroups;
    const resolvedSubCategories =
      mode === 'subCategory' ? [formattedNewValue] : selectedSubCategories;

    const normalizedLaborGroups = resolveSelections(resolvedLaborGroups, laborGroupOptions);
    const normalizedOperationalGroups = resolveSelections(
      resolvedOperationalGroups,
      operationalGroupOptions,
    );
    const normalizedSubCategories = resolveSelections(
      resolvedSubCategories,
      subCategoryOptionValues,
    );

    const normalizedSubCategorySelections =
      mode === 'subCategory' || mode === 'account'
        ? normalizedSubCategories.map(value => {
            if (!value) {
              return null;
            }
            const selection = subCategorySelectionMap.get(value);
            return {
              value,
              subCategory: selection?.subCategory ?? value,
              category: resolvedCategory || null,
              accountType: resolvedAccountType || null,
            };
          })
        : normalizedSubCategories.map(value => {
            if (!value) {
              return null;
            }
            const selection = subCategorySelectionMap.get(value);
            if (!selection) {
              errors.push('Unable to determine metadata for selected sub category.');
              return null;
            }
            return selection;
          });

    const totalCount =
      normalizedLaborGroups.length *
      normalizedOperationalGroups.length *
      normalizedSubCategories.length;

    if (totalCount === 0) {
      errors.push('Select the combinations to create.');
    }
    if (totalCount > MAX_CREATE_ROWS) {
      errors.push(`Reduce selections to ${MAX_CREATE_ROWS} accounts or fewer.`);
    }

    if ((mode === 'subCategory' || mode === 'account') && supportsAccountNumber) {
      if (!normalizedCore) {
        errors.push('Core account is required.');
      } else if (!CORE_ACCOUNT_PATTERN.test(normalizedCore)) {
        errors.push('Core account must be a 4-digit number.');
      } else if (existingCoreAccounts.has(normalizedCore)) {
        errors.push('Core account already exists for this industry.');
      }
    }

    const nextLaborGroupCode =
      mode === 'laborGroup' ? groupCodes.maxLaborCode + 100 : null;
    const nextOperationalGroupCode =
      mode === 'operationalGroup' ? groupCodes.maxOperationalCode + 100 : null;

    if (mode === 'laborGroup' && groupCodes.maxLaborCode <= 0) {
      errors.push('Unable to derive a labor group code from existing accounts.');
    }
    if (mode === 'operationalGroup' && groupCodes.maxOperationalCode <= 0) {
      errors.push('Unable to derive an operational group code from existing accounts.');
    }

    const hasCustomLaborSelection = normalizedLaborGroups.some(
      laborGroup => laborGroup && customLaborGroupCodes.has(laborGroup),
    );
    const hasCustomOperationalSelection = normalizedOperationalGroups.some(
      operationalGroup =>
        operationalGroup && customOperationalGroupCodes.has(operationalGroup),
    );
    if (hasCustomLaborSelection && groupCodes.maxLaborCode <= 0) {
      errors.push('Unable to derive a labor group code from existing accounts.');
    }
    if (hasCustomOperationalSelection && groupCodes.maxOperationalCode <= 0) {
      errors.push('Unable to derive an operational group code from existing accounts.');
    }

    normalizedLaborGroups.forEach(laborGroup => {
      if (!laborGroup) {
        errors.push('Select a labor group to apply.');
        return;
      }
      if (mode !== 'laborGroup') {
        if (customLaborGroupCodes.has(laborGroup)) {
          return;
        }
        if (groupCodes.laborConflicts.has(laborGroup)) {
          errors.push(`Labor group "${laborGroup}" has inconsistent codes.`);
        } else if (!groupCodes.laborCodes.has(laborGroup)) {
          errors.push(`Unable to determine a code for labor group "${laborGroup}".`);
        }
      }
    });

    normalizedOperationalGroups.forEach(operationalGroup => {
      if (!operationalGroup) {
        errors.push('Select an operational group to apply.');
        return;
      }
      if (mode !== 'operationalGroup') {
        if (customOperationalGroupCodes.has(operationalGroup)) {
          return;
        }
        if (groupCodes.operationalConflicts.has(operationalGroup)) {
          errors.push(`Operational group "${operationalGroup}" has inconsistent codes.`);
        } else if (!groupCodes.operationalCodes.has(operationalGroup)) {
          errors.push(`Unable to determine a code for operational group "${operationalGroup}".`);
        }
      }
    });

    if (mode !== 'subCategory' && mode !== 'account') {
      normalizedSubCategorySelections.forEach(selection => {
        if (!selection) {
          errors.push('Select a sub category to apply.');
          return;
        }
        if (supportsCategory && !selection.category) {
          errors.push(`Missing category for sub category "${selection.subCategory}".`);
        }
        if (supportsAccountType && !selection.accountType) {
          errors.push(`Missing account type for sub category "${selection.subCategory}".`);
        }
        if (supportsAccountNumber && !subCategoryCoreMap.get(selection.subCategory)) {
          errors.push(`Unable to determine a core account for "${selection.subCategory}".`);
        }
      });
    }

    const parsedIsFinancial = parseFlagValue(isFinancial);
    const parsedIsSurvey = parseFlagValue(isSurvey);
    const resolvedCostType = costType.trim();

    const draftRows: DraftRow[] = [];
    normalizedSubCategorySelections.forEach(selection => {
      const subCategory = selection?.subCategory ?? null;
      normalizedLaborGroups.forEach(laborGroup => {
        normalizedOperationalGroups.forEach(operationalGroup => {
          const baseName = mode === 'account' ? formattedNewValue : subCategory;
          const accountName = formatAccountName(baseName, laborGroup, operationalGroup);
          if (!accountName) {
            return;
          }
          const operationalCode = operationalGroup
            ? customOperationalGroupCodes.get(operationalGroup) ??
              groupCodes.operationalCodes.get(operationalGroup) ??
              (mode === 'operationalGroup' ? nextOperationalGroupCode : null)
            : mode === 'operationalGroup'
              ? nextOperationalGroupCode
              : null;
          const laborCode = laborGroup
            ? customLaborGroupCodes.get(laborGroup) ??
              groupCodes.laborCodes.get(laborGroup) ??
              (mode === 'laborGroup' ? nextLaborGroupCode : null)
            : mode === 'laborGroup'
              ? nextLaborGroupCode
              : null;
          const metadata =
            mode === 'subCategory' || mode === 'account' || !selection
              ? null
              : {
                  category: selection.category,
                  accountType: selection.accountType,
                };
          const resolvedCategoryValue =
            mode === 'subCategory' || mode === 'account'
              ? resolvedCategory || null
              : metadata?.category ?? null;
          const resolvedAccountTypeValue =
            mode === 'subCategory' || mode === 'account'
              ? resolvedAccountType || null
              : metadata?.accountType ?? null;

          const baseCore =
            mode === 'subCategory' || mode === 'account'
              ? normalizedCore
              : subCategory
                ? subCategoryCoreMap.get(subCategory) ?? ''
                : '';

          draftRows.push({
            key: `${subCategory ?? ''}|${laborGroup ?? ''}|${operationalGroup ?? ''}|${draftRows.length}`,
            baseCore,
            accountName,
            laborGroup,
            operationalGroup,
            category: supportsCategory ? resolvedCategoryValue : null,
            accountType: supportsAccountType ? resolvedAccountTypeValue : null,
            subCategory,
            costType: resolvedCostType || null,
            isFinancial: parsedIsFinancial,
            isSurvey: parsedIsSurvey,
            operationalCode,
            laborCode,
          });
        });
      });
    });

    return {
      rows: draftRows,
      errors,
      count: draftRows.length,
    };
  }, [
    allAccountTypeOptions,
    allCategoryOptions,
    allLaborGroupOptions,
    allOperationalGroupOptions,
    allSubCategoryOptions,
    accountTypeChoice,
    accountTypeCustom,
    accountTypeOptions,
    categoryChoice,
    categoryCustom,
    categoryOptions,
    coreAccount,
    costType,
    customLaborGroupCodes,
    customOperationalGroupCodes,
    existingCoreAccounts,
    groupCodes,
    isFinancial,
    isSurvey,
    laborGroupOptions,
    mode,
    newValue,
    operationalGroupOptions,
    selectedLaborGroups,
    selectedOperationalGroups,
    selectedSubCategories,
    subCategoryOptionValues,
    subCategoryCoreMap,
    subCategorySelectionMap,
    subCategorySelections,
    supportsAccountNumber,
    supportsAccountType,
    supportsCategory,
  ]);

  const draftFingerprint = useMemo(
    () =>
      preview.rows.map(row => `${row.key}:${row.baseCore}`).join('|'),
    [preview.rows],
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    setShowReview(false);
    setCoreOverrides({});
    setHasSubmitted(false);
    setError(null);
  }, [draftFingerprint, open]);

  const reviewRows = useMemo<ReviewRow[]>(() => {
    if (!showReview) {
      return [];
    }

    const counts = new Map<string, number>();
    const mapped = preview.rows.map(row => {
      const coreValue = (coreOverrides[row.key] ?? row.baseCore).trim();
      const accountNumber = buildAccountNumber(coreValue, row.operationalCode, row.laborCode);
      if (accountNumber) {
        counts.set(accountNumber, (counts.get(accountNumber) ?? 0) + 1);
      }
      return {
        ...row,
        coreValue,
        accountNumber,
        error: null,
      } as ReviewRow;
    });

    const duplicates = new Set(
      Array.from(counts.entries())
        .filter(([, count]) => count > 1)
        .map(([accountNumber]) => accountNumber),
    );

    return mapped.map(row => {
      let errorMessage: string | null = null;
      if (!CORE_ACCOUNT_PATTERN.test(row.coreValue)) {
        errorMessage = 'Core account must be a 4-digit number.';
      } else if (!row.accountNumber) {
        errorMessage = 'Account number is incomplete.';
      } else if (existingAccountNumbers.has(row.accountNumber)) {
        errorMessage = 'Account number already exists.';
      } else if (duplicates.has(row.accountNumber)) {
        errorMessage = 'Duplicate account number in this batch.';
      }
      return { ...row, error: errorMessage };
    });
  }, [coreOverrides, existingAccountNumbers, preview.rows, showReview]);

  if (!open) {
    return null;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setHasSubmitted(true);
    if (preview.errors.length > 0) {
      setError(preview.errors[0] ?? 'Resolve the highlighted issues before continuing.');
      return;
    }

    if (!showReview) {
      const initialOverrides: Record<string, string> = {};
      preview.rows.forEach(row => {
        initialOverrides[row.key] = row.baseCore;
      });
      setCoreOverrides(initialOverrides);
      setShowReview(true);
      return;
    }

    if (reviewRows.some(row => row.error)) {
      setError('Resolve the highlighted account number issues before continuing.');
      return;
    }

    const rowsToSubmit: CoaManagerAccountCreateInput[] = reviewRows.map(row => ({
      accountNumber: row.accountNumber ?? null,
      coreAccount: row.coreValue,
      operationalGroupCode:
        row.operationalCode !== null ? formatGroupCode(row.operationalCode) : null,
      laborGroupCode: row.laborCode !== null ? formatGroupCode(row.laborCode) : null,
      accountName: row.accountName,
      laborGroup: row.laborGroup,
      operationalGroup: row.operationalGroup,
      category: row.category,
      accountType: row.accountType,
      subCategory: row.subCategory,
      costType: row.costType,
      isFinancial: row.isFinancial,
      isSurvey: row.isSurvey,
    }));

    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit(rowsToSubmit);
      onClose();
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : 'Unable to add accounts.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldErrorMessages = new Set([
    'Enter a value for the new name.',
    'Select at least one labor group.',
    'Select at least one operational group.',
    'Select at least one sub category.',
    'Select a category to assign to the new accounts.',
    'Select an account type to assign to the new accounts.',
    'Select the combinations to create.',
    'Core account is required.',
    'Core account must be a 4-digit number.',
    'Core account already exists for this industry.',
    'Unable to determine metadata for selected sub category.',
  ]);
  const filteredPreviewErrors = preview.errors.filter(
    message => !fieldErrorMessages.has(message),
  );
  const immediateError =
    filteredPreviewErrors.find(message =>
      [
        'already exists',
        'inconsistent',
        'Unable to determine',
      ].some(keyword => message.includes(keyword)),
    ) ?? null;
  const reviewError = showReview ? reviewRows.find(row => row.error)?.error ?? null : null;
  const displayError =
    error ??
    reviewError ??
    (hasSubmitted ? filteredPreviewErrors[0] ?? null : immediateError);
  const hasInlineDuplicate =
    laborGroupDuplicate || operationalGroupDuplicate || subCategoryDuplicate;
  const isSubmitDisabled =
    isSubmitting ||
    preview.errors.length > 0 ||
    hasInlineDuplicate ||
    (showReview && reviewRows.some(row => row.error));

  const submitLabel = showReview ? 'Create Accounts' : 'Add Accounts';

  const renderMultiSelect = (
    label: string,
    options: string[],
    selections: string[],
    onChange: (next: string[]) => void,
    isRequired = false,
    newOption?: InlineNewOptionConfig,
  ) => (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-gray-700">
          {label}
          {isRequired && <span className="ml-1 text-red-600">*</span>}
        </span>
        {(options.length > 0 || newOption) && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            {newOption && (
              <button
                type="button"
                onClick={newOption.onToggle}
                className="font-medium text-blue-600 hover:text-blue-700"
              >
                + New
              </button>
            )}
            {options.length > 0 && (
              <>
                <span>|</span>
                <button
                  type="button"
                  onClick={() => onChange(options)}
                  className="font-medium text-blue-600 hover:text-blue-700"
                >
                  Select all
                </button>
                <span>|</span>
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="font-medium text-gray-600 hover:text-gray-800"
                >
                  Clear
                </button>
              </>
            )}
          </div>
        )}
      </div>
      {newOption?.isOpen && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={newOption.value}
            onChange={event => newOption.onChange(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault();
                newOption.onAdd();
              }
            }}
            placeholder={newOption.placeholder}
            className="w-full max-w-xs rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isSubmitting}
            autoFocus
          />
          <button
            type="button"
            onClick={newOption.onAdd}
            className="text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            Add
          </button>
          <button
            type="button"
            onClick={newOption.onCancel}
            className="text-xs font-medium text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
        </div>
      )}
      {newOption?.errorMessage && (
        <span className="text-xs font-normal text-red-600">
          {newOption.errorMessage}
        </span>
      )}
      {options.length === 0 ? (
        <p className="text-xs text-gray-500">No options available for this industry.</p>
      ) : (
        <div className="grid max-h-40 gap-2 overflow-y-auto rounded-md border border-gray-200 bg-gray-100 p-3 sm:grid-cols-2">
          {options.map(option => (
            <label key={option} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={selections.includes(option)}
                onChange={event => {
                  const next = event.target.checked
                    ? [...selections, option]
                    : selections.filter(item => item !== option);
                  onChange(next);
                  setError(null);
                }}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              {option}
            </label>
          ))}
        </div>
      )}
    </div>
  );

  const renderSubCategoryMultiSelect = (
    label: string,
    options: SubCategorySelection[],
    selections: string[],
    onChange: (next: string[]) => void,
    isRequired = false,
    newOption?: InlineNewOptionConfig,
  ) => (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-gray-700">
          {label}
          {isRequired && <span className="ml-1 text-red-600">*</span>}
        </span>
        {(options.length > 0 || newOption) && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            {newOption && (
              <button
                type="button"
                onClick={newOption.onToggle}
                className="font-medium text-blue-600 hover:text-blue-700"
              >
                + New
              </button>
            )}
            {options.length > 0 && (
              <>
                <span>|</span>
                <button
                  type="button"
                  onClick={() => onChange(options.map(option => option.value))}
                  className="font-medium text-blue-600 hover:text-blue-700"
                >
                  Select all
                </button>
                <span>|</span>
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="font-medium text-gray-600 hover:text-gray-800"
                >
                  Clear
                </button>
              </>
            )}
          </div>
        )}
      </div>
      {newOption?.isOpen && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={newOption.value}
            onChange={event => newOption.onChange(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault();
                newOption.onAdd();
              }
            }}
            placeholder={newOption.placeholder}
            className="w-full max-w-xs rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isSubmitting}
            autoFocus
          />
          <button
            type="button"
            onClick={newOption.onAdd}
            className="text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            Add
          </button>
          <button
            type="button"
            onClick={newOption.onCancel}
            className="text-xs font-medium text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
        </div>
      )}
      {newOption?.errorMessage && (
        <span className="text-xs font-normal text-red-600">
          {newOption.errorMessage}
        </span>
      )}
      {options.length === 0 ? (
        <p className="text-xs text-gray-500">No options available for this industry.</p>
      ) : (
        <div className="grid max-h-72 gap-3 overflow-y-auto rounded-md border border-gray-200 bg-gray-100 p-3 sm:grid-cols-2">
          {options.map(option => (
            <label
              key={option.value}
              className="flex items-start gap-2 text-sm text-gray-700"
              title={option.metadataLabel ?? option.subCategory}
            >
              <input
                type="checkbox"
                checked={selections.includes(option.value)}
                onChange={event => {
                  const next = event.target.checked
                    ? [...selections, option.value]
                    : selections.filter(item => item !== option.value);
                  onChange(next);
                  setError(null);
                }}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="flex flex-col leading-snug">
                <span className="text-sm text-gray-700">
                  {option.subCategory}
                </span>
                {option.metadataLabel && (
                  <span className="text-xs font-normal text-gray-500">
                    {option.metadataLabel}
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );

  const label =
    mode === 'subCategory'
      ? 'Sub category'
      : mode === 'laborGroup'
        ? 'Labor group'
        : mode === 'operationalGroup'
          ? 'Operational group'
          : 'Account';

  const newNameLabel = mode === 'account' ? 'New account name' : `New ${label} name`;
  const newNamePlaceholder =
    mode === 'account' ? 'Enter account name' : `Enter ${label.toLowerCase()} name`;

  const normalizedCore = coreAccount.trim();
  const isCoreRequired =
    (mode === 'subCategory' || mode === 'account') && supportsAccountNumber;
  const isCoreInvalid =
    isCoreRequired && normalizedCore.length > 0 && !CORE_ACCOUNT_PATTERN.test(normalizedCore);
  const isCoreDuplicate =
    isCoreRequired && normalizedCore.length > 0 && existingCoreAccounts.has(normalizedCore);
  const coreHelperText = isCoreInvalid
    ? 'Core account must be a 4-digit number.'
    : isCoreDuplicate
      ? 'That core account already exists for this industry.'
      : null;

  const laborGroupNewConfig: InlineNewOptionConfig = {
    isOpen: showNewLaborGroup,
    value: newLaborGroupName,
    placeholder: 'New labor group',
    errorMessage: laborGroupDuplicate ? 'Labor group already exists.' : null,
    onToggle: () =>
      setShowNewLaborGroup(prev => {
        if (prev) {
          setNewLaborGroupName('');
        }
        return !prev;
      }),
    onChange: setNewLaborGroupName,
    onAdd: handleAddLaborGroup,
    onCancel: () => {
      setShowNewLaborGroup(false);
      setNewLaborGroupName('');
    },
  };

  const operationalGroupNewConfig: InlineNewOptionConfig = {
    isOpen: showNewOperationalGroup,
    value: newOperationalGroupName,
    placeholder: 'New operational group',
    errorMessage: operationalGroupDuplicate ? 'Operational group already exists.' : null,
    onToggle: () =>
      setShowNewOperationalGroup(prev => {
        if (prev) {
          setNewOperationalGroupName('');
        }
        return !prev;
      }),
    onChange: setNewOperationalGroupName,
    onAdd: handleAddOperationalGroup,
    onCancel: () => {
      setShowNewOperationalGroup(false);
      setNewOperationalGroupName('');
    },
  };

  const subCategoryNewConfig: InlineNewOptionConfig = {
    isOpen: showNewSubCategory,
    value: newSubCategoryName,
    placeholder: 'New sub category',
    errorMessage: subCategoryDuplicate ? 'Sub category already exists.' : null,
    onToggle: () =>
      setShowNewSubCategory(prev => {
        if (prev) {
          setNewSubCategoryName('');
        }
        return !prev;
      }),
    onChange: setNewSubCategoryName,
    onAdd: handleAddSubCategory,
    onCancel: () => {
      setShowNewSubCategory(false);
      setNewSubCategoryName('');
    },
  };

  return (
    <ModalBackdrop className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-coa-title"
        className="w-full max-w-3xl max-h-[calc(100vh-2rem)] overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={event => event.stopPropagation()}
      >
        <form
          onSubmit={handleSubmit}
          className="max-h-[calc(100vh-2rem)] space-y-5 overflow-y-auto p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="add-coa-title" className="text-lg font-semibold text-gray-900">
                Add chart of accounts records
              </h2>
              <p className="text-sm text-gray-600">
                Create multiple accounts for {industry || 'this industry'} in one step.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-full p-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed"
              aria-label="Close modal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              <span className="flex items-center gap-1">
                {newNameLabel}
                <span className="text-red-600">*</span>
              </span>
              <input
                type="text"
                value={newValue}
                onChange={event => {
                  setNewValue(event.target.value);
                  setError(null);
                }}
                placeholder={newNamePlaceholder}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isSubmitting}
                autoFocus
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Account scope
              <select
                value={isFinancial}
                onChange={event => {
                  setIsFinancial(event.target.value as FlagValue);
                  setError(null);
                }}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isSubmitting}
              >
                <option value="">Unset</option>
                <option value="true">Financial</option>
                <option value="false">Operational</option>
              </select>
            </label>
          </div>

          <div className="space-y-4">
            {mode !== 'laborGroup' &&
              renderMultiSelect(
                'Labor groups to apply',
                laborGroupOptions,
                selectedLaborGroups,
                setSelectedLaborGroups,
                true,
                laborGroupNewConfig,
              )}
            {mode !== 'operationalGroup' &&
              renderMultiSelect(
                'Operational groups to apply',
                operationalGroupOptions,
                selectedOperationalGroups,
                setSelectedOperationalGroups,
                true,
                operationalGroupNewConfig,
              )}
            {mode !== 'subCategory' &&
              renderSubCategoryMultiSelect(
                'Sub categories to apply',
                subCategorySelections,
                selectedSubCategories,
                setSelectedSubCategories,
                true,
                subCategoryNewConfig,
              )}
          </div>

          {(mode === 'subCategory' || mode === 'account') && (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                {supportsCategory && (
                  <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                    <span className="flex items-center gap-1">
                      Category
                      <span className="text-red-600">*</span>
                    </span>
                    <select
                      value={categoryChoice}
                      onChange={event => {
                        setCategoryChoice(event.target.value);
                        if (event.target.value !== NEW_OPTION) {
                          setCategoryCustom('');
                        }
                        setError(null);
                      }}
                      className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={isSubmitting}
                    >
                      {categoryOptions.map(option => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                      <option value={NEW_OPTION}>Add new category</option>
                    </select>
                  </label>
                )}

                {supportsAccountType && (
                  <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                    <span className="flex items-center gap-1">
                      Account type
                      <span className="text-red-600">*</span>
                    </span>
                    <select
                      value={accountTypeChoice}
                      onChange={event => {
                        setAccountTypeChoice(event.target.value);
                        if (event.target.value !== NEW_OPTION) {
                          setAccountTypeCustom('');
                        }
                        setError(null);
                      }}
                      className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={isSubmitting}
                    >
                      {accountTypeOptions.map(option => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                      <option value={NEW_OPTION}>Add new account type</option>
                    </select>
                  </label>
                )}
              </div>

              {(supportsCategory && categoryChoice === NEW_OPTION) ||
              (supportsAccountType && accountTypeChoice === NEW_OPTION) ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {supportsCategory && categoryChoice === NEW_OPTION ? (
                    <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                      <span className="flex items-center gap-1">
                        New category
                        <span className="text-red-600">*</span>
                      </span>
                      <input
                        type="text"
                        value={categoryCustom}
                        onChange={event => {
                          setCategoryCustom(event.target.value);
                          setError(null);
                        }}
                        placeholder="Enter category name"
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={isSubmitting}
                      />
                    </label>
                  ) : (
                    <div aria-hidden="true" />
                  )}
                  {supportsAccountType && accountTypeChoice === NEW_OPTION ? (
                    <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                      <span className="flex items-center gap-1">
                        New account type
                        <span className="text-red-600">*</span>
                      </span>
                      <input
                        type="text"
                        value={accountTypeCustom}
                        onChange={event => {
                          setAccountTypeCustom(event.target.value);
                          setError(null);
                        }}
                        placeholder="Enter account type"
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={isSubmitting}
                      />
                    </label>
                  ) : (
                    <div aria-hidden="true" />
                  )}
                </div>
              ) : null}
            </>
          )}

          {(mode === 'subCategory' || mode === 'account') && supportsAccountNumber && (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-medium text-gray-700 md:col-span-2">
                <span className="flex items-center gap-1">
                  Core account number
                  <span className="text-red-600">*</span>
                </span>
                <input
                  type="text"
                  value={coreAccount}
                  onChange={event => {
                    setCoreAccount(event.target.value);
                    setError(null);
                  }}
                  placeholder="e.g., 6000"
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isSubmitting}
                />
                {coreHelperText && (
                  <span className="text-xs font-normal text-red-600">{coreHelperText}</span>
                )}
              </label>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Cost type
              <select
                value={costType}
                onChange={event => {
                  setCostType(event.target.value);
                  setError(null);
                }}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isSubmitting}
              >
                <option value="">Unset</option>
                <option value="Balance Sheet">Balance Sheet</option>
                <option value="Overhead">Overhead</option>
                <option value="Variable">Variable</option>
                <option value="Revenue">Revenue</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Survey flag
              <select
                value={isSurvey}
                onChange={event => {
                  setIsSurvey(event.target.value as FlagValue);
                  setError(null);
                }}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isSubmitting}
              >
                <option value="">Unset</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </label>
          </div>

          <div className="rounded-md border border-gray-200 bg-gray-100 px-4 py-3 text-sm text-gray-600">
            <div className="font-medium text-gray-700">
              {preview.count} account{preview.count === 1 ? '' : 's'} will be created.
            </div>
            {!showReview && preview.rows.length > 0 && (
              <div className="mt-3 max-h-64 overflow-y-auto divide-y divide-gray-200 text-xs text-gray-600">
                {preview.rows.map(row => {
                  const accountNumber = buildAccountNumber(
                    row.baseCore,
                    row.operationalCode,
                    row.laborCode,
                  );
                  return (
                    <div key={row.key} className="py-2">
                      <div className="text-sm font-medium text-gray-700">
                        {row.accountName}
                      </div>
                      <div className="text-xs text-gray-500">
                        {accountNumber ?? 'Account number pending'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {showReview && (
              <p className="mt-2 text-xs text-gray-500">
                Review each account number and adjust the core value as needed.
              </p>
            )}
            {!showReview && !isCoreRequired && preview.rows.some(row => !row.baseCore) && (
              <p className="mt-2 text-xs text-gray-500">
                Core account numbers will be set during the review step.
              </p>
            )}
          </div>

          {showReview && (
            <div className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-gray-700">
                  Review account numbers
                </span>
                <span className="text-xs text-gray-500">
                  Edit the 4-digit core value per account.
                </span>
              </div>
              <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
                {reviewRows.map(row => (
                  <div
                    key={row.key}
                    className="rounded-md border border-gray-200 bg-white p-3 shadow-sm"
                  >
                    <div className="grid gap-3 md:grid-cols-[170px_1fr]">
                      <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
                        Core account
                        <input
                          type="text"
                          value={row.coreValue}
                          onChange={event => {
                            setCoreOverrides(previous => ({
                              ...previous,
                              [row.key]: event.target.value,
                            }));
                            setError(null);
                          }}
                          inputMode="numeric"
                          pattern="[0-9]{4}"
                          className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={isSubmitting}
                        />
                        {row.error && (
                          <span className="text-xs font-normal text-red-600">{row.error}</span>
                        )}
                      </label>
                      <div className="space-y-1">
                        <div className="text-xs text-gray-500">Account number</div>
                        <div className="text-sm font-semibold text-gray-900">
                          {row.accountNumber ?? 'Account number incomplete'}
                        </div>
                        <div className="text-xs text-gray-600">{row.accountName}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {displayError ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {displayError}
            </div>
          ) : null}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitDisabled}
              className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-blue-400"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating accounts
                </>
              ) : (
                submitLabel
              )}
            </button>
          </div>
        </form>
      </div>
    </ModalBackdrop>
  );
}
