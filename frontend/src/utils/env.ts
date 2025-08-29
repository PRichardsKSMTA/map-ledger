export const env = {
  AAD_CLIENT_ID: import.meta.env.VITE_AAD_CLIENT_ID || '',
  AAD_TENANT_ID: import.meta.env.VITE_AAD_TENANT_ID || '',
  AAD_REDIRECT_URI: import.meta.env.VITE_AAD_REDIRECT_URI || '',
  AAD_ADMIN_GROUP_ID: import.meta.env.VITE_AAD_ADMIN_GROUP_ID || '',
  AAD_EMPLOYEE_DOMAINS: (import.meta.env.VITE_AAD_EMPLOYEE_DOMAINS || '')
    .split(',')
    .map((d: string) => d.trim())
    .filter(Boolean),
};
