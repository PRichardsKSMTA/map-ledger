/**
 * Utility to extract dates from arbitrary text (like sheet names, file names, etc.)
 * Handles many different date formats and returns normalized YYYY-MM-01 format
 */

const monthNameMap: Record<string, string> = {
  jan: '01',
  january: '01',
  feb: '02',
  february: '02',
  mar: '03',
  march: '03',
  apr: '04',
  april: '04',
  may: '05',
  jun: '06',
  june: '06',
  jul: '07',
  july: '07',
  aug: '08',
  august: '08',
  sep: '09',
  sept: '09',
  september: '09',
  oct: '10',
  october: '10',
  nov: '11',
  november: '11',
  dec: '12',
  december: '12',
};

const formatMonthStart = (year: string | number, month: string): string =>
  `${year}-${month.padStart(2, '0')}-01`;

/**
 * Normalizes a date string to YYYY-MM-01 format
 * This is a standalone version that can be reused
 */
export function normalizeGlMonth(value: string): string {
  if (!value) return '';

  const trimmed = value.trim();
  // ISO format: 2024-01 or 2024-01-15
  const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})(?:[-/]\d{1,2})?$/);
  if (isoMatch) {
    const [, year, rawMonth] = isoMatch;
    return formatMonthStart(year, rawMonth);
  }

  // Month/Year: 01/2024 or 01-2024
  const monthYearMatch = trimmed.match(/^(\d{1,2})[-/](\d{4})$/);
  if (monthYearMatch) {
    const [, rawMonth, year] = monthYearMatch;
    return formatMonthStart(year, rawMonth);
  }

  // Month.Year: 11.25
  const monthDotYearMatch = trimmed.match(/^(\d{1,2})\.(\d{2})$/);
  if (monthDotYearMatch) {
    const [, rawMonth, yearPart] = monthDotYearMatch;
    const month = rawMonth.padStart(2, '0');
    const monthNum = parseInt(month, 10);
    if (monthNum >= 1 && monthNum <= 12) {
      const numericYear = parseInt(yearPart, 10);
      if (!Number.isNaN(numericYear)) {
        const year = numericYear < 50 ? 2000 + numericYear : 1900 + numericYear;
        return formatMonthStart(year, month);
      }
    }
  }

  // US format: 01/15/2024 or 01-15-2024
  const usMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (usMatch) {
    const [, rawMonth, , year] = usMatch;
    return formatMonthStart(year, rawMonth);
  }

  // Compact numeric: 202401
  const compactMatch = trimmed.match(/^(\d{4})(\d{2})$/);
  if (compactMatch) {
    const [, year, rawMonth] = compactMatch;
    return formatMonthStart(year, rawMonth);
  }

  // Text month with year: "Jan 2024", "January 2024", "Jan-2024"
  const textMatch = trimmed.match(/^([A-Za-z]{3,9})[\s-](\d{2,4})$/);
  if (textMatch) {
    const [, monthName, yearPart] = textMatch;
    const normalizedMonthName = monthName.toLowerCase();
    const month = monthNameMap[normalizedMonthName];
    if (month) {
      const numericYear = parseInt(yearPart, 10);
      if (!Number.isNaN(numericYear)) {
        const year =
          yearPart.length === 2
            ? (numericYear < 50 ? 2000 + numericYear : 1900 + numericYear)
            : numericYear;
        return formatMonthStart(year, month);
      }
    }
  }

  // Compact named: 2024 M01
  const compactNamedMatch = trimmed.match(/^(\d{4})\s*M(\d{2})$/i);
  if (compactNamedMatch) {
    const [, year, rawMonth] = compactNamedMatch;
    return formatMonthStart(year, rawMonth);
  }

  // Try parsing as a JavaScript Date
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getUTCFullYear();
    const month = (parsed.getUTCMonth() + 1).toString().padStart(2, '0');
    return formatMonthStart(year, month);
  }

  return '';
}

/**
 * Validates that a string matches the normalized YYYY-MM-01 format
 */
export function isValidNormalizedMonth(value: string): boolean {
  return /^\d{4}-\d{2}-01$/.test(value);
}

/**
 * Extracts a date from arbitrary text (like sheet names)
 * Handles many different formats embedded in larger text strings
 *
 * Examples:
 * - "Trial balance report (Aug'24)" -> "2024-08-01"
 * - "Trial balance report (Sep'24)" -> "2024-09-01"
 * - "Report for 2024-08" -> "2024-08-01"
 * - "August 2025 Report" -> "2025-08-01"
 * - "TB_Jan_2024" -> "2024-01-01"
 * - "2025-08-15 Export" -> "2025-08-01"
 */
