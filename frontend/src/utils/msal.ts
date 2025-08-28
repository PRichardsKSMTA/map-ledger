import { PublicClientApplication, Configuration, RedirectRequest } from '@azure/msal-browser';
import { env } from './env';

export const msalConfig: Configuration = {
  auth: {
    clientId: env.AAD_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${env.AAD_TENANT_ID}`,
    redirectUri: env.AAD_REDIRECT_URI,
  },
};

export const msalInstance = new PublicClientApplication(msalConfig);

export const loginRequest: RedirectRequest = {
  scopes: ['openid', 'profile', 'email'],
};
