import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Login from '../pages/Login';
import App from '../App';
import { useAuthStore } from '../store/authStore';

const mockLoginRedirect = jest.fn();
const mockHandleRedirectPromise = jest.fn();
const mockGetAllAccounts = jest.fn();
const mockSetActiveAccount = jest.fn();

jest.mock('@azure/msal-react', () => ({
  useMsal: () => ({
    instance: {
      loginRedirect: mockLoginRedirect,
    },
  }),
}));

jest.mock('../utils/msal', () => ({
  msalInstance: {
    handleRedirectPromise: mockHandleRedirectPromise,
    getAllAccounts: mockGetAllAccounts,
    setActiveAccount: mockSetActiveAccount,
  },
  loginRequest: { scopes: [] },
}));

jest.mock('../utils/env', () => ({
  env: {
    AAD_ADMIN_GROUP_ID: 'admin-group',
    AAD_EMPLOYEE_DOMAINS: ['example.com'],
    AAD_CLIENT_ID: 'client',
    AAD_TENANT_ID: 'tenant',
    AAD_REDIRECT_URI: 'http://localhost',
  },
}));

afterEach(() => {
  useAuthStore.setState({
    account: null,
    isAuthenticated: false,
    isAdmin: false,
    isEmployee: false,
    isGuest: true,
  });
  jest.clearAllMocks();
});

test('calls loginRedirect on sign in click', async () => {
  render(<Login />);
  await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
  expect(mockLoginRedirect).toHaveBeenCalled();
});

test('sets admin and employee flags from token', async () => {
  const account = {
    username: 'jane@example.com',
    idTokenClaims: { groups: ['admin-group'] },
  } as any;
  mockHandleRedirectPromise.mockResolvedValue({
    account,
    idTokenClaims: { groups: ['admin-group'] },
  });
  mockGetAllAccounts.mockReturnValue([account]);

  render(<App />);

  await waitFor(() => expect(useAuthStore.getState().isAuthenticated).toBe(true));
  expect(useAuthStore.getState().isAdmin).toBe(true);
  expect(useAuthStore.getState().isEmployee).toBe(true);
  expect(useAuthStore.getState().isGuest).toBe(false);
});

test('marks guest when domain not matched', async () => {
  const account = {
    username: 'bob@external.com',
    idTokenClaims: { groups: [] },
  } as any;
  mockHandleRedirectPromise.mockResolvedValue({
    account,
    idTokenClaims: { groups: [] },
  });
  mockGetAllAccounts.mockReturnValue([account]);

  render(<App />);

  await waitFor(() => expect(useAuthStore.getState().isAuthenticated).toBe(true));
  expect(useAuthStore.getState().isAdmin).toBe(false);
  expect(useAuthStore.getState().isEmployee).toBe(false);
  expect(useAuthStore.getState().isGuest).toBe(true);
});

test('redirects away from login when already authenticated', async () => {
  window.history.pushState({}, 'Test', '/login');
  useAuthStore.setState({
    account: {} as any,
    isAuthenticated: true,
    isAdmin: false,
    isEmployee: false,
    isGuest: false,
  });
  render(<App />);
  await waitFor(() => expect(window.location.pathname).toBe('/'));
});