export function extractDateFromText(text: string): string {
  if (!text) return '';

  const normalized = text.trim();

  // Pattern 0: M-YYYY or MM-YYYY format (e.g., "1-2024", "12-2024")
  // Must check this BEFORE ISO format to avoid misinterpreting as YYYY-MM
  // Only match when it's the entire string or clearly a date pattern
  const mYyyyMatch = normalized.match(/^(\d{1,2})[-/](\d{4})$/);
  if (mYyyyMatch) {
    const [, rawMonth, year] = mYyyyMatch;
    const month = rawMonth.padStart(2, '0');
    const monthNum = parseInt(month, 10);
    if (monthNum >= 1 && monthNum <= 12) {
      return formatMonthStart(year, month);
    }
  }

  // Pattern 1: Month abbreviation with 2-digit year in parentheses or quotes
  // Examples: (Aug'24), (Sep'24), "Aug'24", 'Aug'24'
  const monthApostropheMatch = normalized.match(/(?:[()'"\s])([A-Za-z]{3,9})[''](\d{2})(?:[)'")\s]|$)/i);
  if (monthApostropheMatch) {
    const [, monthName, yearPart] = monthApostropheMatch;
    const normalizedMonthName = monthName.toLowerCase();
    const month = monthNameMap[normalizedMonthName];
    if (month) {
      const numericYear = parseInt(yearPart, 10);
      if (!Number.isNaN(numericYear)) {
        const year = numericYear < 50 ? 2000 + numericYear : 1900 + numericYear;
        return formatMonthStart(year, month);
      }
    }
  }

  // Pattern 2: ISO format in text: 2024-01, 2024-01-15
  const isoMatch = normalized.match(/(\d{4})[-/](\d{1,2})(?:[-/]\d{1,2})?/);
  if (isoMatch) {
    const [, year, rawMonth] = isoMatch;
    const month = rawMonth.padStart(2, '0');
    // Validate it's a valid month (01-12)
    const monthNum = parseInt(month, 10);
    if (monthNum >= 1 && monthNum <= 12) {
      return formatMonthStart(year, month);
    }
  }

  // Pattern 3: Month name with 2 or 4 digit year
  // Examples: "August 2024", "Aug 2024", "January 25", "Jan'25"
  const monthYearMatch = normalized.match(/\b([A-Za-z]{3,9})[\s'-]+(\d{2,4})\b/i);
  if (monthYearMatch) {
    const [, monthName, yearPart] = monthYearMatch;
    const normalizedMonthName = monthName.toLowerCase();
    const month = monthNameMap[normalizedMonthName];
    if (month) {
      const numericYear = parseInt(yearPart, 10);
      if (!Number.isNaN(numericYear)) {
        const year =
          yearPart.length === 2
            ? (numericYear < 50 ? 2000 + numericYear : 1900 + numericYear)
            : numericYear;
        return formatMonthStart(year, month);
      }
    }
  }

  // Pattern 4: Year with month name
  // Examples: "2024 August", "2024_Aug", "2024-January"
  const yearMonthMatch = normalized.match(/\b(\d{4})[\s_-]+([A-Za-z]{3,9})\b/i);
  if (yearMonthMatch) {
    const [, year, monthName] = yearMonthMatch;
    const normalizedMonthName = monthName.toLowerCase();
    const month = monthNameMap[normalizedMonthName];
    if (month) {
      return formatMonthStart(year, month);
    }
  }

  // Pattern 5: MM/YYYY or MM-YYYY
  // Examples: "08/2024", "08-2025"
  const mmYyyyMatch = normalized.match(/\b(\d{1,2})[-/](\d{4})\b/);
  if (mmYyyyMatch) {
    const [, rawMonth, year] = mmYyyyMatch;
    const month = rawMonth.padStart(2, '0');
    const monthNum = parseInt(month, 10);
    if (monthNum >= 1 && monthNum <= 12) {
      return formatMonthStart(year, month);
    }
  }

  // Pattern 6: MM.YY
  // Examples: "11.25"
  const mmYyDotMatch = normalized.match(/\b(\d{1,2})\.(\d{2})\b/);
  if (mmYyDotMatch) {
    const [, rawMonth, yearPart] = mmYyDotMatch;
    const month = rawMonth.padStart(2, '0');
    const monthNum = parseInt(month, 10);
    if (monthNum >= 1 && monthNum <= 12) {
      const numericYear = parseInt(yearPart, 10);
      if (!Number.isNaN(numericYear)) {
        const year = numericYear < 50 ? 2000 + numericYear : 1900 + numericYear;
        return formatMonthStart(year, month);
      }
    }
  }

  // Pattern 7: Compact numeric format: 202408
  const compactMatch = normalized.match(/\b(\d{4})(\d{2})\b/);
  if (compactMatch) {
    const [, year, rawMonth] = compactMatch;
    const monthNum = parseInt(rawMonth, 10);
    if (monthNum >= 1 && monthNum <= 12) {
      return formatMonthStart(year, rawMonth);
    }
  }

  // Pattern 8: Month_Year or Month-Year with underscores/dashes
  // Examples: "Aug_24", "Jan-2024", "August_2025"
  const monthUnderscoreMatch = normalized.match(/\b([A-Za-z]{3,9})[_-](\d{2,4})\b/i);
  if (monthUnderscoreMatch) {
    const [, monthName, yearPart] = monthUnderscoreMatch;
    const normalizedMonthName = monthName.toLowerCase();
    const month = monthNameMap[normalizedMonthName];
    if (month) {
      const numericYear = parseInt(yearPart, 10);
      if (!Number.isNaN(numericYear)) {
        const year =
          yearPart.length === 2
            ? (numericYear < 50 ? 2000 + numericYear : 1900 + numericYear)
            : numericYear;
        return formatMonthStart(year, month);
      }
    }
  }

  return '';
}

/**
 * Extracts all possible dates from text and returns the first valid one
 * This is useful when text might contain multiple date-like patterns
 */
export function extractFirstValidDate(text: string): string {
  const date = extractDateFromText(text);
  if (date && isValidNormalizedMonth(date)) {
    return date;
  }
  return '';
}

/**
 * Checks if a string is a standalone month name (e.g., "December", "Nov", "january")
 * Returns the month number (01-12) if valid, or null if not a month name
 */
export function parseStandaloneMonthName(text: string): string | null {
  if (!text) return null;
  const normalized = text.trim().toLowerCase();
  return monthNameMap[normalized] ?? null;
}

/**
 * Determines the most recent *completed* occurrence of a given month relative to today's date.
 * Since the current month hasn't closed yet, it cannot be in a file, so we always look at
 * the previous completed instance of that month.
 *
 * @param monthNumber - Month as a string "01"-"12"
 * @param referenceDate - Optional reference date (defaults to today)
 * @returns Year as a 4-digit number
 */
function getMostRecentCompletedYearForMonth(monthNumber: string, referenceDate?: Date): number {
  const now = referenceDate ?? new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12
  const targetMonth = parseInt(monthNumber, 10);

  // If the target month is >= current month, it must be from last year
  // because the current month hasn't closed yet
  // (e.g., if today is January 13, 2026 and we see "January", it's Jan 2025)
  // (e.g., if today is January 13, 2026 and we see "February", it's Feb 2025)
  if (targetMonth >= currentMonth) {
    return currentYear - 1;
  }
  return currentYear;
}

/**
 * Infers GL months from an array of sheet names that are standalone month names.
 * Processes left-to-right, assigning the most recent occurrence of each month first,
 * then going back in time for subsequent occurrences of the same month.
 *
 * Example: ["December", "November", "October", ..., "December"]
 * - First "December" -> 2025-12-01 (most recent)
 * - Thirteenth "December" -> 2024-12-01 (previous year)
 *
 * @param sheetNames - Array of sheet names in order (left to right)
 * @param referenceDate - Optional reference date for determining "most recent" (defaults to today)
 * @returns Array of GL months in YYYY-MM-01 format, or empty strings for non-month sheets
 */
export function inferGlMonthsFromMonthNames(
  sheetNames: string[],
  referenceDate?: Date
): string[] {
  // Track how many times we've seen each month (to handle duplicates)
  const monthOccurrences = new Map<string, number>();

  return sheetNames.map((sheetName) => {
    const monthNumber = parseStandaloneMonthName(sheetName);
    if (!monthNumber) {
      return '';
    }

    // Get how many times we've already seen this month
    const occurrenceCount = monthOccurrences.get(monthNumber) ?? 0;
    monthOccurrences.set(monthNumber, occurrenceCount + 1);

    // Get the most recent completed year for this month, then subtract years for duplicates
    const baseYear = getMostRecentCompletedYearForMonth(monthNumber, referenceDate);
    const year = baseYear - occurrenceCount;

    return formatMonthStart(year, monthNumber);
  });
}

/**
 * Checks if all non-empty sheet names in an array are standalone month names.
 * Used to determine if we should use month name inference for the entire file.
 *
 * @param sheetNames - Array of sheet names to check
 * @returns true if all non-empty sheet names are valid month names
 */
export function areAllSheetsMonthNames(sheetNames: string[]): boolean {
  const nonEmptySheets = sheetNames.filter((name) => name.trim().length > 0);
  if (nonEmptySheets.length === 0) {
    return false;
  }
  return nonEmptySheets.every((name) => parseStandaloneMonthName(name) !== null);
}

/**
 * Headers that should NOT be treated as GL month columns even if they look like dates.
 * These are common accounting/report headers that might contain date-like text.
 */
const NON_GL_MONTH_HEADERS = new Set([
  'account',
  'accountid',
  'glid',
  'gl id',
  'id',
  'description',
  'accountdescription',
  'account description',
  'name',
  'accountname',
  'account name',
  'entity',
  'entityid',
  'entity id',
  'entityname',
  'entity name',
  'netchange',
  'net change',
  'activity',
  'amount',
  'debit',
  'credit',
  'balance',
  'beginningbalance',
  'beginning balance',
  'endingbalance',
  'ending balance',
  'openingbalance',
  'opening balance',
  'closingbalance',
  'closing balance',
  'userdefined1',
  'user defined 1',
  'userdefined2',
  'user defined 2',
  'userdefined3',
  'user defined 3',
]);

/**
 * Checks if a header looks like a clean GL month column (not mixed with other text).
 * We want to match headers like "Jan-25", "Feb 2025", "1/1/2025" but NOT
 * headers like "Jan-25 Budget" or "Net Change Jan".
 *
 * @param header - The header text to check
 * @returns The normalized GL month (YYYY-MM-01) if it's a clean month column, null otherwise
 */
function extractCleanGlMonth(header: string): string | null {
  if (!header) return null;

  const trimmed = header.trim();

  // Skip headers that are known non-month columns
  const normalizedLower = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (NON_GL_MONTH_HEADERS.has(normalizedLower) || NON_GL_MONTH_HEADERS.has(trimmed.toLowerCase())) {
    return null;
  }

  // Skip placeholder columns like "Column A", "Column B"
  if (/^Column [A-Z]+$/i.test(trimmed)) {
    return null;
  }

  // Skip headers with extra words that suggest it's not a pure month column
  // e.g., "Jan-25 Budget", "Net Change Jan", "Jan 2025 Forecast"
  const words = trimmed.split(/[\s_-]+/).filter(w => w.length > 0);
  if (words.length > 3) {
    // Too many words to be a clean month header
    return null;
  }

  // Try to extract a date from the header
  // First, try normalizeGlMonth for clean date formats
  const normalized = normalizeGlMonth(trimmed);
  if (normalized && isValidNormalizedMonth(normalized)) {
    return normalized;
  }

  // Then try extractDateFromText for embedded dates
  const extracted = extractDateFromText(trimmed);
  if (extracted && isValidNormalizedMonth(extracted)) {
    // Additional check: make sure the extracted date covers most of the header text
    // to avoid false positives like "Revenue Jan-25 Report" extracting just "Jan-25"
    const headerLength = trimmed.replace(/[\s_-]/g, '').length;
    const monthPattern = /(?:\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}|[A-Za-z]{3,9}[-'\s]?\d{2,4}|\d{2,4}[-'\s]?[A-Za-z]{3,9})/;
    const match = trimmed.match(monthPattern);
    if (match) {
      const matchLength = match[0].replace(/[\s_-]/g, '').length;
      // If the date pattern covers at least 70% of the header, it's likely a month column
      if (matchLength / headerLength >= 0.7) {
        return extracted;
      }
    }
  }

  return null;
}

/**
 * Detects GL month columns from an array of header strings.
 * Returns a Map of header name to normalized GL month (YYYY-MM-01).
 *
 * This function identifies headers that represent specific months, such as:
 * - "Jan-25", "Feb-25", "Mar-25" -> "2025-01-01", "2025-02-01", "2025-03-01"
 * - "1/1/2025", "2/1/2025" -> "2025-01-01", "2025-02-01"
 * - "January 2025", "February 2025" -> "2025-01-01", "2025-02-01"
 *
 * Headers that look like account IDs, descriptions, entities, etc. are excluded.
 *
 * @param headers - Array of header strings from the spreadsheet
 * @returns Map where key is the original header name and value is the normalized GL month
 *
 * @example
 * detectGlMonthColumns(["ID", "Description", "Jan-25", "Feb-25", "Mar-25"])
 * // Returns: Map { "Jan-25" => "2025-01-01", "Feb-25" => "2025-02-01", "Mar-25" => "2025-03-01" }
 */
export function detectGlMonthColumns(headers: string[]): Map<string, string> {
  const result = new Map<string, string>();

  for (const header of headers) {
    const glMonth = extractCleanGlMonth(header);
    if (glMonth) {
      result.set(header, glMonth);
    }
  }

  // Only return if we found at least 2 month columns
  // A single month column is more likely to be a coincidence or single-month format
  if (result.size >= 2) {
    return result;
  }

  return new Map();
}
