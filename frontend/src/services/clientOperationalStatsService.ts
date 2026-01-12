import type { OperationalStatAccount, OperationalStatValue } from '../types';

const resolveApiBaseUrl = (): string | undefined => {
  const metaEnv = (globalThis as any)?.importMetaEnv;
  if (metaEnv && typeof metaEnv.VITE_API_BASE_URL === 'string') {
    return metaEnv.VITE_API_BASE_URL;
  }

  if (typeof process !== 'undefined' && process.env?.VITE_API_BASE_URL) {
    return process.env.VITE_API_BASE_URL;
  }

  return undefined;
};

const API_BASE_URL = resolveApiBaseUrl() ?? '/api';

const getValue = (record: Record<string, unknown>, keys: string[]): string | null => {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) {
      continue;
    }
    const value = record[key];
    if (value === null || value === undefined) {
      continue;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
      continue;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }
  return null;
};

const toNumber = (value: unknown): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const normalizeAccount = (record: Record<string, unknown>): OperationalStatAccount | null => {
  const accountNumber =
    getValue(record, ['accountNumber', 'ACCOUNT_NUMBER', 'account_number']) ?? '';
  if (!accountNumber) {
    return null;
  }
  const description =
    getValue(record, ['description', 'DESCRIPTION', 'accountDescription', 'account_description']) ??
    null;
  const isSurveyRaw = record.isSurvey ?? record.IS_SURVEY ?? record.is_survey;
  const isSurvey = isSurveyRaw === true || isSurveyRaw === 1 || isSurveyRaw === '1';
  return {
    accountNumber,
    description,
    isSurvey,
  };
};

const normalizeValue = (record: Record<string, unknown>): OperationalStatValue | null => {
  const operationCd =
    getValue(record, ['operationCd', 'OPERATION_CD', 'operation_cd', 'operation']) ?? '';
  const glMonth =
    getValue(record, ['glMonth', 'GL_MONTH', 'gl_month', 'period']) ?? '';
  const accountNumber =
    getValue(record, ['accountNumber', 'ACCOUNT_NUMBER', 'account_number', 'glId', 'GL_ID']) ??
    '';
  if (!operationCd || !glMonth || !accountNumber) {
    return null;
  }
  const glValue = toNumber(
    record.glValue ?? record.GL_VALUE ?? record.gl_value ?? record.value ?? 0
  );
  return {
    operationCd,
    glMonth,
    accountNumber,
    glValue,
  };
};

export const fetchClientOperationalStats = async (
  clientId: string,
  glMonth?: string | null,
): Promise<{ accounts: OperationalStatAccount[]; items: OperationalStatValue[] }> => {
  if (!clientId) {
    return { accounts: [], items: [] };
  }

  const params = new URLSearchParams({ clientId });
  if (glMonth) {
    params.set('glMonth', glMonth);
  }

  const response = await fetch(`${API_BASE_URL}/client-operational-stats?${params.toString()}`);
  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unable to load operational stats.');
    throw new Error(errorText || `Failed to load operational stats (${response.status})`);
  }

  const payload = (await response.json()) as {
    accounts?: Record<string, unknown>[];
    items?: Record<string, unknown>[];
  };

  const accounts = (payload.accounts ?? [])
    .map(normalizeAccount)
    .filter((account): account is OperationalStatAccount => Boolean(account));
  const items = (payload.items ?? [])
    .map(normalizeValue)
    .filter((value): value is OperationalStatValue => Boolean(value));

  return { accounts, items };
};

export interface RefreshFMStatisticsResult {
  success: boolean;
  message: string;
}

export interface FMStatisticsCheckResult {
  hasFMStatistics: boolean;
  mostRecentPeriod: string | null;
  nonSurveyAccountsWithData: number;
  totalNonSurveyAccounts: number;
}

export const refreshFMStatistics = async (
  scac: string,
  endDate?: string | null,
): Promise<RefreshFMStatisticsResult> => {
  if (!scac || !scac.trim()) {
    throw new Error('SCAC is required to refresh FreightMath statistics.');
  }

  const body: { scac: string; endDate?: string } = { scac: scac.trim() };
  if (endDate?.trim()) {
    body.endDate = endDate.trim();
  }

  const response = await fetch(`${API_BASE_URL}/client-operational-stats/refresh-fm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unable to refresh FM statistics.');
    throw new Error(errorText || `Failed to refresh FM statistics (${response.status})`);
  }

  const payload = (await response.json()) as { success?: boolean; message?: string };
  return {
    success: payload.success ?? true,
    message: payload.message ?? 'FreightMath statistics updated successfully.',
  };
};

export const checkClientFMStatistics = async (
  scac: string,
): Promise<FMStatisticsCheckResult> => {
  if (!scac || !scac.trim()) {
    return {
      hasFMStatistics: false,
      mostRecentPeriod: null,
      nonSurveyAccountsWithData: 0,
      totalNonSurveyAccounts: 0,
    };
  }

  const params = new URLSearchParams({ scac: scac.trim() });

  const response = await fetch(`${API_BASE_URL}/client-operational-stats/check-fm?${params.toString()}`);
  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unable to check FM statistics.');
    throw new Error(errorText || `Failed to check FM statistics (${response.status})`);
  }

  const payload = (await response.json()) as {
    hasFMStatistics?: boolean;
    mostRecentPeriod?: string | null;
    nonSurveyAccountsWithData?: number;
    totalNonSurveyAccounts?: number;
  };

  return {
    hasFMStatistics: payload.hasFMStatistics ?? false,
    mostRecentPeriod: payload.mostRecentPeriod ?? null,
    nonSurveyAccountsWithData: payload.nonSurveyAccountsWithData ?? 0,
    totalNonSurveyAccounts: payload.totalNonSurveyAccounts ?? 0,
  };
};
