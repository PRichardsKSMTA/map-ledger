import { runQuery } from '../utils/sqlClient';
import {
  buildCoaTableName,
  isSafeTableName,
  listIndustries,
  normalizeIndustryName,
} from './industriesRepository';

export interface CoaManagerColumn {
  key: string;
  label: string;
}

export interface CoaManagerRow {
  id: string;
  accountNumber: string;
  accountName: string;
  laborGroup: string | null;
  operationalGroup: string | null;
  category: string | null;
  accountType: string | null;
  subCategory: string | null;
  department: string | null;
  costType: string | null;
  isFinancial: boolean | null;
  isSurvey: boolean | null;
}

export interface CoaManagerAccountInput {
  accountNumber?: string | null;
  coreAccount?: string | null;
  operationalGroupCode?: string | null;
  laborGroupCode?: string | null;
  accountName?: string | null;
  laborGroup?: string | null;
  operationalGroup?: string | null;
  category?: string | null;
  accountType?: string | null;
  subCategory?: string | null;
  department?: string | null;
  costType?: string | null;
  isFinancial?: boolean | null;
  isSurvey?: boolean | null;
}

export interface IndustryCoaData {
  columns: CoaManagerColumn[];
  rows: CoaManagerRow[];
}

export class IndustryNotFoundError extends Error {
  code = 'industry_not_found';

  constructor(message = 'Industry not found.') {
    super(message);
    this.name = 'IndustryNotFoundError';
  }
}

export class InvalidIndustryNameError extends Error {
  code = 'invalid_industry_name';

  constructor(message = 'Industry name is invalid.') {
    super(message);
    this.name = 'InvalidIndustryNameError';
  }
}

export class InvalidIndustryTableError extends Error {
  code = 'invalid_industry_table';

  constructor(message = 'Industry table configuration is invalid.') {
    super(message);
    this.name = 'InvalidIndustryTableError';
  }
}

