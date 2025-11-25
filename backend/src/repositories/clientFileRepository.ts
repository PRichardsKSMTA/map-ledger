import crypto from 'crypto';
import { runQuery } from '../utils/sqlClient';

export type ImportStatus = 'completed' | 'failed' | string;

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
  userId?: string;
  uploadedBy?: string;
  importedBy?: string;
  fileName: string;
  fileStorageUri: string;
  fileSize?: number;
  fileType?: string;
  status: ImportStatus;
  period: string;
  glPeriodStart?: string;
  glPeriodEnd?: string;
  rowCount?: number;
  timestamp: string;
  sheets?: ClientFileSheet[];
  entities?: ClientFileEntity[];
}

export interface NewClientFileRecord {
  clientId: string;
  userId?: string;
  uploadedBy?: string;
  sourceFileName: string;
  fileStorageUri: string;
  fileSize?: number;
  fileType?: string;
  status: ImportStatus;
  glPeriodStart?: string;
  glPeriodEnd?: string;
  rowCount?: number;
  lastStepCompletedDttm?: string;
  sheets?: ClientFileSheet[];
  entities?: ClientFileEntity[];
}

interface RawClientFileRow {
  fileUploadId: string;
  clientId: string;
  userId?: string;
  uploadedBy?: string;
  sourceFileName: string;
  fileStorageUri: string;
  fileSize?: number;
  fileType?: string;
  fileStatus: ImportStatus;
  glPeriodStart?: string;
  glPeriodEnd?: string;
  rowCount?: number;
  lastStepCompletedDttm?: string | Date;
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

const buildPeriodLabel = (
  start?: string,
  end?: string
): string => {
  if (start && end) {
    return `${start} - ${end}`;
  }

  if (start) {
    return start;
  }

  if (end) {
    return end;
  }

  return '';
};

const mapClientFileRow = (row: RawClientFileRow): ClientFileRecord => {
  const timestamp =
    parseDate(row.lastStepCompletedDttm) ??
    (row.lastStepCompletedDttm ? String(row.lastStepCompletedDttm) : new Date().toISOString());

  return {
    id: row.fileUploadId,
    clientId: row.clientId,
    userId: row.userId,
    uploadedBy: row.uploadedBy,
    importedBy: row.uploadedBy,
    fileName: row.sourceFileName,
    fileStorageUri: row.fileStorageUri,
    fileSize: row.fileSize,
    fileType: row.fileType,
    status: row.fileStatus,
    glPeriodStart: row.glPeriodStart,
    glPeriodEnd: row.glPeriodEnd,
    period: buildPeriodLabel(row.glPeriodStart, row.glPeriodEnd),
    rowCount: row.rowCount,
    timestamp,
  };
};

export const saveClientFileMetadata = async (
  record: NewClientFileRecord
): Promise<ClientFileRecord> => {
  const fileUploadId = crypto.randomUUID();
  const lastStepCompletedDttm = record.lastStepCompletedDttm ?? new Date().toISOString();

  await runQuery(
    `INSERT INTO ml.CLIENT_FILES (
      FILE_UPLOAD_ID,
      CLIENT_ID,
      USER_ID,
      UPLOADED_BY,
      SOURCE_FILE_NAME,
      FILE_STORAGE_URI,
      FILE_SIZE,
      FILE_TYPE,
      FILE_STATUS,
      GL_PERIOD_START,
      GL_PERIOD_END,
      ROW_COUNT,
      LAST_STEP_COMPLETED_DTTM
    )
    VALUES (
      @fileUploadId,
      @clientId,
      @userId,
      @uploadedBy,
      @sourceFileName,
      @fileStorageUri,
      @fileSize,
      @fileType,
      @fileStatus,
      @glPeriodStart,
      @glPeriodEnd,
      @rowCount,
      @lastStepCompletedDttm
    )`,
    {
      fileUploadId,
      clientId: record.clientId,
      userId: record.userId ?? null,
      uploadedBy: record.uploadedBy ?? null,
      sourceFileName: record.sourceFileName,
      fileStorageUri: record.fileStorageUri,
      fileSize: record.fileSize ?? null,
      fileType: record.fileType ?? null,
      fileStatus: record.status,
      glPeriodStart: record.glPeriodStart ?? null,
      glPeriodEnd: record.glPeriodEnd ?? null,
      rowCount: record.rowCount ?? null,
      lastStepCompletedDttm,
    }
  );

  if (Array.isArray(record.sheets) && record.sheets.length > 0) {
    const values = record.sheets
      .map(
        (_sheet, index) =>
          `(@fileUploadId, @sheetName${index}, @glMonth${index}, @sheetRowCount${index})`
      )
      .join(', ');

    const params: Record<string, unknown> = { fileUploadId };
    record.sheets.forEach((sheet, index) => {
      params[`sheetName${index}`] = sheet.sheetName;
      params[`glMonth${index}`] = sheet.glMonth ?? null;
      params[`sheetRowCount${index}`] = sheet.rowCount;
    });

    await runQuery(
      `INSERT INTO ml.CLIENT_FILE_SHEETS (FILE_UPLOAD_ID, SHEET_NAME, GL_MONTH, ROW_COUNT)
      VALUES ${values}`,
      params
    );
  }

  if (Array.isArray(record.entities) && record.entities.length > 0) {
    const values = record.entities
      .map(
        (_entity, index) =>
          `(@fileUploadId, @entityName${index}, @entityRowCount${index})`
      )
      .join(', ');

    const params: Record<string, unknown> = { fileUploadId };
    record.entities.forEach((entity, index) => {
      params[`entityName${index}`] = entity.entityName;
      params[`entityRowCount${index}`] = entity.rowCount;
    });

    await runQuery(
      `INSERT INTO ml.CLIENT_FILE_ENTITIES (FILE_UPLOAD_ID, ENTITY_NAME, ROW_COUNT)
      VALUES ${values}`,
      params
    );
  }

  return {
    id: fileUploadId,
    clientId: record.clientId,
    userId: record.userId,
    uploadedBy: record.uploadedBy,
    importedBy: record.uploadedBy,
    fileName: record.sourceFileName,
    fileStorageUri: record.fileStorageUri,
    fileSize: record.fileSize,
    fileType: record.fileType,
    status: record.status,
    glPeriodStart: record.glPeriodStart,
    glPeriodEnd: record.glPeriodEnd,
    period: buildPeriodLabel(record.glPeriodStart, record.glPeriodEnd),
    rowCount: record.rowCount,
    timestamp: lastStepCompletedDttm,
    sheets: record.sheets,
    entities: record.entities,
  };
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
      cf.FILE_UPLOAD_ID as fileUploadId,
      cf.CLIENT_ID as clientId,
      cf.USER_ID as userId,
      cf.UPLOADED_BY as uploadedBy,
      cf.SOURCE_FILE_NAME as sourceFileName,
      cf.FILE_STORAGE_URI as fileStorageUri,
      cf.FILE_SIZE as fileSize,
      cf.FILE_TYPE as fileType,
      cf.FILE_STATUS as fileStatus,
      cf.GL_PERIOD_START as glPeriodStart,
      cf.GL_PERIOD_END as glPeriodEnd,
      cf.ROW_COUNT as rowCount,
      cf.LAST_STEP_COMPLETED_DTTM as lastStepCompletedDttm
    FROM ml.CLIENT_FILES cf
    ${clause}
    ORDER BY cf.LAST_STEP_COMPLETED_DTTM DESC
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
    fileUploadId: string;
    sheetName: string;
    glMonth?: string;
    rowCount: number;
  }>(
    `SELECT FILE_UPLOAD_ID as fileUploadId, SHEET_NAME as sheetName, GL_MONTH as glMonth, ROW_COUNT as rowCount
    FROM ml.CLIENT_FILE_SHEETS
    WHERE FILE_UPLOAD_ID IN (${sheetPlaceholders})`,
    sheetParameters
  );

