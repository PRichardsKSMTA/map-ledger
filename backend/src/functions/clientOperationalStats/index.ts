import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { json, readJson } from '../../http';
import { getFirstStringValue } from '../../utils/requestParsers';
import { buildErrorResponse } from '../datapointConfigs/utils';
import {
  checkClientFMStatistics,
  executeDispatchMiles,
  listClientOperationalStats,
  listOperationalChartOfAccounts,
} from '../../repositories/clientOperationalStatsRepository';
import {
  initializeClientGlData,
  backfillClientGlData,
} from '../../repositories/clientGlDataRepository';

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

export const checkFMStatisticsHandler = async (
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> => {
  try {
    const scac = getFirstStringValue([
      request.query.get('scac'),
      request.query.get('SCAC'),
      request.query.get('clientScac'),
    ]);

    if (!scac) {
      return json({ message: 'scac query parameter is required' }, 400);
    }

    const result = await checkClientFMStatistics(scac);
    return json(result, 200);
  } catch (error) {
    context.error('Failed to check FM statistics', error);
    return json(buildErrorResponse('Failed to check FM statistics', error), 500);
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

app.http('clientOperationalStats-checkFM', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'client-operational-stats/check-fm',
  handler: checkFMStatisticsHandler,
});

/**
 * Initialize CLIENT_GL_DATA for a specific client.
 * Creates records for all COA accounts × GL months × operations with GL_VALUE = 0.
 * Skips records that already exist.
 */
export const initializeClientGlDataHandler = async (
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> => {
  try {
    const payload = await readJson<{
      clientId?: string;
      glMonths?: string[];
    }>(request);

    const clientId = getFirstStringValue([
      payload?.clientId,
      request.query.get('clientId'),
      request.query.get('client_id'),
    ]);

    if (!clientId) {
      return json({ message: 'clientId is required' }, 400);
    }

    const glMonths = payload?.glMonths;

    context.info('Initializing CLIENT_GL_DATA for client', { clientId, glMonths });
    const result = await initializeClientGlData(clientId, glMonths);

    return json({
      success: true,
      clientId,
      created: result.created,
      skipped: result.skipped,
      message: `Initialized ${result.created} records (${result.skipped} already existed)`,
    }, 200);
  } catch (error) {
    context.error('Failed to initialize CLIENT_GL_DATA', error);
    return json(buildErrorResponse('Failed to initialize CLIENT_GL_DATA', error), 500);
  }
};

/**
 * Backfill CLIENT_GL_DATA for all clients that have file records.
 * This is a maintenance endpoint meant to be run once to populate historical data.
 */
export const backfillClientGlDataHandler = async (
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> => {
  try {
    context.info('Starting CLIENT_GL_DATA backfill for all clients');
    const result = await backfillClientGlData();

    return json({
      success: true,
      totalClients: result.clients.length,
      totalCreated: result.totalCreated,
      totalSkipped: result.totalSkipped,
      clients: result.clients,
      message: `Backfilled ${result.totalCreated} records across ${result.clients.length} clients (${result.totalSkipped} already existed)`,
    }, 200);
  } catch (error) {
    context.error('Failed to backfill CLIENT_GL_DATA', error);
    return json(buildErrorResponse('Failed to backfill CLIENT_GL_DATA', error), 500);
  }
};

app.http('clientOperationalStats-initializeGlData', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'client-operational-stats/initialize-gl-data',
  handler: initializeClientGlDataHandler,
});

app.http('clientOperationalStats-backfillGlData', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'client-operational-stats/backfill-gl-data',
  handler: backfillClientGlDataHandler,
});

export default listClientOperationalStatsHandler;