const normalizeText = (value?: string | null): string | null => {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

type ColumnMapping = {
  recordId: string | null;
  accountNumber: string | null;
  coreAccount: string | null;
  operationalGroupCode: string | null;
  laborGroupCode: string | null;
  accountName: string | null;
  laborGroup: string | null;
  operationalGroup: string | null;
  category: string | null;
  accountType: string | null;
  subCategory: string | null;
  department: string | null;
  costType: string | null;
  isFinancial: string | null;
  isSurvey: string | null;
};

const COLUMN_ALIASES: Record<keyof ColumnMapping, string[]> = {
  recordId: ['RECORD_ID', 'RECORDID', 'ID'],
  accountNumber: [
    'ACCOUNT_NUMBER',
    'ACCOUNT',
    'ACCOUNT_NO',
    'ACCT_NO',
    'ACCT_NUMBER',
    'ACCOUNTNUM',
    'ACCOUNT_NUM',
    'GL_ACCOUNT',
    'GL_ACCOUNT_NUMBER',
  ],
  coreAccount: ['CORE_ACCOUNT', 'COREACCOUNT', 'CORE ACCOUNT'],
  operationalGroupCode: [
    'OPERATIONAL_GROUP_CODE',
    'OPERATIONALGROUPCODE',
    'OPERATIONAL GROUP CODE',
    'OP_GROUP_CODE',
  ],
  laborGroupCode: ['LABOR_GROUP_CODE', 'LABORGROUPCODE', 'LABOR GROUP CODE'],
  accountName: [
    'ACCOUNT_NAME',
    'ACCOUNT_DESCRIPTION',
    'ACCOUNT_DESC',
    'DESCRIPTION',
    'NAME',
    'ACCT_NAME',
  ],
  laborGroup: ['LABOR_GROUP', 'LABORGROUP', 'LABOR GROUP'],
  operationalGroup: [
    'OPERATIONAL_GROUP',
    'OPERATIONALGROUP',
    'OPERATIONAL GROUP',
    'OP_GROUP',
  ],
  category: ['CATEGORY', 'ACCOUNT_CATEGORY', 'ACCT_CATEGORY'],
  accountType: ['ACCOUNT_TYPE', 'ACCOUNT TYPE', 'ACCT_TYPE', 'ACCT TYPE', 'TYPE'],
  subCategory: ['SUB_CATEGORY', 'SUBCATEGORY', 'SUB CATEGORY', 'ACCOUNT_SUBCATEGORY'],
  department: ['DEPARTMENT', 'DEPT'],
  costType: ['COST_TYPE', 'COSTTYPE'],
  isFinancial: ['IS_FINANCIAL', 'ISFINANCIAL'],
  isSurvey: ['IS_SURVEY', 'ISSURVEY'],
};

const IS_FINANCIAL_COLUMN_TYPE = 'BIT';
const IS_SURVEY_COLUMN_TYPE = 'BIT';

const normalizeColumnKey = (value: string): string =>
  value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_');

const escapeColumnName = (value: string): string => `[${value.replace(/]/g, ']]')}]`;

const splitTableName = (tableName: string): { schema: string; name: string } => {
  const [schema, name] = tableName.split('.');
  return { schema: schema ?? 'dbo', name: name ?? tableName };
};

const resolveColumnName = (aliases: string[], lookup: Map<string, string>): string | null => {
  for (const alias of aliases) {
    const normalized = normalizeColumnKey(alias);
    const match = lookup.get(normalized);
    if (match) {
      return match;
    }
  }
  return null;
};

const buildColumnMapping = (columns: string[]): ColumnMapping => {
  const lookup = new Map<string, string>();
  columns.forEach((column) => {
    lookup.set(normalizeColumnKey(column), column);
  });

  return {
    recordId: resolveColumnName(COLUMN_ALIASES.recordId, lookup),
    accountNumber: resolveColumnName(COLUMN_ALIASES.accountNumber, lookup),
    coreAccount: resolveColumnName(COLUMN_ALIASES.coreAccount, lookup),
    operationalGroupCode: resolveColumnName(COLUMN_ALIASES.operationalGroupCode, lookup),
    laborGroupCode: resolveColumnName(COLUMN_ALIASES.laborGroupCode, lookup),
    accountName: resolveColumnName(COLUMN_ALIASES.accountName, lookup),
    laborGroup: resolveColumnName(COLUMN_ALIASES.laborGroup, lookup),
    operationalGroup: resolveColumnName(COLUMN_ALIASES.operationalGroup, lookup),
    category: resolveColumnName(COLUMN_ALIASES.category, lookup),
    accountType: resolveColumnName(COLUMN_ALIASES.accountType, lookup),
    subCategory: resolveColumnName(COLUMN_ALIASES.subCategory, lookup),
    department: resolveColumnName(COLUMN_ALIASES.department, lookup),
    costType: resolveColumnName(COLUMN_ALIASES.costType, lookup),
    isFinancial: resolveColumnName(COLUMN_ALIASES.isFinancial, lookup),
    isSurvey: resolveColumnName(COLUMN_ALIASES.isSurvey, lookup),
  };
};

const buildColumnResponse = (mapping: ColumnMapping): CoaManagerColumn[] => [
  { key: 'accountNumber', label: mapping.accountNumber ?? 'Account' },
  { key: 'accountName', label: mapping.accountName ?? 'Name' },
  { key: 'laborGroup', label: mapping.laborGroup ?? 'Labor Group' },
  { key: 'operationalGroup', label: mapping.operationalGroup ?? 'Operational Group' },
  { key: 'category', label: mapping.category ?? 'Category' },
  { key: 'accountType', label: mapping.accountType ?? 'Account Type' },
  { key: 'subCategory', label: mapping.subCategory ?? 'Sub Category' },
  { key: 'department', label: mapping.department ?? 'Department' },
  { key: 'isFinancial', label: mapping.isFinancial ?? 'Is Financial' },
  { key: 'isSurvey', label: mapping.isSurvey ?? 'Is Survey' },
  { key: 'costType', label: mapping.costType ?? 'Cost Type' },
];

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
  return String(value);
};

const toRequiredString = (value: unknown): string => toNullableString(value) ?? '';

const parseAccountNumberParts = (
  value?: string | null,
): { core: string; operationalGroupCode: string; laborGroupCode: string } | null => {
  if (!value) {
    return null;
  }
  const match = value.trim().match(/^(\d+)-(\d+)-(\d+)$/);
  if (!match) {
    return null;
  }
  const [, core, operationalGroupCode, laborGroupCode] = match;
  return {
    core,
    operationalGroupCode: operationalGroupCode.padStart(3, '0'),
    laborGroupCode: laborGroupCode.padStart(3, '0'),
  };
};

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
      normalized === 'y' ||
      normalized.includes('financial')
    ) {
      return true;
    }
    if (
      normalized === 'false' ||
      normalized === '0' ||
      normalized === 'no' ||
      normalized === 'n' ||
      normalized.includes('operational')
    ) {
      return false;
    }
  }
  return null;
};

