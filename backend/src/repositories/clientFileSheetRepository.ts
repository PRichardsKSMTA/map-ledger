import { runQuery } from '../utils/sqlClient';

export interface ClientFileSheetRow {
  fileUploadGuid: string;
  sheetName: string;
  isSelected?: boolean;
  firstDataRowIndex?: number;
  rowCount?: number;
  insertedDttm?: string;
  updatedDttm?: string;
  updatedBy?: string;
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

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
};

const mapSheetRow = (row: Partial<{
  fileUploadGuid: string;
  sheetName: string;
  isSelected?: number | boolean | null;
  firstDataRowIndex?: number | string | null;
  rowCount?: number | string | null;
  insertedDttm?: string | Date | null;
  updatedDttm?: string | Date | null;
  updatedBy?: string | null;
}>): ClientFileSheetRow => ({
  fileUploadGuid: row.fileUploadGuid as string,
  sheetName: row.sheetName as string,
  isSelected:
    row.isSelected === undefined || row.isSelected === null
      ? undefined
      : Boolean(row.isSelected),
  firstDataRowIndex: toNumber(row.firstDataRowIndex),
  rowCount: toNumber(row.rowCount),
  insertedDttm: parseDate(row.insertedDttm),
  updatedDttm: parseDate(row.updatedDttm),
  updatedBy: row.updatedBy ?? undefined,
});

export interface NewClientFileSheetInput {
  fileUploadGuid: string;
  sheetName: string;
  isSelected?: boolean;
  firstDataRowIndex?: number;
  rowCount?: number;
}

export const insertClientFileSheet = async (
  input: NewClientFileSheetInput
): Promise<ClientFileSheetRow> => {
  const result = await runQuery<{
    fileUploadGuid: string;
    sheetName: string;
    isSelected?: number | null;
    firstDataRowIndex?: number | null;
    rowCount?: number | null;
    insertedDttm?: string | Date | null;
  }>(
    `INSERT INTO ml.CLIENT_FILE_SHEETS (
      FILE_UPLOAD_GUID,
      SHEET_NAME,
      IS_SELECTED,
      FIRST_DATA_ROW_INDEX,
      ROW_COUNT
    )
    OUTPUT
      INSERTED.FILE_UPLOAD_GUID as fileUploadGuid,
      INSERTED.SHEET_NAME as sheetName,
      INSERTED.IS_SELECTED as isSelected,
      INSERTED.FIRST_DATA_ROW_INDEX as firstDataRowIndex,
      INSERTED.ROW_COUNT as rowCount,
      INSERTED.INSERTED_DTTM as insertedDttm
    VALUES (
      @fileUploadGuid,
      @sheetName,
      @isSelected,
      @firstDataRowIndex,
      @rowCount
    )`,
    {
      fileUploadGuid: input.fileUploadGuid,
      sheetName: input.sheetName,
      isSelected: input.isSelected ?? null,
      firstDataRowIndex:
        typeof input.firstDataRowIndex === 'number' && Number.isFinite(input.firstDataRowIndex)
          ? input.firstDataRowIndex
          : null,
      rowCount:
        typeof input.rowCount === 'number' && Number.isFinite(input.rowCount)
          ? input.rowCount
          : null,
    }
  );

  const inserted = result.recordset?.[0];

  return mapSheetRow(
    inserted ?? {
      fileUploadGuid: input.fileUploadGuid,
      sheetName: input.sheetName,
      isSelected: input.isSelected ?? null,
      firstDataRowIndex: input.firstDataRowIndex ?? null,
      rowCount: input.rowCount ?? null,
      insertedDttm: null,
    }
  );
};

export interface ClientFileSheetUpdate {
  fileUploadGuid: string;
  sheetName: string;
  isSelected?: boolean;
  firstDataRowIndex?: number;
  rowCount?: number;
  updatedBy?: string;
}

