import type { HttpRequest, InvocationContext } from '@azure/functions';
import { json, getClientPrincipal } from '../src/http';
import {
  fetchUserClientAccess,
  isUserClientFallbackAllowed,
} from '../src/repositories/userClientRepository';
import createFallbackUserClientAccess from '../src/repositories/userClientRepositoryFallback';

const logPrefix = '[userClients]';

const shouldLog = process.env.NODE_ENV !== 'test';

const logDebug = (message: string, details?: Record<string, unknown>) => {
  if (!shouldLog) {
    return;
  }
  // eslint-disable-next-line no-console
  console.debug(logPrefix, message, details ?? '');
};

const logInfo = (message: string, details?: Record<string, unknown>) => {
  if (!shouldLog) {
    return;
  }
  // eslint-disable-next-line no-console
  console.info(logPrefix, message, details ?? '');
};

const logWarn = (message: string, details?: Record<string, unknown>) => {
  if (!shouldLog) {
    return;
  }
  // eslint-disable-next-line no-console
  console.warn(logPrefix, message, details ?? '');
};

const logError = (message: string, details?: unknown) => {
  if (!shouldLog) {
    return;
  }
  // eslint-disable-next-line no-console
  console.error(logPrefix, message, details ?? '');
};

const normalizeEmail = (value?: unknown): string | undefined => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return undefined;
    }
    return trimmed.toLowerCase();
  }

  if (Array.isArray(value) && value.length > 0) {
    return normalizeEmail(value[0]);
  }

  return undefined;
};

const extractEmailFromQuery = (req: HttpRequest): string | undefined => {
  const queryAny = req.query as unknown;
  if (!queryAny) {
    return undefined;
  }

  const queryWithGet = queryAny as { get?: unknown };
  if (typeof queryWithGet?.get === 'function') {
    const params = queryWithGet as {
      get: (key: string) => string | null | undefined;
    };
    const keys = ['email', 'Email', 'userEmail', 'UserEmail'];
    for (const key of keys) {
      const candidate = params.get(key);
      const normalized = normalizeEmail(candidate ?? undefined);
      if (normalized) {
        logDebug('Resolved email from URLSearchParams query bag', { key });
        return normalized;
      }
    }
  }

  if (typeof queryAny === 'object') {
    const record = queryAny as Record<string, unknown>;
    const keys = [
      'email',
      'Email',
      'userEmail',
      'UserEmail',
      'x-user-email',
      'X-User-Email',
    ];
    for (const key of keys) {
      if (!(key in record)) {
        continue;
      }
      const normalized = normalizeEmail(record[key]);
      if (normalized) {
        logDebug('Resolved email from object-style query parameters', { key });
        return normalized;
      }
    }
  }

  return undefined;
};

const extractEmailFromHeaders = (req: HttpRequest): string | undefined => {
  const headersAny = req.headers as unknown;

  const headersWithGet = headersAny as { get?: unknown };
  if (typeof headersWithGet?.get === 'function') {
    const headers = headersWithGet as {
      get: (key: string) => string | null | undefined;
    };
    const candidate =
      headers.get('x-user-email') ??
      headers.get('X-User-Email') ??
      headers.get('user-email') ??
      headers.get('User-Email');
    const normalized = normalizeEmail(candidate ?? undefined);
    if (normalized) {
      logDebug('Resolved email from Headers bag');
      return normalized;
    }
  }

  if (headersAny && typeof headersAny === 'object') {
    const record = headersAny as Record<string, unknown>;
    const keys = [
      'x-user-email',
      'X-User-Email',
      'user-email',
      'User-Email',
      'userEmail',
      'UserEmail',
    ];
    for (const key of keys) {
      if (!(key in record)) {
        continue;
      }
      const normalized = normalizeEmail(record[key]);
      if (normalized) {
        logDebug('Resolved email from object-style headers', { key });
        return normalized;
      }
    }
  }

  return undefined;
};

export default async function (req: HttpRequest, _ctx: InvocationContext) {
  logInfo('Received user clients request', {
    method: req.method,
    url: req.url,
  });

  try {
    const principal = getClientPrincipal(req);
    logDebug('Parsed client principal from request', {
      hasPrincipal: Boolean(principal),
      identityProvider: principal?.identityProvider ?? null,
      principalUserId: principal?.userId ?? null,
      principalUserDetails: principal?.userDetails ?? null,
      principalRoleCount: Array.isArray(principal?.userRoles)
        ? principal?.userRoles.length
        : 0,
    });

    const emailFromPrincipal = normalizeEmail(principal?.userDetails ?? undefined);
    const emailFromQuery = extractEmailFromQuery(req);
    const emailFromHeader = extractEmailFromHeaders(req);

    const email = emailFromPrincipal || emailFromQuery || emailFromHeader;

    logInfo('Resolved email for user clients request', {
      hasPrincipalEmail: Boolean(emailFromPrincipal),
      hasQueryEmail: Boolean(emailFromQuery),
      hasHeaderEmail: Boolean(emailFromHeader),
      normalizedEmail: email ?? null,
    });

    if (!email) {
      logWarn('Missing user identity after evaluating request');
      return json({ message: 'Missing user identity' }, 401);
    }

    try {
      logInfo('Fetching user client access from repository', {
        normalizedEmail: email,
      });
      const data = await fetchUserClientAccess(email);
      logInfo('Returning user client access response', {
        normalizedEmail: email,
        clientCount: Array.isArray(data.clients) ? data.clients.length : 0,
      });
      return json(data);
    } catch (err) {
      logWarn('Repository lookup failed for user clients; evaluating fallback', {
        normalizedEmail: email,
        errorMessage: err instanceof Error ? err.message : 'unknown',
      });
      if (isUserClientFallbackAllowed()) {
        logInfo('Fallback enabled; returning synthetic user client access payload', {
          normalizedEmail: email,
        });
        return json(createFallbackUserClientAccess(email));
      }
      logError('Repository lookup failed and fallback disabled', err);
      return json({ message: 'Failed to load clients for user' }, 500);
    }
  } catch (err) {
    logError('Unexpected error processing user clients request', err);
    return json({ message: 'Unexpected error' }, 500);
  }
}
