import { useEffect, useState, useMemo } from 'react';
import { GripVertical, Check, X, ChevronDown, Sparkles, Calendar } from 'lucide-react';

interface ColumnMatcherProps {
  sourceHeaders: string[];
  destinationHeaders: string[];
  initialAssignments?: Record<string, string | null>;
  onComplete: (mapping: Record<string, string | null>) => void | Promise<void>;
  /** Detected GL month columns from the source headers (header name -> normalized GL month) */
  detectedGlMonthColumns?: Map<string, string>;
}

// Required fields that must be mapped (when no GL month columns detected)
const REQUIRED_FIELDS_STANDARD = ['GL ID', 'Account Description', 'Net Change'];
// Required fields when GL month columns are detected (Net Change not needed)
const REQUIRED_FIELDS_WIDE_FORMAT = ['GL ID', 'Account Description'];

function normalize(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function guessMatches(source: string[], dest: string[]): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  const used = new Set<string>();

  dest.forEach(d => {
    const normalizedDest = normalize(d);
    let match: string | undefined;

    const available = source.filter(s => !used.has(s));

    if (normalizedDest === 'accountdescription') {
      // Match "Gl_Desc", "GL Desc", or any column containing "description"
      match = available.find(s => normalize(s) === 'gldesc') ||
              available.find(s => normalize(s).includes('description'));
    } else if (normalizedDest === 'netchange') {
      // Match "Amount" or any column containing "netchange"
      const netChangeMatches = available.filter(s => normalize(s).includes('netchange'));
      match = netChangeMatches.length > 0
        ? netChangeMatches[netChangeMatches.length - 1]
        : available.find(s => normalize(s) === 'amount');
    } else if (normalizedDest === 'entity') {
      // Match "Company_Id", "CompanyId", or exact match
      match = available.find(s => normalize(s) === 'companyid') ||
              available.find(s => normalize(s) === normalizedDest);
    } else {
      match = available.find(s => normalize(s) === normalizedDest);
    }

    if (match) {
      used.add(match);
      result[d] = match;
    } else {
      result[d] = null;
    }
  });

  return result;
}