const resolveIndustryTableName = async (industryName: string): Promise<string> => {
  const normalized = normalizeIndustryName(industryName);
  if (!normalized) {
    throw new InvalidIndustryNameError();
  }

  const industries = await listIndustries();
  const match = industries.find((industry) => industry.normalizedName === normalized);
  if (!match) {
    throw new IndustryNotFoundError();
  }

  const expectedTableName = buildCoaTableName(normalized);
  const resolvedTableName = match.tableName?.trim() || expectedTableName;

  if (!isSafeTableName(resolvedTableName)) {
    throw new InvalidIndustryTableError();
  }

  const allowlist = new Set(
    industries.map((industry) =>
      (industry.tableName?.trim() || buildCoaTableName(industry.normalizedName)).toUpperCase(),
    ),
  );
  if (!allowlist.has(resolvedTableName.toUpperCase())) {
    throw new InvalidIndustryTableError();
  }

  return resolvedTableName;
};

const listTableColumns = async (tableName: string): Promise<string[]> => {
  const { schema, name } = splitTableName(tableName);
  const { recordset = [] } = await runQuery<{ column_name: string }>(
    `SELECT COLUMN_NAME AS column_name
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @schema
      AND TABLE_NAME = @name
    ORDER BY ORDINAL_POSITION`,
    {
      schema,
      name,
    },
  );

  return recordset.map((row) => row.column_name);
};

const ensureIsFinancialColumn = async (tableName: string): Promise<void> => {
  await runQuery(
    `IF NOT EXISTS (
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = PARSENAME(@tableName, 2)
        AND TABLE_NAME = PARSENAME(@tableName, 1)
        AND COLUMN_NAME = 'IS_FINANCIAL'
    )
    BEGIN
      EXEC('ALTER TABLE ${tableName} ADD [IS_FINANCIAL] ${IS_FINANCIAL_COLUMN_TYPE} NULL')
    END`,
    {
      tableName,
    },
  );
};

const ensureIsSurveyColumn = async (tableName: string): Promise<void> => {
  await runQuery(
    `IF NOT EXISTS (
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = PARSENAME(@tableName, 2)
        AND TABLE_NAME = PARSENAME(@tableName, 1)
        AND COLUMN_NAME = 'IS_SURVEY'
    )
    BEGIN
      EXEC('ALTER TABLE ${tableName} ADD [IS_SURVEY] ${IS_SURVEY_COLUMN_TYPE} NULL')
    END`,
    {
      tableName,
    },
  );
};

export const listIndustryCoaData = async (
  industryName: string,
): Promise<IndustryCoaData> => {
  const tableName = await resolveIndustryTableName(industryName);
  await ensureIsFinancialColumn(tableName);
  await ensureIsSurveyColumn(tableName);
  const tableColumns = await listTableColumns(tableName);
  const mapping = buildColumnMapping(tableColumns);
  const orderByColumn = mapping.accountNumber ?? mapping.recordId;
  const orderClause = orderByColumn ? ` ORDER BY ${escapeColumnName(orderByColumn)}` : '';
  const { recordset = [] } = await runQuery<Record<string, unknown>>(
    `SELECT *
    FROM ${tableName}${orderClause}`,
  );

  const rows = recordset.map((row, index) => {
    const recordIdValue = mapping.recordId ? row[mapping.recordId] : null;
    const accountNumber = toRequiredString(
      mapping.accountNumber ? row[mapping.accountNumber] : null,
    );
    const accountName = toRequiredString(mapping.accountName ? row[mapping.accountName] : null);
    const id =
      recordIdValue !== null && recordIdValue !== undefined
        ? String(recordIdValue)
        : accountNumber || accountName || `row-${index}`;

    return {
      id,
      accountNumber,
      accountName,
      laborGroup: toNullableString(mapping.laborGroup ? row[mapping.laborGroup] : null),
      operationalGroup: toNullableString(
        mapping.operationalGroup ? row[mapping.operationalGroup] : null,
      ),
      category: toNullableString(mapping.category ? row[mapping.category] : null),
      accountType: toNullableString(mapping.accountType ? row[mapping.accountType] : null),
      subCategory: toNullableString(mapping.subCategory ? row[mapping.subCategory] : null),
      department: toNullableString(mapping.department ? row[mapping.department] : null),
      costType: toNullableString(mapping.costType ? row[mapping.costType] : null),
      isFinancial: toNullableBoolean(mapping.isFinancial ? row[mapping.isFinancial] : null),
      isSurvey: toNullableBoolean(mapping.isSurvey ? row[mapping.isSurvey] : null),
    };
  });

  return {
    columns: buildColumnResponse(mapping),
    rows,
  };
};

