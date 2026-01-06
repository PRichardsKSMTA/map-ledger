import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { json, readJson } from '../../http';
import { getFirstStringValue } from '../../utils/requestParsers';
import { buildErrorResponse } from '../datapointConfigs/utils';
import {
  ClientSurveyUpdateInput,
  getClientSurveySnapshot,
  updateClientSurveyValues,
} from '../../repositories/clientSurveyRepository';

const parseNumber = (value: unknown): number | undefined => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const readStringFromEntry = (
  entry: Record<string, unknown>,
  keys: string[],
): string | undefined =>
  getFirstStringValue(keys.map(key => entry[key]));

const readNumberFromEntry = (
  entry: Record<string, unknown>,
  keys: string[],
): number | undefined => {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(entry, key)) {
      const parsed = parseNumber(entry[key]);
      if (parsed !== undefined) {
        return parsed;
      }
    }
  }
  return undefined;
};

const buildUpdateInputs = (payload: unknown): ClientSurveyUpdateInput[] => {
  if (!Array.isArray(payload)) {
    return [];
  }

  const updates: ClientSurveyUpdateInput[] = [];
  payload.forEach(entry => {
    if (!entry || typeof entry !== 'object') {
      return;
    }

    const record = entry as Record<string, unknown>;
    const operationCd = readStringFromEntry(record, [
      'operationCd',
      'operation_cd',
      'OPERATION_CD',
    ]);
    const glMonth = readStringFromEntry(record, ['glMonth', 'gl_month', 'GL_MONTH']);
    const accountNumber = readStringFromEntry(record, [
      'accountNumber',
      'account_number',
      'ACCOUNT_NUMBER',
      'glId',
      'gl_id',
      'GL_ID',
    ]);
    const glValue = readNumberFromEntry(record, ['glValue', 'gl_value', 'GL_VALUE']);

    if (!operationCd || !glMonth || !accountNumber || glValue === undefined) {
      return;
    }

    updates.push({
      operationCd,
      glMonth,
      accountNumber,
      glValue,
    });
  });

  return updates;
};

export const listClientSurveyDataHandler = async (
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> => {
  try {
    const clientId = getFirstStringValue([
      request.query.get('clientId'),
      request.query.get('client_id'),
      request.query.get('clientID'),
    ]);

    if (!clientId) {
      return json({ message: 'clientId query parameter is required' }, 400);
    }

    const glMonth = getFirstStringValue([
      request.query.get('glMonth'),
      request.query.get('gl_month'),
      request.query.get('GL_MONTH'),
    ]);

    const snapshot = await getClientSurveySnapshot(clientId, glMonth ?? undefined);
    return json(
      {
        accounts: snapshot.accounts,
        items: snapshot.currentValues,
        previousValues: snapshot.previousValues,
      },
      200,
    );
  } catch (error) {
    context.error('Failed to list client survey data', error);
    return json(buildErrorResponse('Failed to list client survey data', error), 500);
  }
};

export const updateClientSurveyHandler = async (
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> => {
  try {
    const payload = await readJson<Record<string, unknown> | { items?: unknown[] }>(request);
    if (!payload) {
      return json({ message: 'Request body is required' }, 400);
    }

    const updates = buildUpdateInputs(
      Array.isArray(payload) ? payload : payload.items ?? payload,
    );
    if (!updates.length) {
      return json({ message: 'No valid survey updates provided' }, 400);
    }

    const updatedCount = await updateClientSurveyValues(updates);
    return json({ updatedCount }, 200);
  } catch (error) {
    context.error('Failed to update client survey values', error);
    return json(buildErrorResponse('Failed to update client survey values', error), 500);
  }
};

app.http('clientSurvey-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'client-survey',
  handler: listClientSurveyDataHandler,
});

app.http('clientSurvey-update', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'client-survey',
  handler: updateClientSurveyHandler,
});

export default listClientSurveyDataHandler;
