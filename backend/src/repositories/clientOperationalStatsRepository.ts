import { normalizeGlMonth } from '../utils/glMonth';
import { runQuery } from '../utils/sqlClient';

export interface OperationalStatAccount {
  accountNumber: string;
  description: string | null;
}

export interface ClientOperationalStatRow {
  operationCd: string;
  glMonth: string;
  accountNumber: string;
  glValue: number;
}

const CHART_TABLE = 'ML.CHART_OF_ACCOUNTS';
const GL_TABLE = 'ML.CLIENT_GL_DATA';
const OPERATIONS_VIEW = 'ML.V_CLIENT_OPERATIONS';

const normalizeText = (value?: string | null): string | null => {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toRequiredString = (value: unknown): string => normalizeText(String(value ?? '')) ?? '';

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

const toSqlMonth = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }
  const normalized = normalizeGlMonth(value);
  return normalized || null;
};

const hasIsFinancialColumn = async (): Promise<boolean> => {
  const { recordset = [] } = await runQuery<{ columnExists: number }>(
    `SELECT 1 AS columnExists
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = PARSENAME(@tableName, 2)
      AND TABLE_NAME = PARSENAME(@tableName, 1)
      AND COLUMN_NAME = 'IS_FINANCIAL'`,
    {
      tableName: CHART_TABLE,
    },
  );

  return recordset.length > 0;
};

export const listOperationalChartOfAccounts = async (): Promise<OperationalStatAccount[]> => {
  const includeIsFinancial = await hasIsFinancialColumn();
  if (!includeIsFinancial) {
    return [];
  }

  const { recordset = [] } = await runQuery<Record<string, unknown>>(
    `SELECT
      ACCOUNT_NUMBER AS accountNumber,
      DESCRIPTION AS description
    FROM ${CHART_TABLE}
    WHERE IS_FINANCIAL = 0
    ORDER BY ACCOUNT_NUMBER`,
  );

  return recordset.map(row => ({
    accountNumber: toRequiredString(row.accountNumber),
    description: toNullableString(row.description),
  }));
};

export const executeDispatchMiles = async (
  scac: string,
  endDate?: string | null,
): Promise<{ success: boolean; message: string }> => {
  if (!scac || !scac.trim()) {
    throw new Error('SCAC is required to execute dispatch miles calculation.');
  }

  const beginDt = '20240101';
  const endDt = endDate?.trim() || (() => {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    const year = lastMonth.getFullYear();
    const month = String(lastMonth.getMonth() + 1).padStart(2, '0');
    const day = String(lastMonth.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  })();

  await runQuery(
    `EXEC dbo.UPDATE_DISPATCH_MILES @SCAC = @scac, @BeginDt = @beginDt, @EndDt = @endDt`,
    {
      scac: scac.trim(),
      beginDt,
      endDt,
    },
  );

  return { success: true, message: 'FreightMath statistics updated successfully.' };
};

export const listClientOperationalStats = async (
  clientId: string,
  glMonth?: string | null,
): Promise<ClientOperationalStatRow[]> => {
  if (!clientId) {
    return [];
  }

  const includeIsFinancial = await hasIsFinancialColumn();
  if (!includeIsFinancial) {
    return [];
  }

  const normalizedMonth = toSqlMonth(glMonth ?? null);
  const params: Record<string, unknown> = { clientId };
  const monthClause = normalizedMonth ? 'AND gl.GL_MONTH = @glMonth' : '';
  if (normalizedMonth) {
    params.glMonth = normalizedMonth;
  }

  const result = await runQuery<{
    operation_cd?: string | null;
    gl_month?: string | null;
    account_number?: string | null;
    gl_value?: number | string | null;
  }>(
    `SELECT
      ops.OPERATION_CD as operation_cd,
      gl.GL_MONTH as gl_month,
      gl.GL_ID as account_number,
      COALESCE(gl.GL_VALUE, 0) as gl_value
    FROM ${OPERATIONS_VIEW} ops
    INNER JOIN ${GL_TABLE} gl
      ON gl.OPERATION_CD = ops.OPERATION_CD
    INNER JOIN ${CHART_TABLE} coa
      ON coa.ACCOUNT_NUMBER = gl.GL_ID
      AND coa.IS_FINANCIAL = 0
    WHERE ops.CLIENT_ID = @clientId
    ${monthClause}
    ORDER BY ops.OPERATION_CD ASC, gl.GL_MONTH ASC, gl.GL_ID ASC`,
    params,
  );

  return (result.recordset ?? []).map(row => ({
    operationCd: row.operation_cd ?? '',
    glMonth: row.gl_month ?? '',
    accountNumber: row.account_number ?? '',
    glValue: toNumber(row.gl_value),
  }));
};
