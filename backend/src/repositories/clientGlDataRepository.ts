import { normalizeGlMonth } from '../utils/glMonth';
import { runQuery } from '../utils/sqlClient';

export interface ClientGlDataInput {
  operationCd: string;
  glId: string;
  glMonth: string;
  glValue: number;
}

export interface ClientOperation {
  operationCd: string;
  operationName: string | null;
}

const TABLE_NAME = 'ml.CLIENT_GL_DATA';
const OPERATIONS_VIEW = 'ML.V_CLIENT_OPERATIONS';
const CHART_TABLE = 'ML.CHART_OF_ACCOUNTS';
const FILE_RECORDS_TABLE = 'ML.FILE_RECORDS';
const CLIENT_FILES_TABLE = 'ML.CLIENT_FILES';
const MAX_ENTRIES_PER_BATCH = 500;

const normalizeText = (value?: string | number | Date | null): string | null => {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : null;
  }
  if (value instanceof Date) {
    // Convert Date to YYYY-MM-01 format for GL months
    if (Number.isNaN(value.getTime())) {
      return null;
    }
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toSqlMonth = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }
  const normalized = normalizeGlMonth(value);
  return normalized || null;
};

const normalizeOperationCode = (value?: string | null): string | null => {
  const normalized = normalizeText(value);
  return normalized ? normalized.toUpperCase() : null;
};

const sanitizeClientGlData = (
  entries: ClientGlDataInput[],
): ClientGlDataInput[] => {
  return entries
    .map(entry => {
      const operationCd = normalizeOperationCode(entry.operationCd);
      const glId = normalizeText(entry.glId);
      const glMonth = toSqlMonth(entry.glMonth);
      const glValue = Number.isFinite(entry.glValue) ? entry.glValue : NaN;
      if (!operationCd || !glId || !glMonth || !Number.isFinite(glValue)) {
        return null;
      }
      return {
        operationCd,
        glId,
        glMonth,
        glValue,
      };
    })
    .filter((entry): entry is ClientGlDataInput => Boolean(entry));
};

const collectUniqueGlIds = (
  entries: ClientGlDataInput[],
  allGlIds: string[],
  excludedGlIds: Set<string>,
): string[] => {
  const unique = new Set<string>();
  const glIds: string[] = [];

  const addGlId = (value?: string | null) => {
    const normalized = normalizeText(value);
    if (!normalized || excludedGlIds.has(normalized) || unique.has(normalized)) {
      return;
    }
    unique.add(normalized);
    glIds.push(normalized);
  };

  allGlIds.forEach(addGlId);
  entries.forEach(entry => addGlId(entry.glId));

  return glIds;
};

const expandClientGlDataEntries = (
  entries: ClientGlDataInput[],
  allGlIds: string[],
  excludedGlIds: Set<string>,
): ClientGlDataInput[] => {
  if (!entries.length) {
    return entries;
  }

  const glIds = collectUniqueGlIds(entries, allGlIds, excludedGlIds);
  if (!glIds.length) {
    return entries;
  }

  const entryMap = new Map<string, ClientGlDataInput>();
  const operationMonths = new Map<string, { operationCd: string; glMonth: string }>();

  entries.forEach(entry => {
    const key = `${entry.operationCd}|||${entry.glMonth}|||${entry.glId}`;
    const existing = entryMap.get(key);
    if (existing) {
      existing.glValue += entry.glValue;
    } else {
      entryMap.set(key, { ...entry });
    }

    const operationMonthKey = `${entry.operationCd}|||${entry.glMonth}`;
    if (!operationMonths.has(operationMonthKey)) {
      operationMonths.set(operationMonthKey, {
        operationCd: entry.operationCd,
        glMonth: entry.glMonth,
      });
    }
  });

  const expanded: ClientGlDataInput[] = [];
  operationMonths.forEach(({ operationCd, glMonth }) => {
    glIds.forEach(glId => {
      const key = `${operationCd}|||${glMonth}|||${glId}`;
      const existing = entryMap.get(key);
      expanded.push(
        existing ?? {
          operationCd,
          glId,
          glMonth,
          glValue: 0,
        },
      );
    });
  });

  return expanded;
};

