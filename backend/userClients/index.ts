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

const candidateEmailKeySet = new Set(
  [
    'email',
    'useremail',
    'user_email',
    'x-user-email',
    'principalemail',
    'preferredemail',
    'preferred_email',
  ].map((key) => key.toLowerCase())
);

const getFirstStringValue = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      if (typeof entry === 'string') {
        return entry;
      }
    }
  }

  return undefined;
};

interface KeyedValueLookupResult {
  key: string;
  value: unknown;
}

const lookupValueByCandidateKeys = (
  bag: unknown,
  candidateKeys: string[]
): KeyedValueLookupResult | undefined => {
  if (!bag) {
    return undefined;
  }

  const normalizedCandidates = candidateKeys.map((key) => key.toLowerCase());

  const bagWithGet = bag as { get?: unknown };
  if (typeof bagWithGet?.get === 'function') {
    const accessor = bagWithGet as {
      get: (key: string) => string | null | undefined;
    };
    for (const key of candidateKeys) {
      const value = accessor.get(key);
      if (value !== undefined && value !== null) {
        return { key, value };
      }
    }
  }

  if (typeof bag === 'object') {
    const entries = Object.entries(bag as Record<string, unknown>);
    for (const [rawKey, rawValue] of entries) {
      const normalizedKey = rawKey.toLowerCase();
      const candidateIndex = normalizedCandidates.indexOf(normalizedKey);
      if (candidateIndex === -1) {
        continue;
      }

      if (rawValue === undefined || rawValue === null) {
        continue;
      }

      const candidateKey = candidateKeys[candidateIndex];
      if (Array.isArray(rawValue)) {
        for (const entry of rawValue) {
          if (entry !== undefined && entry !== null) {
            return { key: candidateKey, value: entry };
          }
        }
        continue;
      }

      return { key: candidateKey, value: rawValue };
    }
  }

  return undefined;
};

const resolveFromSearchParams = (
  params: URLSearchParams,
  source: string
): string | undefined => {
  for (const key of params.keys()) {
    const normalizedKey = key.toLowerCase();
    if (!candidateEmailKeySet.has(normalizedKey)) {
      continue;
    }

    const normalized = normalizeEmail(params.get(key) ?? undefined);
    if (normalized) {
      logDebug('Resolved email from search parameters', { source, key });
      return normalized;
    }
  }

  return undefined;
};

const extractEmailFromUrlLike = (
  value: unknown,
  source: string
): string | undefined => {
  const candidate = getFirstStringValue(value);
  if (!candidate) {
    return undefined;
  }

  try {
    const parsed = candidate.startsWith('http://') || candidate.startsWith('https://')
      ? new URL(candidate)
      : new URL(candidate, 'http://localhost');

    return resolveFromSearchParams(parsed.searchParams, source);
  } catch {
    return undefined;
  }
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
  const queryAny = (req as any).query as unknown;
  if (!queryAny) {
    return undefined;
  }

  const queryWithGet = queryAny as { get?: unknown; keys?: unknown };
  if (typeof queryWithGet?.get === 'function') {
    const params = queryWithGet as {
      get: (key: string) => string | null | undefined;
      keys?: () => IterableIterator<string>;
    };

    if (typeof params.keys === 'function') {
      for (const key of params.keys()) {
        if (!candidateEmailKeySet.has(key.toLowerCase())) {
          continue;
        }
        const candidate = params.get(key);
        const normalized = normalizeEmail(candidate ?? undefined);
        if (normalized) {
          logDebug('Resolved email from iterable query bag', { key });
          return normalized;
        }
      }
    }

    const fallbackKeys = [
      'email',
      'Email',
      'EMAIL',
      'userEmail',
      'UserEmail',
      'USEREMAIL',
      'user_email',
      'User_Email',
      'x-user-email',
      'X-User-Email',
    ];
    for (const key of fallbackKeys) {
      const candidate = params.get(key);
      const normalized = normalizeEmail(candidate ?? undefined);
      if (normalized) {
        logDebug('Resolved email from URLSearchParams-style query bag', { key });
        return normalized;
      }
    }
  }

  if (queryAny instanceof URLSearchParams) {
    const normalized = resolveFromSearchParams(queryAny, 'query URLSearchParams instance');
    if (normalized) {
      return normalized;
    }
  }

  if (typeof queryAny === 'string') {
    const normalized = resolveFromSearchParams(
      new URLSearchParams(queryAny.startsWith('?') ? queryAny.slice(1) : queryAny),
      'query string value'
    );
    if (normalized) {
      return normalized;
    }
  }

  if (typeof queryAny === 'object') {
    const record = queryAny as Record<string, unknown>;
    for (const [key, value] of Object.entries(record)) {
      if (!candidateEmailKeySet.has(key.toLowerCase())) {
        continue;
      }
      const normalized = normalizeEmail(value);
      if (normalized) {
        logDebug('Resolved email from object-style query parameters', { key });
        return normalized;
      }
    }
  }

  return undefined;
};

const extractEmailFromHeaders = (req: HttpRequest): string | undefined => {
  const headersAny = (req as any).headers as unknown;
  const headerCandidates = [
    'x-user-email',
    'X-User-Email',
    'user-email',
    'User-Email',
    'userEmail',
    'UserEmail',
  ];
  const lookup = lookupValueByCandidateKeys(headersAny, headerCandidates);
  if (lookup) {
    const normalized = normalizeEmail(lookup.value);
    if (normalized) {
      logDebug('Resolved email from explicit header', { key: lookup.key });
      return normalized;
    }
  }

  const azureLookup = lookupValueByCandidateKeys(headersAny, [
    'x-ms-client-principal-name',
    'x-ms-client-principal-email',
  ]);
  if (azureLookup) {
    const normalized = normalizeEmail(azureLookup.value);
    if (normalized) {
      logDebug('Resolved email from Azure authentication headers', {
        key: azureLookup.key,
      });
      return normalized;
    }
  }

  return undefined;
};

const extractEmailFromOriginalUrlHeader = (req: HttpRequest): string | undefined => {
  const headersAny = (req as any).headers as unknown;
  const lookup = lookupValueByCandidateKeys(headersAny, [
    'x-ms-original-url',
    'X-MS-ORIGINAL-URL',
    'x-original-url',
    'X-Original-URL',
    'x-appservice-original-url',
    'x-forwarded-url',
  ]);

  if (!lookup) {
    return undefined;
  }

  const normalized = extractEmailFromUrlLike(lookup.value, `header:${lookup.key}`);
  if (normalized) {
    return normalized;
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
    const emailFromHeader = extractEmailFromHeaders(req);
    const emailFromQuery = extractEmailFromQuery(req);
    const emailFromRequestUrl = extractEmailFromUrlLike(req.url, 'request.url');
    const emailFromOriginalUrl = extractEmailFromOriginalUrlHeader(req);

    let email =
      emailFromPrincipal ||
      emailFromHeader ||
      emailFromQuery ||
      emailFromRequestUrl ||
      emailFromOriginalUrl;

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
      hasHeaderEmail: Boolean(emailFromHeader),
      hasQueryEmail: Boolean(emailFromQuery),
      hasRequestUrlEmail: Boolean(emailFromRequestUrl),
      hasOriginalUrlEmail: Boolean(emailFromOriginalUrl),
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
