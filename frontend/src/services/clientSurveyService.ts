export interface SurveyAccount {
  accountNumber: string;
  description: string | null;
  operationalGroup: string | null;
  laborGroup: string | null;
  accountType: string | null;
  category: string | null;
  subCategory: string | null;
}

export interface ClientSurveyValue {
  operationCd: string;
  glMonth: string;
  glValue: number;
  accountNumber: string;
}

export interface ClientSurveySnapshot {
  accounts: SurveyAccount[];
  currentValues: ClientSurveyValue[];
  previousValues: ClientSurveyValue[];
}

export interface ClientSurveyUpdateInput {
  operationCd: string;
  glMonth: string;
  accountNumber: string;
  glValue: number;
}

const env = import.meta.env;
const API_BASE_URL = env.VITE_API_BASE_URL ?? '/api';

const coerceString = (value: unknown): string => {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return '';
};

const coerceNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const getValue = (row: Record<string, unknown>, keys: string[]): string => {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(row, key)) {
      continue;
    }
    const value = row[key];
    const normalized = coerceString(value);
    if (normalized) {
      return normalized;
    }
  }
  return '';
};

const getNumber = (row: Record<string, unknown>, keys: string[]): number => {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(row, key)) {
      continue;
    }
    const value = row[key];
    const normalized = coerceNumber(value);
    if (Number.isFinite(normalized)) {
      return normalized;
    }
  }
  return 0;
};

const normalizeValue = (row: Record<string, unknown>): ClientSurveyValue => ({
  operationCd: getValue(row, ['operationCd', 'operation_cd', 'OPERATION_CD']),
  glMonth: getValue(row, ['glMonth', 'gl_month', 'GL_MONTH']),
  glValue: getNumber(row, ['glValue', 'gl_value', 'GL_VALUE']),
  accountNumber: getValue(row, [
    'accountNumber',
    'account_number',
    'ACCOUNT_NUMBER',
    'glId',
    'gl_id',
    'GL_ID',
  ]),
});

const normalizeAccount = (row: Record<string, unknown>): SurveyAccount => ({
  accountNumber: getValue(row, ['accountNumber', 'account_number', 'ACCOUNT_NUMBER']),
  description: getValue(row, ['description', 'DESCRIPTION']) || null,
  operationalGroup: getValue(row, ['operationalGroup', 'operational_group', 'OPERATIONAL_GROUP']) || null,
  laborGroup: getValue(row, ['laborGroup', 'labor_group', 'LABOR_GROUP']) || null,
  accountType: getValue(row, ['accountType', 'account_type', 'ACCOUNT_TYPE']) || null,
  category: getValue(row, ['category', 'CATEGORY']) || null,
  subCategory: getValue(row, ['subCategory', 'sub_category', 'SUB_CATEGORY']) || null,
});

export const fetchClientSurveyData = async (
  clientId: string,
  glMonth?: string | null,
): Promise<ClientSurveySnapshot> => {
  const params = new URLSearchParams();
  params.set('clientId', clientId);
  if (glMonth) {
    params.set('glMonth', glMonth);
  }

  const response = await fetch(`${API_BASE_URL}/client-survey?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(errorText || `Failed to load client survey data (${response.status})`);
  }

  const payload = (await response.json()) as {
    items?: Record<string, unknown>[];
    accounts?: Record<string, unknown>[];
    previousValues?: Record<string, unknown>[];
  };

  return {
    accounts: (payload.accounts ?? []).map(normalizeAccount),
    currentValues: (payload.items ?? []).map(normalizeValue),
    previousValues: (payload.previousValues ?? []).map(normalizeValue),
  };
};

export const updateClientSurveyValues = async (
  updates: ClientSurveyUpdateInput[],
): Promise<number> => {
  const response = await fetch(`${API_BASE_URL}/client-survey`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: updates }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(errorText || 'Unable to update survey values.');
  }

  const payload = (await response.json().catch(() => null)) as
    | { updatedCount?: number }
    | null;
  return payload?.updatedCount ?? updates.length;
};