const deleteClientGlDataForKeys = async (
  entries: ClientGlDataInput[],
): Promise<void> => {
  const uniqueKeys = new Map<string, ClientGlDataInput>();
  entries.forEach(entry => {
    const key = `${entry.operationCd}|||${entry.glId}|||${entry.glMonth}`;
    if (!uniqueKeys.has(key)) {
      uniqueKeys.set(key, entry);
    }
  });

  if (!uniqueKeys.size) {
    return;
  }

  const params: Record<string, unknown> = {};
  const clauses = Array.from(uniqueKeys.values())
    .map((entry, index) => {
      params[`operationCdDelete${index}`] = entry.operationCd;
      params[`glIdDelete${index}`] = entry.glId;
      params[`glMonthDelete${index}`] = entry.glMonth;
      return `(OPERATION_CD = @operationCdDelete${index} AND GL_ID = @glIdDelete${index} AND GL_MONTH = @glMonthDelete${index})`;
    })
    .join(' OR ');

  if (!clauses) {
    return;
  }

  await runQuery(`DELETE FROM ${TABLE_NAME} WHERE ${clauses}`, params);
};

const insertClientGlDataBatch = async (
  entries: ClientGlDataInput[],
): Promise<void> => {
  if (!entries.length) {
    return;
  }

  const params: Record<string, unknown> = {};
  const valuesClause = entries
    .map((entry, index) => {
      params[`operationCd${index}`] = entry.operationCd;
      params[`glId${index}`] = entry.glId;
      params[`glMonth${index}`] = entry.glMonth;
      params[`glValue${index}`] = entry.glValue;
      return `(@operationCd${index}, @glId${index}, @glMonth${index}, @glValue${index})`;
    })
    .join(', ');

  await runQuery(
    `INSERT INTO ${TABLE_NAME} (
      OPERATION_CD,
      GL_ID,
      GL_MONTH,
      GL_VALUE
    )
    VALUES ${valuesClause}`,
    params,
  );
};

const chunkEntries = (
  entries: ClientGlDataInput[],
  size: number,
): ClientGlDataInput[][] => {
  if (entries.length <= size) {
    return [entries];
  }

  const chunks: ClientGlDataInput[][] = [];
  for (let index = 0; index < entries.length; index += size) {
    chunks.push(entries.slice(index, index + size));
  }
  return chunks;
};

export const replaceClientGlData = async (
  entries: ClientGlDataInput[],
  options?: {
    allGlIds?: string[];
    excludedGlIds?: string[];
  },
): Promise<void> => {
  const normalized = sanitizeClientGlData(entries);
  if (!normalized.length) {
    return;
  }

  const excludedGlIds = new Set<string>(
    (options?.excludedGlIds ?? []).map(value => normalizeText(value)).filter(Boolean) as string[],
  );
  const filtered = normalized.filter(entry => !excludedGlIds.has(entry.glId));
  if (!filtered.length) {
    return;
  }

  const expanded = expandClientGlDataEntries(
    filtered,
    options?.allGlIds ?? [],
    excludedGlIds,
  );
  const payload = expanded.length ? expanded : filtered;

  const batches = chunkEntries(payload, MAX_ENTRIES_PER_BATCH);
  for (const batch of batches) {
    await deleteClientGlDataForKeys(batch);
    await insertClientGlDataBatch(batch);
  }
};

/**
 * List all operations for a client from the V_CLIENT_OPERATIONS view.
 */
