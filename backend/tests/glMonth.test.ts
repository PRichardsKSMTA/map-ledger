import {
  extractDateFromText,
  normalizeGlMonth,
  parseStandaloneMonthName,
  inferGlMonthsFromMonthNames,
  areAllSheetsMonthNames,
} from '../src/utils/glMonth';

describe('glMonth utilities', () => {
  it('normalizes MM.YY format', () => {
    expect(normalizeGlMonth('11.25')).toBe('2025-11-01');
    expect(normalizeGlMonth('3.24')).toBe('2024-03-01');
  });

  it('extracts MM.YY format from text', () => {
    expect(extractDateFromText('NTS 11.25 TB.xlsx')).toBe('2025-11-01');
    expect(extractDateFromText('Report 03.24')).toBe('2024-03-01');
  });

  it('extracts M-YYYY format from sheet names', () => {
    // Single-digit month
    expect(extractDateFromText('1-2024')).toBe('2024-01-01');
    expect(extractDateFromText('2-2024')).toBe('2024-02-01');
    expect(extractDateFromText('9-2024')).toBe('2024-09-01');
    // Double-digit month
    expect(extractDateFromText('10-2024')).toBe('2024-10-01');
    expect(extractDateFromText('11-2024')).toBe('2024-11-01');
    expect(extractDateFromText('12-2024')).toBe('2024-12-01');
    // With slash
    expect(extractDateFromText('1/2024')).toBe('2024-01-01');
    expect(extractDateFromText('12/2024')).toBe('2024-12-01');
  });

  it('does not confuse M-YYYY with invalid months', () => {
    // Month 13+ should not match M-YYYY pattern
    expect(extractDateFromText('13-2024')).toBe('');
    expect(extractDateFromText('0-2024')).toBe('');
  });
});

describe('parseStandaloneMonthName', () => {
  it('parses full month names', () => {
    expect(parseStandaloneMonthName('January')).toBe('01');
    expect(parseStandaloneMonthName('February')).toBe('02');
    expect(parseStandaloneMonthName('March')).toBe('03');
    expect(parseStandaloneMonthName('April')).toBe('04');
    expect(parseStandaloneMonthName('May')).toBe('05');
    expect(parseStandaloneMonthName('June')).toBe('06');
    expect(parseStandaloneMonthName('July')).toBe('07');
    expect(parseStandaloneMonthName('August')).toBe('08');
    expect(parseStandaloneMonthName('September')).toBe('09');
    expect(parseStandaloneMonthName('October')).toBe('10');
    expect(parseStandaloneMonthName('November')).toBe('11');
    expect(parseStandaloneMonthName('December')).toBe('12');
  });

  it('parses abbreviated month names', () => {
    expect(parseStandaloneMonthName('Jan')).toBe('01');
    expect(parseStandaloneMonthName('Feb')).toBe('02');
    expect(parseStandaloneMonthName('Sept')).toBe('09');
    expect(parseStandaloneMonthName('Dec')).toBe('12');
  });

  it('is case-insensitive', () => {
    expect(parseStandaloneMonthName('DECEMBER')).toBe('12');
    expect(parseStandaloneMonthName('december')).toBe('12');
    expect(parseStandaloneMonthName('DeCeMbEr')).toBe('12');
  });

  it('returns null for non-month names', () => {
    expect(parseStandaloneMonthName('NotAMonth')).toBeNull();
    expect(parseStandaloneMonthName('Dec 2025')).toBeNull();
    expect(parseStandaloneMonthName('Sheet1')).toBeNull();
    expect(parseStandaloneMonthName('')).toBeNull();
  });
});

