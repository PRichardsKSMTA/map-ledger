import { normalizeGlMonth } from '../utils/glMonth';
import { runQuery } from '../utils/sqlClient';
import { listSurveyChartOfAccounts } from './chartOfAccountsRepository';

export interface ClientSurveyRow {
  operationCd: string;
  glMonth: string;
  glValue: number;
  accountNumber: string;
  accountName: string;
  operationalGroup: string | null;
  laborGroup: string | null;
}

export interface ClientSurveyValue {
  operationCd: string;
  glMonth: string;
  glValue: number;
  accountNumber: string;
}

export interface ClientSurveySnapshot {
  accounts: {
    accountNumber: string;
    description: string | null;
    operationalGroup: string | null;
    laborGroup: string | null;
    accountType: string | null;
    category: string | null;
    subCategory: string | null;
  }[];
  currentValues: ClientSurveyValue[];
  previousValues: ClientSurveyValue[];
}

export interface ClientSurveyUpdateInput {
  operationCd: string;
  glMonth: string;
  accountNumber: string;
  glValue: number;
}

const VIEW_NAME = 'ML.V_CLIENT_SURVEY_DATA';
const TABLE_NAME = 'ML.CLIENT_GL_DATA';

const normalizeText = (value?: string | null): string | null => {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeOperationCode = (value?: string | null): string | null => {
  const normalized = normalizeText(value);
  return normalized ? normalized.toUpperCase() : null;
};

const toSqlMonth = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }
  const normalized = normalizeGlMonth(value);
  return normalized || null;
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const mapRow = (row: {
  operation_cd?: string | null;
  gl_month?: string | null;
  gl_value?: number | string | null;
  account_number?: string | null;
  account_name?: string | null;
  operational_group?: string | null;
  labor_group?: string | null;
}): ClientSurveyRow => ({
  operationCd: row.operation_cd ?? '',
  glMonth: row.gl_month ?? '',
  glValue: toNumber(row.gl_value) ?? 0,
  accountNumber: row.account_number ?? '',
  accountName: row.account_name ?? '',
  operationalGroup: row.operational_group ?? null,
  laborGroup: row.labor_group ?? null,
});

const mapValueRow = (row: {
  operation_cd?: string | null;
  gl_month?: string | null;
  gl_value?: number | string | null;
  account_number?: string | null;
}): ClientSurveyValue => ({
  operationCd: row.operation_cd ?? '',
  glMonth: row.gl_month ?? '',
  glValue: toNumber(row.gl_value) ?? 0,
  accountNumber: row.account_number ?? '',
});

export const listClientSurveyData = async (
  clientId: string,
  glMonth?: string | null,
): Promise<ClientSurveyRow[]> => {
  if (!clientId) {
    return [];
  }

  const normalizedMonth = toSqlMonth(glMonth ?? null);
  const params: Record<string, unknown> = { clientId };
  const monthClause = normalizedMonth ? 'AND GL_MONTH = @glMonth' : '';
  if (normalizedMonth) {
    params.glMonth = normalizedMonth;
  }

  const result = await runQuery<{
    operation_cd?: string | null;
    gl_month?: string | null;
    gl_value?: number | string | null;
    account_number?: string | null;
    account_name?: string | null;
    operational_group?: string | null;
    labor_group?: string | null;
  }>(
    `SELECT
      OPERATION_CD as operation_cd,
      GL_MONTH as gl_month,
      GL_VALUE as gl_value,
      ACCOUNT_NUMBER as account_number,
      ACCOUNT_NAME as account_name,
      OPERATIONAL_GROUP as operational_group,
      LABOR_GROUP as labor_group
    FROM ${VIEW_NAME}
    WHERE CLIENT_ID = @clientId
    ${monthClause}
    ORDER BY OPERATION_CD ASC, ACCOUNT_NUMBER ASC`,
    params,
  );

  return (result.recordset ?? []).map(mapRow);
};

