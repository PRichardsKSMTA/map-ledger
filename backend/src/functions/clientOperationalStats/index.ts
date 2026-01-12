import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { json, readJson } from '../../http';
import { getFirstStringValue } from '../../utils/requestParsers';
import { buildErrorResponse } from '../datapointConfigs/utils';
import {
  executeDispatchMiles,
  listClientOperationalStats,
  listOperationalChartOfAccounts,
} from '../../repositories/clientOperationalStatsRepository';

export const listClientOperationalStatsHandler = async (
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

    const [accounts, items] = await Promise.all([
      listOperationalChartOfAccounts(),
      listClientOperationalStats(clientId, glMonth ?? undefined),
    ]);

    return json({ accounts, items }, 200);
  } catch (error) {
    context.error('Failed to list client operational stats', error);
    return json(buildErrorResponse('Failed to list client operational stats', error), 500);
  }
};

export const executeDispatchMilesHandler = async (
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> => {
  try {
    const payload = await readJson<{
      scac?: string;
      endDate?: string;
    }>(request);

    const scac = getFirstStringValue([
      payload?.scac,
      request.query.get('scac'),
      request.query.get('SCAC'),
    ]);

    if (!scac) {
      return json({ message: 'scac is required' }, 400);
    }

    const endDate = getFirstStringValue([
      payload?.endDate,
      request.query.get('endDate'),
      request.query.get('end_date'),
    ]);

    const result = await executeDispatchMiles(scac, endDate);
    return json(result, 200);
  } catch (error) {
    context.error('Failed to execute dispatch miles calculation', error);
    return json(buildErrorResponse('Failed to execute dispatch miles calculation', error), 500);
  }
};

app.http('clientOperationalStats-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'client-operational-stats',
  handler: listClientOperationalStatsHandler,
});

app.http('clientOperationalStats-refreshFM', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'client-operational-stats/refresh-fm',
  handler: executeDispatchMilesHandler,
});

export default listClientOperationalStatsHandler;