export const listClientOperations = async (
  clientId: string,
): Promise<ClientOperation[]> => {
  const normalizedClientId = normalizeText(clientId);
  if (!normalizedClientId) {
    return [];
  }

  const result = await runQuery<{
    operation_cd?: string | null;
    operation_name?: string | null;
  }>(
    `SELECT DISTINCT
      OPERATION_CD as operation_cd,
      OPERATION_NAME as operation_name
    FROM ${OPERATIONS_VIEW}
    WHERE CLIENT_ID = @clientId
    ORDER BY OPERATION_CD`,
    { clientId: normalizedClientId },
  );

  return (result.recordset ?? [])
    .map(row => ({
      operationCd: normalizeText(row.operation_cd) ?? '',
      operationName: normalizeText(row.operation_name),
    }))
    .filter(op => op.operationCd.length > 0);
};

/**
 * Get distinct GL months from file records for a client.
 */
export const listClientGlMonths = async (
  clientId: string,
): Promise<string[]> => {
  const normalizedClientId = normalizeText(clientId);
  if (!normalizedClientId) {
    return [];
  }

  const result = await runQuery<{ gl_month?: string | Date | null }>(
    `SELECT DISTINCT fr.GL_MONTH as gl_month
    FROM ${FILE_RECORDS_TABLE} fr
    INNER JOIN ${CLIENT_FILES_TABLE} cf ON cf.FILE_UPLOAD_GUID = fr.FILE_UPLOAD_GUID
    WHERE cf.CLIENT_ID = @clientId
      AND cf.IS_DELETED = 0
      AND fr.GL_MONTH IS NOT NULL
    ORDER BY fr.GL_MONTH`,
    { clientId: normalizedClientId },
  );

  return (result.recordset ?? [])
    .map(row => normalizeText(row.gl_month))
    .filter((month): month is string => month !== null);
};

/**
 * Get all chart of accounts IDs.
 */
export const listAllChartOfAccountIds = async (): Promise<string[]> => {
  const result = await runQuery<{ account_number?: string | null }>(
    `SELECT ACCOUNT_NUMBER as account_number
    FROM ${CHART_TABLE}
    ORDER BY ACCOUNT_NUMBER`,
  );

  const accounts = (result.recordset ?? [])
    .map(row => normalizeText(row.account_number))
    .filter((account): account is string => account !== null);

  // Deduplicate
  const seen = new Set<string>();
  const unique: string[] = [];
  accounts.forEach(account => {
    if (!seen.has(account)) {
      seen.add(account);
      unique.push(account);
    }
  });

  return unique;
};

/**
 * Initialize CLIENT_GL_DATA records for all combinations of:
 * - Chart of accounts accounts
 * - GL months detected from file records
 * - Client operations
 *
 * Records are created with GL_VALUE = 0 and only if they don't already exist.
 * This ensures the table is pre-populated for operational statistics storage.
 */
export const initializeClientGlData = async (
  clientId: string,
  glMonths?: string[],
): Promise<{ created: number; skipped: number }> => {
  const normalizedClientId = normalizeText(clientId);
  if (!normalizedClientId) {
    return { created: 0, skipped: 0 };
  }

  // Fetch all required data in parallel
  const [operations, detectedGlMonths, chartOfAccountIds] = await Promise.all([
    listClientOperations(normalizedClientId),
    glMonths && glMonths.length > 0
      ? Promise.resolve(glMonths.map(m => normalizeGlMonth(m)).filter((m): m is string => m !== null))
      : listClientGlMonths(normalizedClientId),
    listAllChartOfAccountIds(),
  ]);

  if (operations.length === 0 || detectedGlMonths.length === 0 || chartOfAccountIds.length === 0) {
    return { created: 0, skipped: 0 };
  }

  // Build all possible combinations
  const allEntries: ClientGlDataInput[] = [];
  for (const operation of operations) {
    for (const glMonth of detectedGlMonths) {
      for (const glId of chartOfAccountIds) {
        allEntries.push({
          operationCd: operation.operationCd,
          glId,
          glMonth,
          glValue: 0,
        });
      }
    }
  }

  if (allEntries.length === 0) {
    return { created: 0, skipped: 0 };
  }

  // Insert only records that don't already exist
  let created = 0;
  let skipped = 0;

  const batches = chunkEntries(allEntries, MAX_ENTRIES_PER_BATCH);
  for (const batch of batches) {
    const result = await insertClientGlDataIfNotExists(batch);
    created += result.created;
    skipped += result.skipped;
  }

  return { created, skipped };
};

