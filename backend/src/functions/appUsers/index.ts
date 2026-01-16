import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getClientPrincipal, json, readJson } from '../../http';
import {
  listAppUsers,
  getAppUserById,
  getAppUserByEmail,
  createAppUser,
  updateAppUser,
  deactivateAppUser,
  reactivateAppUser,
  type AppUserRole,
} from '../../repositories/appUserRepository';
import { getFirstStringValue } from '../../utils/requestParsers';
import { buildErrorResponse } from '../datapointConfigs/utils';

const resolveUpdatedBy = (request: HttpRequest): string | undefined => {
  const principal = getClientPrincipal(request);
  return principal?.userDetails || principal?.userId;
};

export const listAppUsersHandler = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  try {
    const includeInactive = request.query.get('includeInactive') === 'true';
    const users = await listAppUsers(includeInactive);
    return json({ items: users }, 200);
  } catch (error) {
    context.error('Failed to list app users', error);
    return json(buildErrorResponse('Failed to list app users', error), 500);
  }
};

export const getAppUserHandler = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  try {
    const params = request.params as Partial<{ userId?: string }> | undefined;
    const userId = getFirstStringValue(params?.userId);

    if (!userId) {
      return json({ message: 'userId is required' }, 400);
    }

    const user = await getAppUserById(userId);
    if (!user) {
      return json({ message: 'User not found' }, 404);
    }

    return json({ item: user }, 200);
  } catch (error) {
    context.error('Failed to get app user', error);
    return json(buildErrorResponse('Failed to get app user', error), 500);
  }
};

export const getCurrentUserHandler = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  try {
    const principal = getClientPrincipal(request);
    const email = principal?.userDetails;

    if (!email) {
      return json({ message: 'User not authenticated' }, 401);
    }

    const user = await getAppUserByEmail(email);
    if (!user) {
      return json({ item: null, message: 'User not registered in app' }, 200);
    }

    return json({ item: user }, 200);
  } catch (error) {
    context.error('Failed to get current user', error);
    return json(buildErrorResponse('Failed to get current user', error), 500);
  }
};

export const createAppUserHandler = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  try {
    const payload = await readJson<Record<string, unknown>>(request);
    if (!payload) {
      return json({ message: 'Request body is required' }, 400);
    }

    const aadUserId = getFirstStringValue(payload.aadUserId);
    const email = getFirstStringValue(payload.email);
    const firstName = getFirstStringValue(payload.firstName);
    const lastName = getFirstStringValue(payload.lastName);
    const displayName = getFirstStringValue(payload.displayName);
    const role = getFirstStringValue(payload.role) as AppUserRole | undefined;

    if (!aadUserId || !email || !firstName || !lastName) {
      return json({ message: 'aadUserId, email, firstName, and lastName are required' }, 400);
    }

    if (role && !['super', 'admin', 'viewer'].includes(role)) {
      return json({ message: 'Invalid role. Must be super, admin, or viewer' }, 400);
    }

    // Check if user already exists
    const existingUser = await getAppUserByEmail(email);
    if (existingUser) {
      return json({ message: 'User with this email already exists' }, 409);
    }

    const user = await createAppUser({
      aadUserId,
      email,
      firstName,
      lastName,
      displayName: displayName || `${firstName} ${lastName}`,
      role: role || 'viewer',
      createdBy: resolveUpdatedBy(request),
    });

    if (!user) {
      return json({ message: 'Failed to create user' }, 500);
    }

    return json({ item: user }, 201);
  } catch (error) {
    context.error('Failed to create app user', error);
    return json(buildErrorResponse('Failed to create app user', error), 500);
  }
};

