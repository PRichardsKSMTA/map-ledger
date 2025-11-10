import type { HttpRequest, InvocationContext } from '@azure/functions';
import { json } from '../src/http';
import { runQuery } from '../src/utils/sqlClient';

const logPrefix = '[dbPing]';
const shouldLog = process.env.NODE_ENV !== 'test';

const logInfo = (message: string, details?: Record<string, unknown>) => {
  if (!shouldLog) {
    return;
  }
  // eslint-disable-next-line no-console
  console.info(logPrefix, message, details ?? '');
};

const logError = (message: string, details?: unknown) => {
  if (!shouldLog) {
    return;
  }
  // eslint-disable-next-line no-console
  console.error(logPrefix, message, details ?? '');
};

export default async function dbPing(
  _req: HttpRequest,
  _ctx: InvocationContext
) {
  const startedAt = Date.now();
  logInfo('Received database ping request');

  try {
    const result = await runQuery('SELECT SYSDATETIMEOFFSET() AS currentTime');
    const firstRow = result.recordset?.[0] as { currentTime?: unknown } | undefined;
    const durationMs = Date.now() - startedAt;

    logInfo('Database ping query executed successfully', {
      durationMs,
      rowCount: result.recordset?.length ?? 0,
    });

    return json({
      ok: true,
      message: 'Successfully reached SQL database',
      durationMs,
      serverTimestamp: firstRow?.currentTime ?? null,
    });
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    logError('Database ping failed', {
      durationMs,
      error,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });

    return json(
      {
        ok: false,
        message: 'Failed to reach SQL database',
        durationMs,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