export const updateIndustryCostType = async (
  industryName: string,
  recordId: string,
  costType: string | null,
): Promise<boolean> => {
  const tableName = await resolveIndustryTableName(industryName);
  const result = await runQuery(
    `UPDATE ${tableName}
    SET COST_TYPE = @costType
    WHERE RECORD_ID = @recordId`,
    {
      costType: normalizeText(costType),
      recordId,
    },
  );

  return (result.rowsAffected?.[0] ?? 0) > 0;
};

export const updateIndustryIsFinancial = async (
  industryName: string,
  recordId: string,
  isFinancial: boolean | null,
): Promise<boolean> => {
  const tableName = await resolveIndustryTableName(industryName);
  const result = await runQuery(
    `UPDATE ${tableName}
    SET IS_FINANCIAL = @isFinancial
    WHERE RECORD_ID = @recordId`,
    {
      isFinancial,
      recordId,
    },
  );

  return (result.rowsAffected?.[0] ?? 0) > 0;
};

export const updateIndustryIsSurvey = async (
  industryName: string,
  recordId: string,
  isSurvey: boolean | null,
): Promise<boolean> => {
  const tableName = await resolveIndustryTableName(industryName);
  const result = await runQuery(
    `UPDATE ${tableName}
    SET IS_SURVEY = @isSurvey
    WHERE RECORD_ID = @recordId`,
    {
      isSurvey,
      recordId,
    },
  );

  return (result.rowsAffected?.[0] ?? 0) > 0;
};

export const updateIndustryCostTypeBatch = async (
  industryName: string,
  recordIds: string[],
  costType: string | null,
): Promise<number> => {
  if (recordIds.length === 0) {
    return 0;
  }

  const tableName = await resolveIndustryTableName(industryName);
  const params: Record<string, unknown> = {
    costType: normalizeText(costType),
  };
  const idsClause = recordIds
    .map((recordId, index) => {
      params[`recordId${index}`] = recordId;
      return `@recordId${index}`;
    })
    .join(', ');

  const result = await runQuery(
    `UPDATE ${tableName}
    SET COST_TYPE = @costType
    WHERE RECORD_ID IN (${idsClause})`,
    params,
  );

  return result.rowsAffected?.[0] ?? 0;
};

export const updateIndustryIsFinancialBatch = async (
  industryName: string,
  recordIds: string[],
  isFinancial: boolean | null,
): Promise<number> => {
  if (recordIds.length === 0) {
    return 0;
  }

  const tableName = await resolveIndustryTableName(industryName);
  const params: Record<string, unknown> = {
    isFinancial,
  };
  const idsClause = recordIds
    .map((recordId, index) => {
      params[`recordId${index}`] = recordId;
      return `@recordId${index}`;
    })
    .join(', ');

  const result = await runQuery(
    `UPDATE ${tableName}
    SET IS_FINANCIAL = @isFinancial
    WHERE RECORD_ID IN (${idsClause})`,
    params,
  );

  return result.rowsAffected?.[0] ?? 0;
};

export const updateIndustryIsSurveyBatch = async (
  industryName: string,
  recordIds: string[],
  isSurvey: boolean | null,
): Promise<number> => {
  if (recordIds.length === 0) {
    return 0;
  }

  const tableName = await resolveIndustryTableName(industryName);
  const params: Record<string, unknown> = {
    isSurvey,
  };
  const idsClause = recordIds
    .map((recordId, index) => {
      params[`recordId${index}`] = recordId;
      return `@recordId${index}`;
    })
    .join(', ');

  const result = await runQuery(
    `UPDATE ${tableName}
    SET IS_SURVEY = @isSurvey
    WHERE RECORD_ID IN (${idsClause})`,
    params,
  );

  return result.rowsAffected?.[0] ?? 0;
};

const toNullableBitString = (value?: boolean | null): string | null => {
  if (value === undefined || value === null) {
    return null;
  }
  return value ? '1' : '0';
};

