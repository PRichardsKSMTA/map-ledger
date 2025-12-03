import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { json, readJson } from '../../http';
import {
  listClientFiles,
  saveClientFileMetadata,
  ClientFileEntity,
  ClientFileSheet,
  ImportStatus,
  NewClientFileRecord,
  coerceImportStatus,
} from '../../repositories/clientFileRepository';
import { getFirstStringValue } from '../../utils/requestParsers';
import { buildErrorResponse } from '../datapointConfigs/utils';

export interface ClientFileMetadataPayload {
  clientId?: string;
  id?: string;
  fileUploadGuid?: string;
  fileUploadId?: string;
  userId?: string;
  uploadedBy?: string;
  importedBy?: string;
  sourceFileName?: string;
  fileName?: string;
  fileStorageUri?: string;
  fileUri?: string;
  fileUrl?: string;
  blobUrl?: string;
  blobUri?: string;
  uploadContext?: Record<string, unknown>;
  fileSize?: number;
  fileType?: string;
  status?: ImportStatus;
  fileStatus?: ImportStatus;
  glPeriodStart?: string;
  glPeriodEnd?: string;
  period?: string;
  rowCount?: number;
  lastStepCompletedDttm?: string;
  sheets?: ClientFileSheet[];
  entities?: ClientFileEntity[];
}

const parseInteger = (value: string | null, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseBoolean = (value: unknown, defaultValue: boolean): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (['true', '1', 'yes', 'y'].includes(normalized)) {
      return true;
    }

    if (['false', '0', 'no', 'n'].includes(normalized)) {
      return false;
    }
  }

  return defaultValue;
};

const parseOptionalInteger = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined;
  }

  return undefined;
};

const parseIntegerWithDefault = (value: unknown, fallback: number): number =>
  parseOptionalInteger(value) ?? fallback;

const toOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeMonthToDate = (value?: string): string | undefined => {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  const monthMatch = /^\d{4}-(\d{2})(-\d{2})?$/.exec(trimmed);
  if (monthMatch) {
    const [year, month] = trimmed.split('-');
    const day = trimmed.split('-')[2] ?? '01';
    return `${year}-${month}-${day}`;
  }

  return trimmed;
};

const resolveFileStorageUri = (
  bag: Record<string, unknown>,
  uploadContext?: Record<string, unknown> | null
): string | undefined => {
  const directUri =
    toOptionalString(bag.fileStorageUri) ??
    toOptionalString(bag.fileUri ?? bag.fileUrl) ??
    toOptionalString(bag.blobUrl ?? bag.blobUri);

  if (directUri) {
    return directUri;
  }

  const context =
    uploadContext ??
    (bag.uploadContext && typeof bag.uploadContext === 'object'
      ? (bag.uploadContext as Record<string, unknown>)
      : null);

  if (context) {
    return (
      toOptionalString(context.fileStorageUri) ??
      toOptionalString(context.fileUri ?? context.fileUrl) ??
      toOptionalString(context.blobUrl ?? context.blobUri)
    );
  }

  return undefined;
};

