import { Request, Response } from 'express';
import {
  fetchUserClientAccess,
  isUserClientFallbackAllowed,
} from '../../repositories/userClientRepository';
import { getFirstStringValue } from '../../utils/requestParsers';
import { getClientPrincipalFromHeaders } from '../../utils/auth';
import createFallbackUserClientAccess from '../../repositories/userClientRepositoryFallback';

const logPrefix = '[userClients]';

const logDebug = (...args: unknown[]) => {
  if (process.env.NODE_ENV === 'test') {
    return;
  }
  // eslint-disable-next-line no-console
  console.debug(logPrefix, ...args);
};

const logInfo = (...args: unknown[]) => {
  if (process.env.NODE_ENV === 'test') {
    return;
  }
  // eslint-disable-next-line no-console
  console.info(logPrefix, ...args);
};

const logWarn = (...args: unknown[]) => {
  if (process.env.NODE_ENV === 'test') {
    return;
  }
  // eslint-disable-next-line no-console
  console.warn(logPrefix, ...args);
};

const logError = (...args: unknown[]) => {
  if (process.env.NODE_ENV === 'test') {
    return;
  }
  // eslint-disable-next-line no-console
  console.error(logPrefix, ...args);
};

const normalizeEmail = (value: unknown): string | undefined => {
  const candidate = getFirstStringValue(value);
  if (!candidate) {
    return undefined;
  }

  const trimmed = candidate.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.toLowerCase();
};

export default async function userClients(req: Request, res: Response) {
  logDebug('Received request for user clients', {
    queryEmail: req.query.email,
    headerEmail: req.headers['x-user-email'],
    originalUrl: req.originalUrl,
  });

  const clientPrincipal = getClientPrincipalFromHeaders(
    req.headers as Record<string, string | string[] | undefined>
  );

  const emailFromPrincipal = normalizeEmail(clientPrincipal?.userDetails);
  const emailFromHeader = normalizeEmail(req.headers['x-user-email']);
  const emailFromQuery = normalizeEmail(req.query.email);

  const normalizedEmail = emailFromPrincipal ?? emailFromHeader ?? emailFromQuery;

  logInfo('Resolved email for user clients request', {
    hasPrincipalEmail: Boolean(emailFromPrincipal),
    hasHeaderEmail: Boolean(emailFromHeader),
    hasQueryEmail: Boolean(emailFromQuery),
    normalizedEmail: normalizedEmail ?? null,
  });

  if (!normalizedEmail) {
    logWarn('Missing user identity for user clients request');
    res.status(401).json({ message: 'Missing user identity' });
    return;
  }

  try {
    logInfo('Fetching user client access', { normalizedEmail });
    const data = await fetchUserClientAccess(normalizedEmail);
    logInfo('Returning user client access response', {
      normalizedEmail,
      clientCount: data.clients.length,
    });
    res.json(data);
  } catch (error) {
    logError('Failed to load user clients', error);
    if (normalizedEmail && isUserClientFallbackAllowed()) {
      logWarn(
        'Returning fallback user client access response from handler because repository lookup failed'
      );
      res.json(createFallbackUserClientAccess(normalizedEmail));
      return;
    }

    res.status(500).json({ message: 'Failed to load clients for user' });
  }
}
