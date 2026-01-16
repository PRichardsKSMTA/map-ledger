import { create } from 'zustand';
import {
  listAppUsers,
  createAppUser,
  updateAppUser,
  deactivateAppUser,
  reactivateAppUser,
  deleteAppUser,
  searchAzureAdUsers,
  type AppUser,
  type AzureAdUser,
  type CreateAppUserInput,
  type UpdateAppUserInput,
} from '../services/appUserService';

interface AppUserState {
  users: AppUser[];
  isLoading: boolean;
  error: string | null;
  searchResults: AzureAdUser[];
  isSearching: boolean;
  showInactive: boolean;

  // Actions
  fetchUsers: () => Promise<void>;
  addUser: (input: CreateAppUserInput) => Promise<AppUser>;
  editUser: (userId: string, input: UpdateAppUserInput) => Promise<AppUser>;
  removeUser: (userId: string) => Promise<void>;
  restoreUser: (userId: string) => Promise<void>;
  searchUsers: (query: string) => Promise<void>;
  clearSearch: () => void;
  setShowInactive: (show: boolean) => void;
  clearError: () => void;
}

export const useAppUserStore = create<AppUserState>((set, get) => ({
  users: [],
  isLoading: false,
  error: null,
  searchResults: [],
  isSearching: false,
  showInactive: false,

  fetchUsers: async () => {
    set({ isLoading: true, error: null });
    try {
      const users = await listAppUsers(get().showInactive);
      set({ users, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch users',
        isLoading: false,
      });
    }
  },

  addUser: async (input: CreateAppUserInput) => {
    set({ error: null });
    try {
      const newUser = await createAppUser(input);
      set((state) => ({ users: [...state.users, newUser] }));
      return newUser;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add user';
      set({ error: message });
      throw error;
    }
  },

  editUser: async (userId: string, input: UpdateAppUserInput) => {
    set({ error: null });
    try {
      const updatedUser = await updateAppUser(userId, input);
      set((state) => ({
        users: state.users.map((u) => (u.id === userId ? updatedUser : u)),
      }));
      return updatedUser;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update user';
      set({ error: message });
      throw error;
    }
  },

  removeUser: async (userId: string) => {
    set({ error: null });
    try {
      await deleteAppUser(userId);
      set((state) => ({
        users: state.users.filter((u) => u.id !== userId),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove user';
      set({ error: message });
      throw error;
    }
  },

  restoreUser: async (userId: string) => {
    set({ error: null });
    try {
      const updatedUser = await reactivateAppUser(userId);
      set((state) => ({
        users: state.users.map((u) => (u.id === userId ? updatedUser : u)),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to restore user';
      set({ error: message });
      throw error;
    }
  },

  searchUsers: async (query: string) => {
    if (!query || query.trim().length < 2) {
      set({ searchResults: [], isSearching: false });
      return;
    }

    set({ isSearching: true });
    try {
      const results = await searchAzureAdUsers(query);
      set({ searchResults: results, isSearching: false });
    } catch (error) {
      set({ searchResults: [], isSearching: false });
    }
  },

  clearSearch: () => {
    set({ searchResults: [], isSearching: false });
  },

  setShowInactive: (show: boolean) => {
    set({ showInactive: show });
    get().fetchUsers();
  },

  clearError: () => {
    set({ error: null });
  },
}));
