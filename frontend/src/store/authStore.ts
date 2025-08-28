import { create } from 'zustand';
import type { AccountInfo } from '@azure/msal-browser';

interface AuthState {
  account: AccountInfo | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isEmployee: boolean;
  isGuest: boolean;
  setAccount: (
    account: AccountInfo | null,
    flags?: { isAdmin: boolean; isEmployee: boolean; isGuest: boolean }
  ) => void;
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
  setAccount: (account, flags = initialFlags) =>
    set({ account, isAuthenticated: !!account, ...flags }),
}));