export const updateAppUserHandler = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  try {
    const params = request.params as Partial<{ userId?: string }> | undefined;
    const userId = getFirstStringValue(params?.userId);

    if (!userId) {
      return json({ message: 'userId is required' }, 400);
    }

    const payload = await readJson<Record<string, unknown>>(request);
    if (!payload) {
      return json({ message: 'Request body is required' }, 400);
    }

    const firstName = getFirstStringValue(payload.firstName);
    const lastName = getFirstStringValue(payload.lastName);
    const displayName = getFirstStringValue(payload.displayName);
    const role = getFirstStringValue(payload.role) as AppUserRole | undefined;
    const isActive = payload.isActive;
    const monthlyClosingDateRaw = payload.monthlyClosingDate;
    const surveyNotifyRaw = payload.surveyNotify;

    if (role && !['super', 'admin', 'viewer'].includes(role)) {
      return json({ message: 'Invalid role. Must be super, admin, or viewer' }, 400);
    }
    if (
      monthlyClosingDateRaw !== undefined &&
      monthlyClosingDateRaw !== null &&
      (typeof monthlyClosingDateRaw !== 'number' ||
        !Number.isInteger(monthlyClosingDateRaw) ||
        monthlyClosingDateRaw < 1 ||
        monthlyClosingDateRaw > 28)
    ) {
      return json({ message: 'monthlyClosingDate must be an integer between 1 and 28' }, 400);
    }
    if (surveyNotifyRaw !== undefined && typeof surveyNotifyRaw !== 'boolean') {
      return json({ message: 'surveyNotify must be a boolean' }, 400);
    }

    if (role && role !== 'super') {
      const principal = getClientPrincipal(request);
      const currentEmail = principal?.userDetails?.toLowerCase();
      if (currentEmail) {
        const existingUser = await getAppUserById(userId);
        if (existingUser && existingUser.email.toLowerCase() === currentEmail) {
          return json(
            { message: 'You cannot change your own role to less than Super User' },
            400
          );
        }
      }
    }

    const user = await updateAppUser({
      id: userId,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      displayName: displayName || undefined,
      role,
      monthlyClosingDate:
        monthlyClosingDateRaw === undefined ? undefined : (monthlyClosingDateRaw as number | null),
      surveyNotify: surveyNotifyRaw === undefined ? undefined : (surveyNotifyRaw as boolean),
      isActive: typeof isActive === 'boolean' ? isActive : undefined,
      updatedBy: resolveUpdatedBy(request),
    });

    if (!user) {
      return json({ message: 'User not found' }, 404);
    }

    return json({ item: user }, 200);
  } catch (error) {
    context.error('Failed to update app user', error);
    return json(buildErrorResponse('Failed to update app user', error), 500);
  }
};

export const deactivateAppUserHandler = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  try {
    const params = request.params as Partial<{ userId?: string }> | undefined;
    const userId = getFirstStringValue(params?.userId);

    if (!userId) {
      return json({ message: 'userId is required' }, 400);
    }

    const user = await deactivateAppUser(userId, resolveUpdatedBy(request));
    if (!user) {
      return json({ message: 'User not found' }, 404);
    }

    return json({ item: user }, 200);
  } catch (error) {
    context.error('Failed to deactivate app user', error);
    return json(buildErrorResponse('Failed to deactivate app user', error), 500);
  }
};

export const reactivateAppUserHandler = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  try {
    const params = request.params as Partial<{ userId?: string }> | undefined;
    const userId = getFirstStringValue(params?.userId);

    if (!userId) {
      return json({ message: 'userId is required' }, 400);
    }

    const user = await reactivateAppUser(userId, resolveUpdatedBy(request));
    if (!user) {
      return json({ message: 'User not found' }, 404);
    }

    return json({ item: user }, 200);
  } catch (error) {
    context.error('Failed to reactivate app user', error);
    return json(buildErrorResponse('Failed to reactivate app user', error), 500);
  }
};

// Register routes
app.http('listAppUsers', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'app-users',
  handler: listAppUsersHandler,
});

app.http('getAppUser', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'app-users/{userId}',
  handler: getAppUserHandler,
});

app.http('getCurrentUser', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'app-users/me',
  handler: getCurrentUserHandler,
});

app.http('createAppUser', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'app-users',
  handler: createAppUserHandler,
});

app.http('updateAppUser', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'app-users/{userId}',
  handler: updateAppUserHandler,
});

app.http('deactivateAppUser', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'app-users/{userId}/deactivate',
  handler: deactivateAppUserHandler,
});

app.http('reactivateAppUser', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'app-users/{userId}/reactivate',
  handler: reactivateAppUserHandler,
});

export default listAppUsersHandler;
