import { runQuery } from '../utils/sqlClient';

export type ImportStatus = 'completed' | 'failed';

export interface ClientFileSheet {
  sheetName: string;
  glMonth?: string;
  rowCount: number;
}

export interface ClientFileEntity {
  entityName: string;
  rowCount: number;
}

export interface ClientFileRecord {
  id: string;
  clientId: string;
  userId: string;
  uploadedBy: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  status: ImportStatus;
  period: string;
  rowCount?: number;
  timestamp?: string;
  sheets?: ClientFileSheet[];
  entities?: ClientFileEntity[];
}

interface RawClientFileRow {
  fileId: string;
  clientId: string;
  userId: string;
  uploadedBy: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  status: ImportStatus;
  period: string;
  rowCount?: number;
  uploadedAt: string;
}

const parseDate = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return undefined;
};

const mapClientFileRow = (row: RawClientFileRow): ClientFileRecord => ({
  id: row.fileId,
  clientId: row.clientId,
  userId: row.userId,
  uploadedBy: row.uploadedBy,
  fileName: row.fileName,
  fileSize: row.fileSize,
  fileType: row.fileType,
  status: row.status,
  period: row.period,
  rowCount: row.rowCount,
  timestamp: parseDate(row.uploadedAt) ?? row.uploadedAt,
});

export const saveClientFileMetadata = async (
  record: ClientFileRecord
): Promise<ClientFileRecord> => {
  await runQuery(
    `INSERT INTO ml.CLIENT_FILES (
      FILE_ID,
      CLIENT_ID,
      USER_ID,
      UPLOADED_BY,
      FILE_NAME,
      FILE_SIZE,
      FILE_TYPE,
      STATUS,
      PERIOD,
      ROW_COUNT,
      UPLOADED_AT
    )
    VALUES (
      @fileId,
      @clientId,
      @userId,
      @uploadedBy,
      @fileName,
      @fileSize,
      @fileType,
      @status,
      @period,
      @rowCount,
      SYSUTCDATETIME()
    )`,
    {
      fileId: record.id,
      clientId: record.clientId,
      userId: record.userId,
      uploadedBy: record.uploadedBy,
      fileName: record.fileName,
      fileSize: record.fileSize,
      fileType: record.fileType,
      status: record.status,
      period: record.period,
      rowCount: record.rowCount ?? null,
    }
  );

  if (Array.isArray(record.sheets) && record.sheets.length > 0) {
    const values = record.sheets
      .map(
        (_sheet, index) =>
          `(@fileId, @sheetName${index}, @glMonth${index}, @sheetRowCount${index})`
      )
      .join(', ');

    const params: Record<string, unknown> = { fileId: record.id };
    record.sheets.forEach((sheet, index) => {
      params[`sheetName${index}`] = sheet.sheetName;
      params[`glMonth${index}`] = sheet.glMonth ?? null;
      params[`sheetRowCount${index}`] = sheet.rowCount;
    });

    await runQuery(
      `INSERT INTO ml.CLIENT_FILE_SHEETS (FILE_ID, SHEET_NAME, GL_MONTH, ROW_COUNT)
      VALUES ${values}`,
      params
    );
  }

  if (Array.isArray(record.entities) && record.entities.length > 0) {
    const values = record.entities
      .map(
        (_entity, index) =>
          `(@fileId, @entityName${index}, @entityRowCount${index})`
      )
      .join(', ');

    const params: Record<string, unknown> = { fileId: record.id };
    record.entities.forEach((entity, index) => {
      params[`entityName${index}`] = entity.entityName;
      params[`entityRowCount${index}`] = entity.rowCount;
    });

    await runQuery(
      `INSERT INTO ml.CLIENT_FILE_ENTITIES (FILE_ID, ENTITY_NAME, ROW_COUNT)
      VALUES ${values}`,
      params
    );
  }

  return record;
};

const buildWhereClause = (
  userId?: string,
  clientId?: string
): { clause: string; parameters: Record<string, unknown> } => {
  const conditions: string[] = [];
  const parameters: Record<string, unknown> = {};

  if (userId) {
    conditions.push('cf.USER_ID = @userId');
    parameters.userId = userId;
  }

  if (clientId) {
    conditions.push('cf.CLIENT_ID = @clientId');
    parameters.clientId = clientId;
  }

  const clause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { clause, parameters };
};