/**
 * Insert CLIENT_GL_DATA records only if they don't already exist.
 * Uses MERGE to avoid duplicate key errors.
 */
const insertClientGlDataIfNotExists = async (
  entries: ClientGlDataInput[],
): Promise<{ created: number; skipped: number }> => {
  if (!entries.length) {
    return { created: 0, skipped: 0 };
  }

  const normalized = sanitizeClientGlData(entries);
  if (!normalized.length) {
    return { created: 0, skipped: 0 };
  }

  const params: Record<string, unknown> = {};
  const valuesClause = normalized
    .map((entry, index) => {
      params[`operationCd${index}`] = entry.operationCd;
      params[`glId${index}`] = entry.glId;
      params[`glMonth${index}`] = entry.glMonth;
      params[`glValue${index}`] = entry.glValue;
      return `(@operationCd${index}, @glId${index}, @glMonth${index}, @glValue${index})`;
    })
    .join(', ');

  // Use MERGE to insert only non-existing records
  const result = await runQuery<{ action_type: string }>(
    `MERGE INTO ${TABLE_NAME} AS target
    USING (VALUES ${valuesClause}) AS source (OPERATION_CD, GL_ID, GL_MONTH, GL_VALUE)
    ON target.OPERATION_CD = source.OPERATION_CD
      AND target.GL_ID = source.GL_ID
      AND target.GL_MONTH = source.GL_MONTH
    WHEN NOT MATCHED THEN
      INSERT (OPERATION_CD, GL_ID, GL_MONTH, GL_VALUE)
      VALUES (source.OPERATION_CD, source.GL_ID, source.GL_MONTH, source.GL_VALUE)
    OUTPUT $action AS action_type;`,
    params,
  );

  const actions = result.recordset ?? [];
  const created = actions.filter(a => a.action_type === 'INSERT').length;
  const skipped = normalized.length - created;

  return { created, skipped };
};

/**
 * Backfill CLIENT_GL_DATA for all clients that have file records.
 * This is meant to be run as a one-time migration or maintenance task.
 */
export const backfillClientGlData = async (): Promise<{
  clients: { clientId: string; created: number; skipped: number }[];
  totalCreated: number;
  totalSkipped: number;
}> => {
  // Get all unique client IDs that have file records
  const clientsResult = await runQuery<{ client_id?: string | number | null }>(
    `SELECT DISTINCT cf.CLIENT_ID as client_id
    FROM ${CLIENT_FILES_TABLE} cf
    INNER JOIN ${FILE_RECORDS_TABLE} fr ON fr.FILE_UPLOAD_GUID = cf.FILE_UPLOAD_GUID
    WHERE cf.IS_DELETED = 0
      AND fr.GL_MONTH IS NOT NULL
    ORDER BY cf.CLIENT_ID`,
  );

  const clientIds = (clientsResult.recordset ?? [])
    .map(row => normalizeText(row.client_id))
    .filter((id): id is string => id !== null);

  const results: { clientId: string; created: number; skipped: number }[] = [];
  let totalCreated = 0;
  let totalSkipped = 0;

  for (const clientId of clientIds) {
    const result = await initializeClientGlData(clientId);
    results.push({ clientId, ...result });
    totalCreated += result.created;
    totalSkipped += result.skipped;
  }

  return { clients: results, totalCreated, totalSkipped };
};
