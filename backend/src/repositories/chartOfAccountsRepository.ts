import { runQuery } from '../utils/sqlClient';

export interface ChartOfAccountRecord {
  accountNumber: string;
  coreAccount: string | null;
  operationalGroup: string | null;
  laborGroup: string | null;
  accountType: string | null;
  category: string | null;
  subCategory: string | null;
  description: string | null;
  isFinancial: boolean | null;
  isSurvey: boolean | null;
}

export interface SurveyChartOfAccountRecord {
  accountNumber: string;
  description: string | null;
  operationalGroup: string | null;
  laborGroup: string | null;
  accountType: string | null;
  category: string | null;
  subCategory: string | null;
}

const TABLE_NAME = 'ML.CHART_OF_ACCOUNTS';

const toNullableBoolean = (value: unknown): boolean | null => {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value === 1) {
      return true;
    }
    if (value === 0) {
      return false;
    }
    return null;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return null;
    }
    if (
      normalized === 'true' ||
      normalized === '1' ||
      normalized === 'yes' ||
      normalized === 'y'
    ) {
      return true;
    }
    if (
      normalized === 'false' ||
      normalized === '0' ||
      normalized === 'no' ||
      normalized === 'n'
    ) {
      return false;
    }
  }
  return null;
};

const toNullableString = (value: unknown): string | null => {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
};

const toRequiredString = (value: unknown): string => toNullableString(value) ?? '';

const hasIsFinancialColumn = async (): Promise<boolean> => {
  const { recordset = [] } = await runQuery<{ columnExists: number }>(
    `SELECT 1 AS columnExists
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = PARSENAME(@tableName, 2)
      AND TABLE_NAME = PARSENAME(@tableName, 1)
      AND COLUMN_NAME = 'IS_FINANCIAL'`,
    {
      tableName: TABLE_NAME,
    },
  );

  return recordset.length > 0;
};

const hasIsSurveyColumn = async (): Promise<boolean> => {
  const { recordset = [] } = await runQuery<{ columnExists: number }>(
    `SELECT 1 AS columnExists
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = PARSENAME(@tableName, 2)
      AND TABLE_NAME = PARSENAME(@tableName, 1)
      AND COLUMN_NAME = 'IS_SURVEY'`,
    {
      tableName: TABLE_NAME,
    },
  );

  return recordset.length > 0;
};

export const listChartOfAccountIds = async (): Promise<string[]> => {
  const { recordset = [] } = await runQuery<{ accountNumber?: string | null }>(
    `SELECT ACCOUNT_NUMBER AS accountNumber
    FROM ${TABLE_NAME}
    ORDER BY ACCOUNT_NUMBER`
  );

  const accounts = recordset
    .map((row) => toNullableString(row.accountNumber))
    .filter((account): account is string => Boolean(account));

  const seen = new Set<string>();
  const unique: string[] = [];
  accounts.forEach((account) => {
    if (!seen.has(account)) {
      seen.add(account);
      unique.push(account);
    }
  });

  return unique;
};

export const listSurveyAccountIds = async (): Promise<string[]> => {
  const includeIsSurvey = await hasIsSurveyColumn();
  if (!includeIsSurvey) {
    return [];
  }

  const { recordset = [] } = await runQuery<{ accountNumber?: string | null }>(
    `SELECT ACCOUNT_NUMBER AS accountNumber
    FROM ${TABLE_NAME}
    WHERE IS_SURVEY = 1
    ORDER BY ACCOUNT_NUMBER`
  );

  const accounts = recordset
    .map((row) => toNullableString(row.accountNumber))
    .filter((account): account is string => Boolean(account));

  const seen = new Set<string>();
  const unique: string[] = [];
  accounts.forEach((account) => {
    if (!seen.has(account)) {
      seen.add(account);
      unique.push(account);
    }
  });

  return unique;
};

export const listSurveyChartOfAccounts = async (): Promise<SurveyChartOfAccountRecord[]> => {
  const includeIsSurvey = await hasIsSurveyColumn();
  if (!includeIsSurvey) {
    return [];
  }

  const { recordset = [] } = await runQuery<Record<string, unknown>>(
    `SELECT
      ACCOUNT_NUMBER AS accountNumber,
      DESCRIPTION AS description,
      OPERATIONAL_GROUP AS operationalGroup,
      LABOR_GROUP AS laborGroup,
      ACCOUNT_TYPE AS accountType,
      CATEGORY AS category,
      SUB_CATEGORY AS subCategory
    FROM ${TABLE_NAME}
    WHERE IS_SURVEY = 1
    ORDER BY SUB_CATEGORY, LABOR_GROUP, OPERATIONAL_GROUP, ACCOUNT_NUMBER`
  );

  return recordset.map((row) => ({
    accountNumber: toRequiredString(row.accountNumber),
    description: toNullableString(row.description),
    operationalGroup: toNullableString(row.operationalGroup),
    laborGroup: toNullableString(row.laborGroup),
    accountType: toNullableString(row.accountType),
    category: toNullableString(row.category),
    subCategory: toNullableString(row.subCategory),
  }));
};

export const listChartOfAccounts = async (): Promise<ChartOfAccountRecord[]> => {
  const includeIsFinancial = await hasIsFinancialColumn();
  const includeIsSurvey = await hasIsSurveyColumn();
  const selectClause = `SELECT
      ACCOUNT_NUMBER AS accountNumber,
      CORE_ACCOUNT AS coreAccount,
      OPERATIONAL_GROUP AS operationalGroup,
      LABOR_GROUP AS laborGroup,
      ACCOUNT_TYPE AS accountType,
      CATEGORY AS category,
      SUB_CATEGORY AS subCategory,
      DESCRIPTION AS description${
        includeIsFinancial ? ',\n      IS_FINANCIAL AS isFinancial' : ''
      }${
        includeIsSurvey ? ',\n      IS_SURVEY AS isSurvey' : ''
      }
    FROM ${TABLE_NAME}
    ORDER BY ACCOUNT_NUMBER`;
  const { recordset = [] } = await runQuery<Record<string, unknown>>(selectClause);

  return recordset.map((row) => ({
    accountNumber: toRequiredString(row.accountNumber),
    coreAccount: toNullableString(row.coreAccount),
    operationalGroup: toNullableString(row.operationalGroup),
    laborGroup: toNullableString(row.laborGroup),
    accountType: toNullableString(row.accountType),
    category: toNullableString(row.category),
    subCategory: toNullableString(row.subCategory),
    description: toNullableString(row.description),
    isFinancial: includeIsFinancial ? toNullableBoolean(row.isFinancial) : null,
    isSurvey: includeIsSurvey ? toNullableBoolean(row.isSurvey) : null,
  }));
};

export default listChartOfAccounts;
