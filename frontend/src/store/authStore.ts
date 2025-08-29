import { create } from 'zustand';
import type { AccountInfo } from '@azure/msal-browser';

interface AuthState {
  account: AccountInfo | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isEmployee: boolean;
  isGuest: boolean;
  error: string | null;
  setAccount: (
    account: AccountInfo | null,
    flags?: { isAdmin: boolean; isEmployee: boolean; isGuest: boolean }
  ) => void;
  setError: (error: string | null) => void;
}

const initialFlags = {
  isAdmin: false,
  isEmployee: false,
  isGuest: true,
};

export const useAuthStore = create<AuthState>((set) => ({
  account: null,
  isAuthenticated: false,
  ...initialFlags,
  error: null,
  setAccount: (account, flags = initialFlags) =>
    set({ account, isAuthenticated: !!account, ...flags }),
  setError: (error) => set({ error }),
}));
