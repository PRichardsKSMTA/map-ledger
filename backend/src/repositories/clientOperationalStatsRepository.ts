import { normalizeGlMonth } from '../utils/glMonth';
import { runQuery } from '../utils/sqlClient';

export interface OperationalStatAccount {
  accountNumber: string;
  description: string | null;
  isSurvey: boolean;
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
const CLIENT_OPERATION_CODES_TABLE = 'dbo.CLIENT_OPERATION_CODES';

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
      DESCRIPTION AS description,
      COALESCE(IS_SURVEY, 0) AS isSurvey
    FROM ${CHART_TABLE}
    WHERE IS_FINANCIAL = 0
    ORDER BY ACCOUNT_NUMBER`,
  );

  return recordset.map(row => ({
    accountNumber: toRequiredString(row.accountNumber),
    description: toNullableString(row.description),
    isSurvey: row.isSurvey === 1 || row.isSurvey === true,
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

  // Fire and forget - start the stored procedure but don't wait for it to complete.
  // This prevents timeout issues since the SP can take a while to run.
  runQuery(
    `EXEC dbo.UPDATE_DISPATCH_MILES @SCAC = @scac, @BeginDt = @beginDt, @EndDt = @endDt`,
    {
      scac: scac.trim(),
      beginDt,
      endDt,
    },
  ).catch((error) => {
    // Log but don't throw - this runs in the background
    console.error('[executeDispatchMiles] Stored procedure failed:', error);
  });

  return { success: true, message: 'FreightMath statistics update started.' };
};

export interface FMStatisticsCheckResult {
  hasFMStatistics: boolean;
  mostRecentPeriod: string | null;
  nonSurveyAccountsWithData: number;
  totalNonSurveyAccounts: number;
}

/**
 * Checks if a client has FM (FreightMath) statistics.
 * FM statistics are operational accounts that are NOT financial (IS_FINANCIAL = 0)
 * and NOT survey accounts (IS_SURVEY = 0).
 * These are populated by the UPDATE_DISPATCH_MILES stored procedure.
 *
 * Uses CLIENT_SCAC to identify the client's data via CLIENT_OPERATION_CODES.
 */
export const checkClientFMStatistics = async (
  clientScac: string,
): Promise<FMStatisticsCheckResult> => {
  if (!clientScac || !clientScac.trim()) {
    return {
      hasFMStatistics: false,
      mostRecentPeriod: null,
      nonSurveyAccountsWithData: 0,
      totalNonSurveyAccounts: 0,
    };
  }

  const scac = clientScac.trim();

  // Simple query: check if there's ANY non-zero value for non-financial, non-survey accounts
  // for this client's SCAC. Uses EXISTS for fast short-circuit evaluation.
  const result = await runQuery<{
    has_data: number;
  }>(
    `SELECT CASE WHEN EXISTS (
      SELECT 1
      FROM ${GL_TABLE} gl
      INNER JOIN ${CLIENT_OPERATION_CODES_TABLE} coc ON coc.OPERATION_CD = gl.OPERATION_CD
      INNER JOIN ${CHART_TABLE} coa ON coa.ACCOUNT_NUMBER = gl.GL_ID
      WHERE coc.CLIENT_SCAC = @scac
        AND coa.IS_FINANCIAL = 0
        AND coa.IS_SURVEY = 0
        AND gl.GL_VALUE IS NOT NULL
        AND gl.GL_VALUE != 0
    ) THEN 1 ELSE 0 END as has_data`,
    { scac },
  );

  const hasData = (result.recordset?.[0]?.has_data ?? 0) === 1;

  return {
    hasFMStatistics: hasData,
    mostRecentPeriod: null,
    nonSurveyAccountsWithData: hasData ? 1 : 0,
    totalNonSurveyAccounts: 0,
  };
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
