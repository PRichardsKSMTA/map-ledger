import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { json, readJson } from '../../http';
import {
  ClientFileRecord,
  listClientFiles,
  saveClientFileMetadata,
} from '../../repositories/clientFileRepository';
import { getFirstStringValue } from '../../utils/requestParsers';
import { buildErrorResponse } from '../datapointConfigs/utils';

const parseInteger = (value: string | null, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const validateRecord = (payload: unknown): ClientFileRecord | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const bag = payload as Record<string, unknown>;
  const requiredStrings: Array<keyof ClientFileRecord> = [
    'id',
    'clientId',
    'userId',
    'uploadedBy',
    'fileName',
    'fileType',
    'period',
  ];

  for (const key of requiredStrings) {
    if (typeof bag[key] !== 'string' || !(bag[key] as string).trim()) {
      return null;
    }
  }

  if (typeof bag.fileSize !== 'number' || Number.isNaN(bag.fileSize)) {
    return null;
  }

  if (bag.rowCount !== undefined && typeof bag.rowCount !== 'number') {
    return null;
  }

  if (bag.status !== 'completed' && bag.status !== 'failed') {
    return null;
  }

  const baseRecord: ClientFileRecord = {
    id: bag.id as string,
    clientId: bag.clientId as string,
    userId: bag.userId as string,
    uploadedBy: bag.uploadedBy as string,
    fileName: bag.fileName as string,
    fileSize: bag.fileSize as number,
    fileType: bag.fileType as string,
    status: bag.status as ClientFileRecord['status'],
    period: bag.period as string,
    rowCount: bag.rowCount as number | undefined,
    timestamp: typeof bag.timestamp === 'string' ? bag.timestamp : undefined,
  };

  if (Array.isArray(bag.sheets)) {
    baseRecord.sheets = bag.sheets
      .filter(Boolean)
      .map((entry) => {
        const sheet = entry as Record<string, unknown>;
        return {
          sheetName: String(sheet.sheetName ?? '').trim(),
          glMonth:
            typeof sheet.glMonth === 'string' && sheet.glMonth.trim()
              ? sheet.glMonth.trim()
              : undefined,
          rowCount: Number(sheet.rowCount ?? 0),
        };
      })
      .filter((entry) => entry.sheetName.length > 0 && Number.isFinite(entry.rowCount));
  }

  if (Array.isArray(bag.entities)) {
    baseRecord.entities = bag.entities
      .filter(Boolean)
      .map((entry) => {
        const entity = entry as Record<string, unknown>;
        return {
          entityName: String(entity.entityName ?? '').trim(),
          rowCount: Number(entity.rowCount ?? 0),
        };
      })
      .filter(
        (entry) => entry.entityName.length > 0 && Number.isFinite(entry.rowCount)
      );
  }

  return baseRecord;
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
    const record = validateRecord(parsed);

    if (!record) {
      return json({ message: 'Invalid client file payload' }, 400);
    }

    const saved = await saveClientFileMetadata({
      ...record,
      timestamp: record.timestamp ?? new Date().toISOString(),
    });

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
