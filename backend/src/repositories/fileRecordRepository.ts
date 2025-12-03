import { runQuery } from '../utils/sqlClient';

export interface FileRecordInput {
  accountId: string;
  accountName: string;
  activityAmount: number;
  entityId?: string | null;
  entityName?: string | null;
  glMonth?: string | null;
  sourceSheet?: string | null;
  sourceRowNumber?: number | null;
  openingBalance?: number | null;
  closingBalance?: number | null;
  userDefined1?: string | null;
  userDefined2?: string | null;
  userDefined3?: string | null;
}

export interface FileRecordRow extends FileRecordInput {
  recordId: number;
  fileUploadId: number;
  fileUploadGuid: string;
  insertedDttm?: string | null;
}

const TABLE_NAME = 'ml.FILE_RECORDS';

export const insertFileRecords = async (
  fileUploadId: number,
  fileUploadGuid: string,
  records: FileRecordInput[],
): Promise<FileRecordRow[]> => {
  if (!fileUploadId || !fileUploadGuid || fileUploadGuid.length !== 36 || records.length === 0) {
    return [];
  }

  const params: Record<string, unknown> = { fileUploadId, fileUploadGuid };
  const valuesClause = records
    .map((record, index) => {
      params[`accountId${index}`] = record.accountId;
      params[`accountName${index}`] = record.accountName;
      params[`activityAmount${index}`] = record.activityAmount;
      params[`openingBalance${index}`] = record.openingBalance ?? null;
      params[`closingBalance${index}`] = record.closingBalance ?? null;
      params[`entityId${index}`] = record.entityId ?? null;
      params[`entityName${index}`] = record.entityName ?? null;
      params[`glMonth${index}`] = record.glMonth ?? null;
      params[`sourceSheetName${index}`] = record.sourceSheet ?? null;
      params[`sourceRowNumber${index}`] = record.sourceRowNumber ?? null;
      params[`userDefined1_${index}`] = record.userDefined1 ?? null;
      params[`userDefined2_${index}`] = record.userDefined2 ?? null;
      params[`userDefined3_${index}`] = record.userDefined3 ?? null;

      return `(@fileUploadId, @fileUploadGuid, @sourceSheetName${index}, @sourceRowNumber${index}, @entityId${index}, @entityName${index}, @accountId${index}, @accountName${index}, @openingBalance${index}, @closingBalance${index}, @activityAmount${index}, @glMonth${index}, @userDefined1_${index}, @userDefined2_${index}, @userDefined3_${index})`;
    })
    .join(', ');

  const insertResult = await runQuery<{ record_id: number; inserted_dttm?: string | Date | null }>(
    `INSERT INTO ${TABLE_NAME} (
      FILE_UPLOAD_ID,
      FILE_UPLOAD_GUID,
      SOURCE_SHEET_NAME,
      SOURCE_ROW_NUMBER,
      ENTITY_ID,
      ENTITY_NAME,
      ACCOUNT_ID,
      ACCOUNT_NAME,
      OPENING_BALANCE,
      CLOSING_BALANCE,
      ACTIVITY_AMOUNT,
      GL_MONTH,
      USER_DEFINED1,
      USER_DEFINED2,
      USER_DEFINED3,
      INSERTED_DTTM,
      UPDATED_DTTM,
      UPDATED_BY
    )
    OUTPUT INSERTED.RECORD_ID as record_id, INSERTED.INSERTED_DTTM as inserted_dttm
    VALUES ${valuesClause}`,
    params,
  );

  const insertedRecords = insertResult.recordset ?? [];

  return records.map((record, index) => {
    const insertedRecordId = insertedRecords[index]?.record_id;

    if (insertedRecordId === undefined) {
      throw new Error('Failed to insert all file records');
    }

    return {
      ...record,
      recordId: insertedRecordId,
      fileUploadId,
      fileUploadGuid,
      insertedDttm:
        insertedRecords[index]?.inserted_dttm instanceof Date
          ? insertedRecords[index]?.inserted_dttm.toISOString()
          : insertedRecords[index]?.inserted_dttm ?? undefined,
    };
  });
};

export const listFileRecords = async (
  fileUploadId?: number,
  fileUploadGuid?: string,
): Promise<FileRecordRow[]> => {
  if (!fileUploadId && !fileUploadGuid) {
    return [];
  }

  const params: Record<string, unknown> = {};
  const conditions: string[] = [];
  if (fileUploadId) {
    params.fileUploadId = fileUploadId;
    conditions.push('FILE_UPLOAD_ID = @fileUploadId');
  }
  if (fileUploadGuid) {
    params.fileUploadGuid = fileUploadGuid;
    conditions.push('FILE_UPLOAD_GUID = @fileUploadGuid');
  }

  const whereClause = `WHERE ${conditions.join(' OR ')}`;

  const result = await runQuery<{
    file_upload_id: number;
    file_upload_guid: string;
    record_id: number;
    source_sheet_name?: string | null;
    source_row_number?: number | null;
    entity_id?: string | null;
    entity_name?: string | null;
    account_id: string;
    account_name: string;
    opening_balance?: number | null;
    closing_balance?: number | null;
    activity_amount: number;
    gl_month?: string | null;
    user_defined1?: string | null;
    user_defined2?: string | number | null;
    user_defined3?: string | null;
    inserted_dttm?: Date | string | null;
  }>(
    `SELECT
      FILE_UPLOAD_ID as file_upload_id,
      FILE_UPLOAD_GUID as file_upload_guid,
      RECORD_ID as record_id,
      SOURCE_SHEET_NAME as source_sheet_name,
      SOURCE_ROW_NUMBER as source_row_number,
      ENTITY_ID as entity_id,
      ENTITY_NAME as entity_name,
      ACCOUNT_ID as account_id,
      ACCOUNT_NAME as account_name,
      OPENING_BALANCE as opening_balance,
      CLOSING_BALANCE as closing_balance,
      ACTIVITY_AMOUNT as activity_amount,
      GL_MONTH as gl_month,
      USER_DEFINED1 as user_defined1,
      USER_DEFINED2 as user_defined2,
      USER_DEFINED3 as user_defined3,
      INSERTED_DTTM as inserted_dttm
    FROM ${TABLE_NAME}
    ${whereClause}
    ORDER BY SOURCE_SHEET_NAME ASC, RECORD_ID ASC`,
    params,
  );

  return (result.recordset ?? []).map((row) => ({
    fileUploadId: row.file_upload_id,
    fileUploadGuid: row.file_upload_guid,
    recordId: row.record_id,
    sourceSheet: row.source_sheet_name ?? undefined,
    sourceRowNumber: row.source_row_number ?? undefined,
    entityId: row.entity_id ?? undefined,
    entityName: row.entity_name ?? undefined,
    accountId: row.account_id,
    accountName: row.account_name,
    openingBalance: row.opening_balance ?? undefined,
    closingBalance: row.closing_balance ?? undefined,
    activityAmount: row.activity_amount,
    glMonth: row.gl_month ?? undefined,
    userDefined1: row.user_defined1 ?? undefined,
    userDefined2:
      row.user_defined2 !== undefined && row.user_defined2 !== null
        ? String(row.user_defined2)
        : undefined,
    userDefined3: row.user_defined3 ?? undefined,
    insertedDttm:
      row.inserted_dttm instanceof Date
        ? row.inserted_dttm.toISOString()
        : row.inserted_dttm ?? undefined,
  }));
};