export const listLatestClientSurveyValues = async (
  clientId: string,
  glMonth?: string | null,
): Promise<ClientSurveyValue[]> => {
  if (!clientId) {
    return [];
  }

  const normalizedMonth = toSqlMonth(glMonth ?? null);
  if (!normalizedMonth) {
    return [];
  }

  const result = await runQuery<{
    operation_cd?: string | null;
    gl_month?: string | null;
    gl_value?: number | string | null;
    account_number?: string | null;
  }>(
    `WITH ranked AS (
      SELECT
        OPERATION_CD as operation_cd,
        GL_MONTH as gl_month,
        GL_VALUE as gl_value,
        ACCOUNT_NUMBER as account_number,
        ROW_NUMBER() OVER (
          PARTITION BY OPERATION_CD, ACCOUNT_NUMBER
          ORDER BY GL_MONTH DESC
        ) AS row_num
      FROM ${VIEW_NAME}
      WHERE CLIENT_ID = @clientId
        AND GL_MONTH < @glMonth
    )
    SELECT
      operation_cd,
      gl_month,
      gl_value,
      account_number
    FROM ranked
    WHERE row_num = 1`,
    { clientId, glMonth: normalizedMonth },
  );

  return (result.recordset ?? []).map(mapValueRow);
};

export const getClientSurveySnapshot = async (
  clientId: string,
  glMonth?: string | null,
): Promise<ClientSurveySnapshot> => {
  const [accounts, currentValues, previousValues] = await Promise.all([
    listSurveyChartOfAccounts(),
    listClientSurveyData(clientId, glMonth ?? undefined).then(rows =>
      rows.map(row => ({
        operationCd: row.operationCd,
        glMonth: row.glMonth,
        glValue: row.glValue,
        accountNumber: row.accountNumber,
      })),
    ),
    listLatestClientSurveyValues(clientId, glMonth ?? undefined),
  ]);

  return {
    accounts,
    currentValues,
    previousValues,
  };
};

const sanitizeUpdates = (
  updates: ClientSurveyUpdateInput[],
): ClientSurveyUpdateInput[] => {
  const sanitized: ClientSurveyUpdateInput[] = [];
  updates.forEach(update => {
    const operationCd = normalizeOperationCode(update.operationCd);
    const accountNumber = normalizeText(update.accountNumber);
    const glMonth = toSqlMonth(update.glMonth);
    const glValue = Number.isFinite(update.glValue) ? update.glValue : NaN;

    if (!operationCd || !accountNumber || !glMonth || !Number.isFinite(glValue)) {
      return;
    }

    sanitized.push({
      operationCd,
      accountNumber,
      glMonth,
      glValue,
    });
  });

  return sanitized;
};

export const updateClientSurveyValues = async (
  updates: ClientSurveyUpdateInput[],
): Promise<number> => {
  const sanitized = sanitizeUpdates(updates);
  if (!sanitized.length) {
    return 0;
  }

  const params: Record<string, unknown> = {};
  const valuesClause = sanitized
    .map((update, index) => {
      params[`operationCd${index}`] = update.operationCd;
      params[`glId${index}`] = update.accountNumber;
      params[`glMonth${index}`] = update.glMonth;
      params[`glValue${index}`] = update.glValue;
      return `(@operationCd${index}, @glId${index}, @glMonth${index}, @glValue${index})`;
    })
    .join(', ');

  const result = await runQuery(
    `MERGE ${TABLE_NAME} AS target
    USING (VALUES ${valuesClause}) AS source (
      operation_cd,
      gl_id,
      gl_month,
      gl_value
    )
    ON target.OPERATION_CD = source.operation_cd
      AND target.GL_ID = source.gl_id
      AND target.GL_MONTH = source.gl_month
    WHEN MATCHED THEN
      UPDATE SET GL_VALUE = source.gl_value
    WHEN NOT MATCHED THEN
      INSERT (OPERATION_CD, GL_ID, GL_MONTH, GL_VALUE)
      VALUES (source.operation_cd, source.gl_id, source.gl_month, source.gl_value);`,
    params,
  );

  return result.rowsAffected?.[0] ?? 0;
};

export default {
  listClientSurveyData,
  listLatestClientSurveyValues,
  getClientSurveySnapshot,
  updateClientSurveyValues,
};