export const validateRecord = (
  payload: ClientFileMetadataPayload | unknown
): { record: NewClientFileRecord | null; errors: string[] } => {
  if (!payload || typeof payload !== 'object') {
    return { record: null, errors: ['Payload is not an object'] };
  }

  const bag = payload as Record<string, unknown>;
  const uploadContext =
    bag.uploadContext && typeof bag.uploadContext === 'object'
      ? (bag.uploadContext as Record<string, unknown>)
      : null;

  const clientId = toOptionalString(bag.clientId);
  const sourceFileName = toOptionalString(bag.sourceFileName ?? bag.fileName);
  const rawStatus = toOptionalString(bag.fileStatus ?? bag.status);
  const fileStatus = coerceImportStatus(rawStatus);
  const fileStorageUri = resolveFileStorageUri(bag, uploadContext);
  const fileUploadGuid =
    toOptionalString(bag.fileUploadGuid ?? bag.fileUploadId ?? bag.id) ?? undefined;

  const missingFields = [
    !clientId ? 'clientId is required' : null,
    !sourceFileName ? 'sourceFileName is required' : null,
    !fileStorageUri ? 'fileStorageUri (or fileUri/blobUrl) is required' : null,
  ].filter(Boolean) as string[];

  if (missingFields.length > 0) {
    return { record: null, errors: missingFields };
  }

  const requiredClientId = clientId as string;
  const requiredSourceFileName = sourceFileName as string;
  const requiredFileStorageUri = fileStorageUri as string;

  const baseRecord: NewClientFileRecord = {
    clientId: requiredClientId,
    fileUploadGuid,
    userId: toOptionalString(bag.userId),
    uploadedBy: toOptionalString(bag.uploadedBy ?? bag.importedBy),
    sourceFileName: requiredSourceFileName,
    fileStorageUri: requiredFileStorageUri,
    status: fileStatus,
    glPeriodStart: normalizeMonthToDate(
      toOptionalString(bag.glPeriodStart ?? bag.period)
    ),
    glPeriodEnd: normalizeMonthToDate(
      toOptionalString(bag.glPeriodEnd ?? bag.period)
    ),
    lastStepCompletedDttm: toOptionalString(
      bag.lastStepCompletedDttm ?? bag.timestamp
    ),
  };

  const normalizeSheets = (
    input: unknown,
    defaultSelected: boolean
  ): ClientFileSheet[] => {
    if (!Array.isArray(input)) {
      return [];
    }

    return input
      .filter(Boolean)
      .map((entry) => {
        const sheet = entry as Record<string, unknown>;
        const sheetName =
          toOptionalString(sheet.sheetName ?? sheet.name ?? sheet.title) ?? '';
        const firstDataRowIndex = parseOptionalInteger(
          sheet.firstDataRowIndex ?? sheet.firstDataRow ?? sheet.startRow
        );
        const isSelected = parseBoolean(sheet.isSelected, defaultSelected);

        return {
          sheetName,
          rowCount: parseIntegerWithDefault(sheet.rowCount, 0),
          isSelected,
          firstDataRowIndex,
        };
      })
      .filter((entry) => entry.sheetName.length > 0 && Number.isFinite(entry.rowCount));
  };

  const detectedSheets = normalizeSheets(uploadContext?.sheets, false);
  const selectedSheets = normalizeSheets(bag.sheets, true);

  const mergedSheets = new Map<string, ClientFileSheet>();

  detectedSheets.forEach((sheet) => {
    mergedSheets.set(sheet.sheetName, sheet);
  });

  selectedSheets.forEach((sheet) => {
    const existing = mergedSheets.get(sheet.sheetName);
    mergedSheets.set(sheet.sheetName, {
      ...existing,
      ...sheet,
      isSelected: sheet.isSelected ?? existing?.isSelected ?? true,
      rowCount: Number.isFinite(sheet.rowCount)
        ? sheet.rowCount
        : existing?.rowCount ?? 0,
      firstDataRowIndex:
        sheet.firstDataRowIndex ?? existing?.firstDataRowIndex,
    });
  });

  if (mergedSheets.size > 0) {
    baseRecord.sheets = Array.from(mergedSheets.values());
  }

  if (Array.isArray(bag.entities)) {
    baseRecord.entities = bag.entities
      .filter(Boolean)
      .map((entry) => {
        const entity = entry as Record<string, unknown>;
        const entityId = parseOptionalInteger(entity.entityId ?? entity.id);
        const displayName = toOptionalString(
          entity.displayName ?? entity.entityDisplayName
        );
        const entityName =
          toOptionalString(entity.entityName ?? entity.name) ?? displayName ?? '';
        return {
          entityId: entityId ?? undefined,
          entityName,
          displayName: displayName ?? undefined,
          rowCount: parseIntegerWithDefault(entity.rowCount, 0),
          isSelected: parseBoolean(entity.isSelected, true),
        };
      })
      .filter(
        (entry) => entry.entityName.length > 0 && Number.isFinite(entry.rowCount)
      );
  }

  return { record: baseRecord, errors: [] };
};

export const listClientFilesHandler = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  try {
    const userId = getFirstStringValue(request.query.get('userId'));
    const clientId = getFirstStringValue(request.query.get('clientId'));
    const page = parseInteger(request.query.get('page'), 1);
    const pageSize = parseInteger(request.query.get('pageSize'), 10);

    const result = await listClientFiles(userId, clientId, page, pageSize);

    return json(result, 200);
  } catch (error) {
    context.error('Failed to load client file history', error);
    return json(buildErrorResponse('Failed to load client file history', error), 500);
  }
};

export const saveClientFileHandler = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  try {
    const parsed = await readJson(request);
    const { record, errors } = validateRecord(parsed);

    if (!record) {
      context.warn('Invalid client file payload', {
        errors,
        payloadPreview: parsed,
      });
      return json({ message: 'Invalid client file payload', errors }, 400);
    }

    context.info('Persisting client file metadata', {
      clientId: record.clientId,
      sourceFileName: record.sourceFileName,
      fileStatus: record.status,
      sheetCount: record.sheets?.length ?? 0,
      entityCount: record.entities?.length ?? 0,
    });

    const saved = await saveClientFileMetadata(record);

    return json({ item: saved }, 201);
  } catch (error) {
    context.error('Failed to persist client file metadata', error);
    return json(
      buildErrorResponse('Failed to persist client file metadata', error),
      500
    );
  }
};

app.http('listClientFiles', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'client-files',
  handler: listClientFilesHandler,
});

app.http('saveClientFile', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'client-files',
  handler: saveClientFileHandler,
});