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

const parseFlag = (value?: string): boolean => {
  if (typeof value !== 'string') {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return ['1', 'true', 'yes', 'y', 'on'].includes(normalized);
};

const isDevelopmentLikeEnvironment = (): boolean => {
  const nodeEnv = (process.env.NODE_ENV ?? '').trim().toLowerCase();
  if (['development', 'dev', 'local'].includes(nodeEnv)) {
    return true;
  }

  const functionsEnv = (process.env.AZURE_FUNCTIONS_ENVIRONMENT ?? '')
    .trim()
    .toLowerCase();
  return ['development', 'developmentenvironment', 'local'].includes(
    functionsEnv
  );
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

const maskEmail = (email: string): string => {
  const [local, domain] = email.split('@');
  if (!domain) {
    return email;
  }
  if (local.length <= 2) {
    return `${local[0] ?? '*'}***@${domain}`;
  }
  return `${local.slice(0, 2)}***@${domain}`;
};

const resolveDevOverrideEmail = (): { email: string; source: string } | undefined => {
  const allowBypass = parseFlag(
    process.env.ENABLE_DEV_AUTH_BYPASS ??
      process.env.USER_CLIENTS_ALLOW_DEV_BYPASS ??
      ''
  );

  const autoBypass = parseFlag(
    process.env.USER_CLIENTS_AUTO_DEV_BYPASS ?? 'true'
  );

  if (!allowBypass && !(autoBypass && isDevelopmentLikeEnvironment())) {
    return undefined;
  }

  const candidateKeys = [
    'USER_CLIENTS_DEV_EMAIL',
    'DEV_USER_EMAIL',
    'LOCAL_USER_EMAIL',
    'LOCAL_DEV_USER_EMAIL',
    'USER_CLIENTS_DEFAULT_EMAIL',
  ] as const;

  for (const key of candidateKeys) {
    const envValue = process.env[key];
    const normalized = normalizeEmail(envValue);
    if (normalized) {
      return { email: normalized, source: key };
    }
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

    let email = emailFromPrincipal || emailFromQuery || emailFromHeader;

    if (!email) {
      const override = resolveDevOverrideEmail();
      if (override) {
        logWarn('No authenticated email resolved; using development override', {
          overrideSource: override.source,
          maskedOverrideEmail: maskEmail(override.email),
        });
        email = override.email;
      }
    }

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