export interface ClientFileHistoryResult {
  items: ClientFileRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export const listClientFiles = async (
  userId: string | undefined,
  clientId: string | undefined,
  page: number,
  pageSize: number
): Promise<ClientFileHistoryResult> => {
  const { clause, parameters } = buildWhereClause(userId, clientId);
  const offset = Math.max(page - 1, 0) * pageSize;

  const totalResult = await runQuery<{ total: number }>(
    `SELECT COUNT(*) as total FROM ml.CLIENT_FILES cf ${clause}`,
    parameters
  );

  const total = totalResult.recordset?.[0]?.total ?? 0;

  if (total === 0) {
    return { items: [], total: 0, page, pageSize };
  }

  const filesResult = await runQuery<RawClientFileRow>(
    `SELECT
      cf.FILE_ID as fileId,
      cf.CLIENT_ID as clientId,
      cf.USER_ID as userId,
      cf.UPLOADED_BY as uploadedBy,
      cf.FILE_NAME as fileName,
      cf.FILE_SIZE as fileSize,
      cf.FILE_TYPE as fileType,
      cf.STATUS as status,
      cf.PERIOD as period,
      cf.ROW_COUNT as rowCount,
      cf.UPLOADED_AT as uploadedAt
    FROM ml.CLIENT_FILES cf
    ${clause}
    ORDER BY cf.UPLOADED_AT DESC
    OFFSET @offset ROWS
    FETCH NEXT @pageSize ROWS ONLY`,
    { ...parameters, offset, pageSize }
  );

  const items = (filesResult.recordset ?? []).map(mapClientFileRow);
  const fileIds = items.map((item) => item.id);

  if (fileIds.length === 0) {
    return { items, total, page, pageSize };
  }

  const sheetParameters: Record<string, unknown> = {};
  const sheetPlaceholders = fileIds
    .map((id, index) => {
      const key = `sheetFileId${index}`;
      sheetParameters[key] = id;
      return `@${key}`;
    })
    .join(', ');

  const sheetsResult = await runQuery<{
    fileId: string;
    sheetName: string;
    glMonth?: string;
    rowCount: number;
  }>(
    `SELECT FILE_ID as fileId, SHEET_NAME as sheetName, GL_MONTH as glMonth, ROW_COUNT as rowCount
    FROM ml.CLIENT_FILE_SHEETS
    WHERE FILE_ID IN (${sheetPlaceholders})`,
    sheetParameters
  );

  const sheetsByFile = new Map<string, ClientFileSheet[]>();
  (sheetsResult.recordset ?? []).forEach((sheet) => {
    const existing = sheetsByFile.get(sheet.fileId) ?? [];
    existing.push({
      sheetName: sheet.sheetName,
      glMonth: sheet.glMonth ?? undefined,
      rowCount: sheet.rowCount,
    });
    sheetsByFile.set(sheet.fileId, existing);
  });

  const entityParameters: Record<string, unknown> = {};
  const entityPlaceholders = fileIds
    .map((id, index) => {
      const key = `entityFileId${index}`;
      entityParameters[key] = id;
      return `@${key}`;
    })
    .join(', ');

  const entitiesResult = await runQuery<{
    fileId: string;
    entityName: string;
    rowCount: number;
  }>(
    `SELECT FILE_ID as fileId, ENTITY_NAME as entityName, ROW_COUNT as rowCount
    FROM ml.CLIENT_FILE_ENTITIES
    WHERE FILE_ID IN (${entityPlaceholders})`,
    entityParameters
  );

  const entitiesByFile = new Map<string, ClientFileEntity[]>();
  (entitiesResult.recordset ?? []).forEach((entity) => {
    const existing = entitiesByFile.get(entity.fileId) ?? [];
    existing.push({
      entityName: entity.entityName,
      rowCount: entity.rowCount,
    });
    entitiesByFile.set(entity.fileId, existing);
  });

  const enrichedItems = items.map((item) => ({
    ...item,
    sheets: sheetsByFile.get(item.id) ?? [],
    entities: entitiesByFile.get(item.id) ?? [],
  }));

  return { items: enrichedItems, total, page, pageSize };
};
