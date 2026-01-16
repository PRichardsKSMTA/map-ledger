import { env } from '../utils/env';

const API_BASE_URL = env.VITE_API_BASE_URL ?? '/api';

export type AppUserRole = 'super' | 'admin' | 'viewer';

export interface AppUser {
  id: string;
  aadUserId: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  role: AppUserRole;
  clientName: string | null;
  clientScac: string | null;
  monthlyClosingDate: number | null;
  isActive: boolean;
  surveyNotify: boolean;
  createdDttm: string;
  updatedDttm: string | null;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface AzureAdUser {
  id: string;
  displayName: string;
  givenName: string | null;
  surname: string | null;
  mail: string | null;
  userPrincipalName: string;
}

export interface CreateAppUserInput {
  aadUserId: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  role?: AppUserRole;
  createdBy?: string;
}

export interface UpdateAppUserInput {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  role?: AppUserRole;
  monthlyClosingDate?: number | null;
  surveyNotify?: boolean;
  isActive?: boolean;
  updatedBy?: string;
}

export const listAppUsers = async (includeInactive = false): Promise<AppUser[]> => {
  const url = new URL(`${API_BASE_URL}/app-users`, window.location.origin);
  if (includeInactive) {
    url.searchParams.set('includeInactive', 'true');
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error('Failed to fetch users');
  }

  const data = await response.json();
  return data.items ?? [];
};

export const getAppUser = async (userId: string): Promise<AppUser | null> => {
  const response = await fetch(`${API_BASE_URL}/app-users/${userId}`);
  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error('Failed to fetch user');
  }

  const data = await response.json();
  return data.item ?? null;
};

export const getCurrentAppUser = async (email?: string): Promise<AppUser | null> => {
  const url = new URL(`${API_BASE_URL}/app-users/me`, window.location.origin);
  if (email) {
    url.searchParams.set('email', email);
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error('Failed to fetch current user');
  }

  const data = await response.json();
  return data.item ?? null;
};

export const createAppUser = async (input: CreateAppUserInput): Promise<AppUser> => {
  const response = await fetch(`${API_BASE_URL}/app-users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || 'Failed to create user');
  }

  const data = await response.json();
  return data.item;
};

export const updateAppUser = async (userId: string, input: UpdateAppUserInput): Promise<AppUser> => {
  const response = await fetch(`${API_BASE_URL}/app-users/${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || 'Failed to update user');
  }

  const data = await response.json();
  return data.item;
};

export const deactivateAppUser = async (userId: string): Promise<AppUser> => {
  const response = await fetch(`${API_BASE_URL}/app-users/${userId}/deactivate`, {
    method: 'POST',
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || 'Failed to deactivate user');
  }

  const data = await response.json();
  return data.item;
};

export const reactivateAppUser = async (userId: string): Promise<AppUser> => {
  const response = await fetch(`${API_BASE_URL}/app-users/${userId}/reactivate`, {
    method: 'POST',
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || 'Failed to reactivate user');
  }

  const data = await response.json();
  return data.item;
};

export const deleteAppUser = async (userId: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/app-users/${userId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || 'Failed to delete user');
  }
};

export const searchAzureAdUsers = async (query: string): Promise<AzureAdUser[]> => {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const url = new URL(`${API_BASE_URL}/azure-ad/users/search`, window.location.origin);
  url.searchParams.set('q', query.trim());

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error('Failed to search users');
  }

  const data = await response.json();
  return data.items ?? [];
};

export default {
  listAppUsers,
  getAppUser,
  getCurrentAppUser,
  createAppUser,
  updateAppUser,
  deactivateAppUser,
  reactivateAppUser,
  deleteAppUser,
  searchAzureAdUsers,
};