  const sheetsByFile = new Map<string, ClientFileSheet[]>();
  (sheetsResult.recordset ?? []).forEach((sheet) => {
    const existing = sheetsByFile.get(sheet.fileUploadId) ?? [];
    existing.push({
      sheetName: sheet.sheetName,
      glMonth: sheet.glMonth ?? undefined,
      rowCount: sheet.rowCount,
    });
    sheetsByFile.set(sheet.fileUploadId, existing);
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
    fileUploadId: string;
    entityName: string;
    rowCount: number;
  }>(
    `SELECT FILE_UPLOAD_ID as fileUploadId, ENTITY_NAME as entityName, ROW_COUNT as rowCount
    FROM ml.CLIENT_FILE_ENTITIES
    WHERE FILE_UPLOAD_ID IN (${entityPlaceholders})`,
    entityParameters
  );

  const entitiesByFile = new Map<string, ClientFileEntity[]>();
  (entitiesResult.recordset ?? []).forEach((entity) => {
    const existing = entitiesByFile.get(entity.fileUploadId) ?? [];
    existing.push({
      entityName: entity.entityName,
      rowCount: entity.rowCount,
    });
    entitiesByFile.set(entity.fileUploadId, existing);
  });

  const enrichedItems = items.map((item) => ({
    ...item,
    sheets: sheetsByFile.get(item.id) ?? [],
    entities: entitiesByFile.get(item.id) ?? [],
  }));

  return { items: enrichedItems, total, page, pageSize };
};