export default function ColumnMatcher({
  sourceHeaders,
  destinationHeaders,
  initialAssignments,
  onComplete,
  detectedGlMonthColumns,
}: ColumnMatcherProps) {
  const [assignments, setAssignments] = useState<Record<string, string | null>>({});
  const [autoMatched, setAutoMatched] = useState<Set<string>>(new Set());
  const [unassigned, setUnassigned] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Determine if we're in wide format mode (multiple GL month columns detected)
  const isWideFormat = detectedGlMonthColumns && detectedGlMonthColumns.size >= 2;
  const requiredFields = isWideFormat ? REQUIRED_FIELDS_WIDE_FORMAT : REQUIRED_FIELDS_STANDARD;

  // Get sorted list of detected GL months for display
  const sortedGlMonths = useMemo(() => {
    if (!detectedGlMonthColumns || detectedGlMonthColumns.size === 0) return [];
    return Array.from(detectedGlMonthColumns.entries())
      .sort((a, b) => a[1].localeCompare(b[1])) // Sort by normalized date
      .map(([header]) => header);
  }, [detectedGlMonthColumns]);

  // Calculate progress
  const progress = useMemo(() => {
    const requiredMapped = requiredFields.filter(field => assignments[field]).length;
    const totalMapped = Object.values(assignments).filter(Boolean).length;
    return {
      requiredMapped,
      requiredTotal: requiredFields.length,
      totalMapped,
      totalFields: destinationHeaders.length,
      isComplete: requiredMapped === requiredFields.length,
    };
  }, [assignments, destinationHeaders.length, requiredFields]);

  useEffect(() => {
    const annotatedHeaders = sourceHeaders.map((label, idx, arr) => {
      const duplicates = arr.filter(v => v === label);
      if (duplicates.length > 1) {
        const colLetter = String.fromCharCode(65 + idx);
        return `${label} - Column ${colLetter}`;
      }
      return label;
    });

    // Filter out GL month columns from available headers (they're auto-handled)
    const glMonthHeaderSet = new Set(detectedGlMonthColumns?.keys() ?? []);
    const availableHeaders = annotatedHeaders.filter(header => {
      // Check both the annotated header and the original (without column suffix)
      const originalHeader = header.replace(/ - Column [A-Z]+$/, '');
      return !glMonthHeaderSet.has(header) && !glMonthHeaderSet.has(originalHeader);
    });

    const seedAssignments: Record<string, string | null> = {};
    const used = new Set<string>();
    const autoMatchedFields = new Set<string>();

    if (initialAssignments) {
      destinationHeaders.forEach((dest) => {
        const desired = initialAssignments[dest];
        if (!desired) {
          return;
        }

        const match = availableHeaders.find(
          (header) => !used.has(header) && (header === desired || normalize(header) === normalize(desired))
        );

        if (match) {
          seedAssignments[dest] = match;
          used.add(match);
          autoMatchedFields.add(dest);
        }
      });
    }

    const remainingSources = availableHeaders.filter((header) => !used.has(header));
    const remainingDestinations = destinationHeaders.filter((dest) => !seedAssignments[dest]);

    const guesses = guessMatches(remainingSources, remainingDestinations);

    // Track which fields were auto-matched
    Object.entries(guesses).forEach(([dest, src]) => {
      if (src) autoMatchedFields.add(dest);
    });

    const mergedAssignments = { ...seedAssignments, ...guesses };
    const assignedSources = new Set(
      Object.values(mergedAssignments).filter(Boolean) as string[]
    );

    setAssignments(mergedAssignments);
    setAutoMatched(autoMatchedFields);
    setUnassigned(availableHeaders.filter((header) => !assignedSources.has(header)));
  }, [sourceHeaders, destinationHeaders, initialAssignments, detectedGlMonthColumns]);

  const handleDrop = (src: string, dest: string) => {
    setAssignments(prev => {
      const updated = { ...prev };
      const prevDest = Object.keys(prev).find(k => prev[k] === src);
      if (prevDest) updated[prevDest] = null;
      updated[dest] = src;
      return updated;
    });
    setUnassigned(prev => prev.filter(h => h !== src));
    setAutoMatched(prev => {
      const next = new Set(prev);
      next.delete(dest);
      return next;
    });
    setDragOver(null);
  };

  const handleRemove = (dest: string) => {
    setAssignments(prev => {
      const updated = { ...prev };
      const removed = updated[dest];
      updated[dest] = null;
      if (removed) setUnassigned((prevUnassigned) => [...prevUnassigned, removed]);
      return updated;
    });
    setAutoMatched(prev => {
      const next = new Set(prev);
      next.delete(dest);
      return next;
    });
  };

  const handleSelectFromDropdown = (dest: string, src: string | null) => {
    if (src === null) {
      handleRemove(dest);
    } else {
      handleDrop(src, dest);
    }
    setOpenDropdown(null);
  };

  // Get all available options for dropdown (unassigned + currently assigned to this field)
  const getAvailableOptions = (dest: string) => {
    const currentAssignment = assignments[dest];
    const options = [...unassigned];
    if (currentAssignment && !options.includes(currentAssignment)) {
      options.unshift(currentAssignment);
    }
    return options;
  };

  return (
    <div className="space-y-4">
      {/* Header with progress */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Map Your Columns
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Match your file columns to the template fields
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {progress.requiredMapped}/{progress.requiredTotal} required
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {progress.totalMapped}/{progress.totalFields} total mapped
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            progress.isComplete ? 'bg-green-500' : 'bg-blue-500'
          }`}
          style={{ width: `${(progress.requiredMapped / progress.requiredTotal) * 100}%` }}
        />
      </div>

      {/* GL Month columns detected banner */}
      {isWideFormat && sortedGlMonths.length > 0 && (
        <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-3">
          <div className="flex items-start gap-2">
            <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Multi-Month Format Detected
              </h4>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                Found {sortedGlMonths.length} GL month columns. Each row will be expanded into {sortedGlMonths.length} records (one per month).
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {sortedGlMonths.slice(0, 12).map(header => (
                  <span
                    key={header}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200"
                  >
                    {header}
                  </span>
                ))}
                {sortedGlMonths.length > 12 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200">
                    +{sortedGlMonths.length - 12} more
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main mapping area */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-4 items-start">
        {/* Source headers (unassigned) */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3">
          <h4 className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
            Available Columns ({unassigned.length})
          </h4>
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
            {unassigned.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 italic py-2 text-center">
                All columns mapped
              </p>
            ) : (
              unassigned.map(header => (
                <div
                  key={header}
                  className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md cursor-grab hover:border-blue-400 hover:shadow-sm transition-all group"
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', header)}
                >
                  <GripVertical className="h-4 w-4 text-gray-400 group-hover:text-blue-500 flex-shrink-0" />
                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{header}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Arrow indicator */}
        <div className="hidden lg:flex items-center justify-center pt-8">
          <div className="text-gray-300 dark:text-gray-600">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </div>
        </div>

        {/* Template fields */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-3">
          <h4 className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
            Template Fields
          </h4>
          <div className="space-y-2">
            {destinationHeaders
              // Hide "Net Change" field when in wide format mode
              .filter(dest => !(isWideFormat && dest === 'Net Change'))
              .map(dest => {
              const isRequired = requiredFields.includes(dest);
              const isMapped = Boolean(assignments[dest]);
              const isAutoMapped = autoMatched.has(dest);
              const isDraggedOver = dragOver === dest;
              const isDropdownOpen = openDropdown === dest;
              const availableOptions = getAvailableOptions(dest);

              return (
                <div
                  key={dest}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(dest);
                  }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={(e) => {
                    const src = e.dataTransfer.getData('text/plain');
                    handleDrop(src, dest);
                  }}
                  className={`relative rounded-lg border-2 transition-all ${
                    isDraggedOver
                      ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                      : isMapped
                        ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
                        : isRequired
                          ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 border-dashed'
                          : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30 border-dashed'
                  }`}
                >
                  <div className="p-2.5">
                    {/* Field label row */}
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        {isMapped ? (
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500">
                            <Check className="h-3 w-3 text-white" />
                          </div>
                        ) : (
                          <div className={`h-5 w-5 rounded-full border-2 ${
                            isRequired
                              ? 'border-amber-400 dark:border-amber-500'
                              : 'border-gray-300 dark:border-gray-600'
                          }`} />
                        )}
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {dest}
                        </span>
                        {isRequired && !isMapped && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 font-medium">
                            Required
                          </span>
                        )}
                        {isAutoMapped && isMapped && (
                          <span className="flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300">
                            <Sparkles className="h-3 w-3" />
                            Auto
                          </span>
                        )}
                      </div>
                      {isMapped && (
                        <button
                          onClick={() => handleRemove(dest)}
                          className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-colors"
                          type="button"
                          title="Remove mapping"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    {/* Mapped value or dropdown */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenDropdown(isDropdownOpen ? null : dest)}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                          isMapped
                            ? 'bg-white dark:bg-gray-800 border border-green-200 dark:border-green-700 text-gray-900 dark:text-gray-100'
                            : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:border-gray-300 dark:hover:border-gray-500'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={isMapped ? '' : 'italic'}>
                            {assignments[dest] ?? 'Click or drag to assign...'}
                          </span>
                          <ChevronDown className={`h-4 w-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                        </div>
                      </button>

                      {/* Dropdown menu */}
                      {isDropdownOpen && (
                        <div className="absolute z-20 mt-1 w-full rounded-md bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-600 max-h-48 overflow-y-auto">
                          {isMapped && (
                            <button
                              type="button"
                              onClick={() => handleSelectFromDropdown(dest, null)}
                              className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              Clear selection
                            </button>
                          )}
                          {availableOptions.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500 italic">
                              No columns available
                            </div>
                          ) : (
                            availableOptions.map(opt => (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => handleSelectFromDropdown(dest, opt)}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                                  assignments[dest] === opt
                                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                                    : 'text-gray-700 dark:text-gray-300'
                                }`}
                              >
                                {opt}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Action button */}
      <div className="flex items-center justify-between pt-2">
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
        <div className="ml-auto">
          <button
            onClick={async () => {
              try {
                setError(null);
                setIsSaving(true);
                await onComplete(assignments);
              } catch (err) {
                setError(
                  err instanceof Error
                    ? err.message
                    : 'Unable to save header mappings'
                );
              } finally {
                setIsSaving(false);
              }
            }}
            disabled={isSaving || !progress.isComplete}
            className={`px-5 py-2.5 rounded-lg font-medium transition-all ${
              progress.isComplete
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'
            } disabled:opacity-50`}
          >
            {isSaving ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Saving...
              </span>
            ) : (
              'Confirm Mappings'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}