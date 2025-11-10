import type { HttpRequest, InvocationContext } from '@azure/functions';
import { json } from '../src/http';
import { getClientPrincipal } from '../src/http';
import { fetchUserClientAccess, isUserClientFallbackAllowed } from '../src/repositories/userClientRepository';
import createFallbackUserClientAccess from '../src/repositories/userClientRepositoryFallback';

export default async function (req: HttpRequest, _ctx: InvocationContext) {
  try {
    const principal = getClientPrincipal(req);

    const normalizeEmail = (value?: string | null) => {
      if (!value) {
        return undefined;
      }
      const trimmed = value.trim();
      return trimmed ? trimmed.toLowerCase() : undefined;
    };

    const emailFromPrincipal = normalizeEmail(principal?.userDetails ?? null);
    const emailFromQuery = normalizeEmail(
      typeof req.query?.get === 'function'
        ? req.query.get('email') ?? req.query.get('Email')
        : undefined
    );
    const emailFromHeader = normalizeEmail(
      typeof req.headers?.get === 'function'
        ? req.headers.get('x-user-email') ?? req.headers.get('X-User-Email')
        : undefined
    );

    const email = emailFromPrincipal || emailFromQuery || emailFromHeader || '';

    if (!email) return json({ message: 'Missing user identity' }, 401);

    try {
      const data = await fetchUserClientAccess(email);
      return json(data);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[userClients] repo failed; checking fallback', err);
      if (isUserClientFallbackAllowed()) {
        return json(createFallbackUserClientAccess(email));
      }
      return json({ message: 'Failed to load clients for user' }, 500);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[userClients] error', err);
    return json({ message: 'Unexpected error' }, 500);
  }
}