describe('areAllSheetsMonthNames', () => {
  it('returns true when all sheets are month names', () => {
    expect(areAllSheetsMonthNames(['December', 'November', 'October'])).toBe(true);
    expect(areAllSheetsMonthNames(['Jan', 'Feb', 'Mar'])).toBe(true);
    expect(areAllSheetsMonthNames(['DECEMBER'])).toBe(true);
  });

  it('returns false when any sheet is not a month name', () => {
    expect(areAllSheetsMonthNames(['December', 'November', 'Sheet1'])).toBe(false);
    expect(areAllSheetsMonthNames(['December 2025', 'November'])).toBe(false);
    expect(areAllSheetsMonthNames(['Summary', 'Data'])).toBe(false);
  });

  it('returns false for empty array', () => {
    expect(areAllSheetsMonthNames([])).toBe(false);
  });
});

describe('inferGlMonthsFromMonthNames', () => {
  // Use a fixed reference date for predictable tests
  // January 15, 2026 means January 2026 is the current (unclosed) month
  const referenceDate = new Date('2026-01-15');

  it('assigns most recent completed year for each month', () => {
    // January 2026 reference: December 2025 is most recent completed December
    const result = inferGlMonthsFromMonthNames(
      ['December', 'November', 'October'],
      referenceDate
    );
    expect(result).toEqual(['2025-12-01', '2025-11-01', '2025-10-01']);
  });

  it('treats current month as not yet closed (uses previous year)', () => {
    // January 2026 reference: January hasn't closed yet, so "January" = Jan 2025
    const result = inferGlMonthsFromMonthNames(['January'], referenceDate);
    expect(result).toEqual(['2025-01-01']);
  });

  it('treats future months as from previous year', () => {
    // January 2026 reference: February hasn't happened yet, so "February" = Feb 2025
    const result = inferGlMonthsFromMonthNames(['February', 'March'], referenceDate);
    expect(result).toEqual(['2025-02-01', '2025-03-01']);
  });

  it('handles duplicate months by going back in time', () => {
    // First December = 2025, second December = 2024
    const result = inferGlMonthsFromMonthNames(
      ['December', 'December'],
      referenceDate
    );
    expect(result).toEqual(['2025-12-01', '2024-12-01']);
  });

  it('handles 13 sheets with duplicate month at the end', () => {
    // Simulate a file with 13 months where December repeats
    // Reference: January 15, 2026 (January not closed yet)
    const sheetNames = [
      'December', 'November', 'October', 'September',
      'August', 'July', 'June', 'May',
      'April', 'March', 'February', 'January',
      'December' // This is the 13th sheet, same month as the first
    ];
    const result = inferGlMonthsFromMonthNames(sheetNames, referenceDate);

    // All months >= January (current month) get 2025
    // January is current month so it's 2025 (not closed yet)
    expect(result[0]).toBe('2025-12-01');  // December 2025
    expect(result[11]).toBe('2025-01-01'); // January 2025 (current month not closed)
    expect(result[12]).toBe('2024-12-01'); // Second December -> 2024
  });

  it('returns empty strings for non-month sheets', () => {
    const result = inferGlMonthsFromMonthNames(
      ['December', 'NotAMonth', 'November'],
      referenceDate
    );
    expect(result).toEqual(['2025-12-01', '', '2025-11-01']);
  });

  it('handles empty array', () => {
    expect(inferGlMonthsFromMonthNames([], referenceDate)).toEqual([]);
  });

  it('handles case-insensitive month names', () => {
    const result = inferGlMonthsFromMonthNames(
      ['DECEMBER', 'november', 'OcToBer'],
      referenceDate
    );
    expect(result).toEqual(['2025-12-01', '2025-11-01', '2025-10-01']);
  });

  it('handles mid-year reference date correctly', () => {
    // July 15, 2026: June and earlier are completed in 2026, July+ are from 2025
    const midYearRef = new Date('2026-07-15');
    const result = inferGlMonthsFromMonthNames(
      ['June', 'July', 'August'],
      midYearRef
    );
    // June 2026 (completed), July 2025 (current month not closed), August 2025 (future)
    expect(result).toEqual(['2026-06-01', '2025-07-01', '2025-08-01']);
  });
});
