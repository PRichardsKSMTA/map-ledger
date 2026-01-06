import { normalizeGlMonth } from '../utils/glMonth';
import { runQuery } from '../utils/sqlClient';

export interface ClientGlDataInput {
  operationCd: string;
  glId: string;
  glMonth: string;
  glValue: number;
}

const TABLE_NAME = 'ml.CLIENT_GL_DATA';
const MAX_ENTRIES_PER_BATCH = 500;

const normalizeText = (value?: string | null): string | null => {
  if (value === undefined || value === null) {
    return null;
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