export const updateClientFileSheet = async (
  input: ClientFileSheetUpdate
): Promise<ClientFileSheetRow | null> => {
  const result = await runQuery<{
    fileUploadGuid: string;
    sheetName: string;
    isSelected?: number | null;
    firstDataRowIndex?: number | null;
    rowCount?: number | null;
    insertedDttm?: string | Date | null;
    updatedDttm?: string | Date | null;
    updatedBy?: string | null;
  }>(
    `UPDATE ml.CLIENT_FILE_SHEETS
    SET
      IS_SELECTED = @isSelected,
      FIRST_DATA_ROW_INDEX = @firstDataRowIndex,
      ROW_COUNT = @rowCount,
      UPDATED_DTTM = CURRENT_TIMESTAMP,
      UPDATED_BY = @updatedBy
    OUTPUT
      INSERTED.FILE_UPLOAD_GUID as fileUploadGuid,
      INSERTED.SHEET_NAME as sheetName,
      INSERTED.IS_SELECTED as isSelected,
      INSERTED.FIRST_DATA_ROW_INDEX as firstDataRowIndex,
      INSERTED.ROW_COUNT as rowCount,
      INSERTED.INSERTED_DTTM as insertedDttm,
      INSERTED.UPDATED_DTTM as updatedDttm,
      INSERTED.UPDATED_BY as updatedBy
    WHERE FILE_UPLOAD_GUID = @fileUploadGuid
      AND SHEET_NAME = @sheetName
      AND IS_DELETED = 0`,
    {
      fileUploadGuid: input.fileUploadGuid,
      sheetName: input.sheetName,
      isSelected: input.isSelected ?? null,
      firstDataRowIndex:
        typeof input.firstDataRowIndex === 'number' && Number.isFinite(input.firstDataRowIndex)
          ? input.firstDataRowIndex
          : null,
      rowCount:
        typeof input.rowCount === 'number' && Number.isFinite(input.rowCount)
          ? input.rowCount
          : null,
      updatedBy: input.updatedBy ?? null,
    }
  );

  const updated = result.recordset?.[0];

  return updated ? mapSheetRow(updated) : null;
};

export const softDeleteClientFileSheet = async (
  fileUploadGuid: string,
  sheetName: string,
  updatedBy?: string
): Promise<boolean> => {
  const result = await runQuery(
    `UPDATE ml.CLIENT_FILE_SHEETS
    SET IS_DELETED = 1,
        DELETED_DTTM = CURRENT_TIMESTAMP,
        UPDATED_DTTM = CURRENT_TIMESTAMP,
        UPDATED_BY = @updatedBy
    WHERE FILE_UPLOAD_GUID = @fileUploadGuid
      AND SHEET_NAME = @sheetName
      AND IS_DELETED = 0`,
    { fileUploadGuid, sheetName, updatedBy: updatedBy ?? null }
  );

  const rowsAffected = (
    result as typeof result & { rowsAffected?: number[] }
  ).rowsAffected?.[0];

  return (rowsAffected ?? 0) > 0;
};

export const listClientFileSheets = async (
  fileUploadGuid: string
): Promise<ClientFileSheetRow[]> => {
  const result = await runQuery<{
    fileUploadGuid: string;
    sheetName: string;
    isSelected?: number | boolean | null;
    firstDataRowIndex?: number | string | null;
    rowCount?: number | string | null;
    insertedDttm?: string | Date | null;
    updatedDttm?: string | Date | null;
    updatedBy?: string | null;
  }>(
    `SELECT
      FILE_UPLOAD_GUID as fileUploadGuid,
      SHEET_NAME as sheetName,
      IS_SELECTED as isSelected,
      FIRST_DATA_ROW_INDEX as firstDataRowIndex,
      ROW_COUNT as rowCount,
      INSERTED_DTTM as insertedDttm,
      UPDATED_DTTM as updatedDttm,
      UPDATED_BY as updatedBy
    FROM ml.CLIENT_FILE_SHEETS
    WHERE FILE_UPLOAD_GUID = @fileUploadGuid
      AND IS_DELETED = 0`,
    { fileUploadGuid }
  );

  return (result.recordset ?? []).map(mapSheetRow);
};
