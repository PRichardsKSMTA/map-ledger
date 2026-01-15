import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { json } from '../../http';
import { buildErrorResponse } from '../datapointConfigs/utils';

export interface AzureAdUser {
  id: string;
  displayName: string;
  givenName: string | null;
  surname: string | null;
  mail: string | null;
  userPrincipalName: string;
}

interface GraphUserResponse {
  id: string;
  displayName: string;
  givenName?: string;
  surname?: string;
  mail?: string;
  userPrincipalName: string;
}

interface GraphSearchResponse {
  value: GraphUserResponse[];
}

const getGraphAccessToken = async (): Promise<string> => {
  const tenantId = process.env.AAD_TENANT_ID;
  const clientId = process.env.AAD_CLIENT_ID;
  const clientSecret = process.env.AAD_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Azure AD configuration is missing. Set AAD_TENANT_ID, AAD_CLIENT_ID, and AAD_CLIENT_SECRET environment variables.');
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get access token: ${response.status} ${errorText}`);
  }

  const data = await response.json() as { access_token: string };
  return data.access_token;
};

const searchGraphUsers = async (query: string, accessToken: string): Promise<AzureAdUser[]> => {
  // Search users by displayName, mail, or userPrincipalName using $filter
  // Use startsWith for efficient searching as user types
  const filter = encodeURIComponent(
    `startsWith(displayName, '${query}') or startsWith(mail, '${query}') or startsWith(givenName, '${query}') or startsWith(surname, '${query}')`
  );

  const url = `https://graph.microsoft.com/v1.0/users?$filter=${filter}&$top=10&$select=id,displayName,givenName,surname,mail,userPrincipalName`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Graph API error: ${response.status} ${errorText}`);
  }

  const data = await response.json() as GraphSearchResponse;

  return data.value.map((user) => ({
    id: user.id,
    displayName: user.displayName,
    givenName: user.givenName ?? null,
    surname: user.surname ?? null,
    mail: user.mail ?? null,
    userPrincipalName: user.userPrincipalName,
  }));
};

export const searchAzureAdUsersHandler = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  try {
    const query = request.query.get('q') || request.query.get('query') || '';

    if (!query || query.trim().length < 2) {
      return json({ items: [], message: 'Query must be at least 2 characters' }, 200);
    }

    const sanitizedQuery = query.trim().replace(/'/g, "''"); // Escape single quotes for OData

    const accessToken = await getGraphAccessToken();
    const users = await searchGraphUsers(sanitizedQuery, accessToken);

    return json({ items: users }, 200);
  } catch (error) {
    context.error('Failed to search Azure AD users', error);
    return json(buildErrorResponse('Failed to search Azure AD users', error), 500);
  }
};

// Register route
app.http('searchAzureAdUsers', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'azure-ad/users/search',
  handler: searchAzureAdUsersHandler,
});

export default searchAzureAdUsersHandler;