const buildJsonPath = (column: string): string => {
  const escaped = column.replace(/"/g, '""');
  return `$.\"${escaped}\"`;
};

const buildInsertPayload = (
  rows: CoaManagerAccountInput[],
  mapping: ColumnMapping,
): { columns: string[]; rows: Record<string, string | null>[] } => {
  const columnLookup = {
    accountNumber: mapping.accountNumber,
    coreAccount: mapping.coreAccount,
    operationalGroupCode: mapping.operationalGroupCode,
    laborGroupCode: mapping.laborGroupCode,
    accountName: mapping.accountName,
    laborGroup: mapping.laborGroup,
    operationalGroup: mapping.operationalGroup,
    category: mapping.category,
    accountType: mapping.accountType,
    subCategory: mapping.subCategory,
    department: mapping.department,
    costType: mapping.costType,
    isFinancial: mapping.isFinancial,
    isSurvey: mapping.isSurvey,
  };

  const columns = Object.values(columnLookup).filter(
    (value): value is string => Boolean(value),
  );

  const payloadRows = rows.map((row) => {
    const record: Record<string, string | null> = {};
    const parsedAccountNumber = parseAccountNumberParts(row.accountNumber ?? null);
    if (columnLookup.accountNumber) {
      record[columnLookup.accountNumber] = normalizeText(row.accountNumber ?? null);
    }
    if (columnLookup.coreAccount) {
      record[columnLookup.coreAccount] = normalizeText(
        row.coreAccount ?? parsedAccountNumber?.core ?? null,
      );
    }
    if (columnLookup.operationalGroupCode) {
      record[columnLookup.operationalGroupCode] = normalizeText(
        row.operationalGroupCode ?? parsedAccountNumber?.operationalGroupCode ?? null,
      );
    }
    if (columnLookup.laborGroupCode) {
      record[columnLookup.laborGroupCode] = normalizeText(
        row.laborGroupCode ?? parsedAccountNumber?.laborGroupCode ?? null,
      );
    }
    if (columnLookup.accountName) {
      record[columnLookup.accountName] = normalizeText(row.accountName ?? null);
    }
    if (columnLookup.laborGroup) {
      record[columnLookup.laborGroup] = normalizeText(row.laborGroup ?? null);
    }
    if (columnLookup.operationalGroup) {
      record[columnLookup.operationalGroup] = normalizeText(row.operationalGroup ?? null);
    }
    if (columnLookup.category) {
      record[columnLookup.category] = normalizeText(row.category ?? null);
    }
    if (columnLookup.accountType) {
      record[columnLookup.accountType] = normalizeText(row.accountType ?? null);
    }
    if (columnLookup.subCategory) {
      record[columnLookup.subCategory] = normalizeText(row.subCategory ?? null);
    }
    if (columnLookup.department) {
      record[columnLookup.department] = normalizeText(row.department ?? null);
    }
    if (columnLookup.costType) {
      record[columnLookup.costType] = normalizeText(row.costType ?? null);
    }
    if (columnLookup.isFinancial) {
      record[columnLookup.isFinancial] = toNullableBitString(row.isFinancial ?? null);
    }
    if (columnLookup.isSurvey) {
      record[columnLookup.isSurvey] = toNullableBitString(row.isSurvey ?? null);
    }
    return record;
  });

  return { columns, rows: payloadRows };
};

export const insertIndustryAccounts = async (
  industryName: string,
  rows: CoaManagerAccountInput[],
): Promise<number> => {
  if (rows.length === 0) {
    return 0;
  }

  const tableName = await resolveIndustryTableName(industryName);
  await ensureIsFinancialColumn(tableName);
  await ensureIsSurveyColumn(tableName);
  const tableColumns = await listTableColumns(tableName);
  const mapping = buildColumnMapping(tableColumns);
  const payload = buildInsertPayload(rows, mapping);

  if (payload.columns.length === 0 || payload.rows.length === 0) {
    return 0;
  }

  const columnList = payload.columns.map((column) => escapeColumnName(column)).join(', ');
  const withClause = payload.columns
    .map((column) => `  ${escapeColumnName(column)} NVARCHAR(255) '${buildJsonPath(column)}'`)
    .join(',\n');
  const jsonPayload = JSON.stringify(payload.rows);

  const sql = `DECLARE @payload NVARCHAR(MAX) = @jsonPayload;

    WITH SourceRows AS (
      SELECT *
      FROM OPENJSON(@payload)
      WITH (
${withClause}
      )
    )
    INSERT INTO ${tableName} (${columnList})
    SELECT ${columnList}
    FROM SourceRows;`;

  await runQuery(sql, { jsonPayload });
  return payload.rows.length;
};

export default listIndustryCoaData;
