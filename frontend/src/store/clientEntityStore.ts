import { create } from 'zustand';
import { ClientEntity } from '../types';
import { slugify } from '../utils/slugify';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

const shouldLog =
  import.meta.env.DEV ||
  (typeof import.meta.env.VITE_ENABLE_DEBUG_LOGGING === 'string' &&
    import.meta.env.VITE_ENABLE_DEBUG_LOGGING.toLowerCase() === 'true');

const logPrefix = '[ClientEntityStore]';

const logDebug = (...args: unknown[]) => {
  if (!shouldLog) {
    return;
  }
  // eslint-disable-next-line no-console
  console.debug(logPrefix, ...args);
};

const logError = (...args: unknown[]) => {
  if (!shouldLog) {
    return;
  }
  // eslint-disable-next-line no-console
  console.error(logPrefix, ...args);
};

interface ClientEntityState {
  entitiesByClient: Record<string, ClientEntity[]>;
  isLoading: boolean;
  error: string | null;
  fetchForClient: (clientId: string) => Promise<ClientEntity[]>;
  reset: () => void;
}

interface ClientEntityResponseItem {
  entityName: string;
  aliases?: string[] | string | null;
}

interface ClientEntityResponse {
  items?: ClientEntityResponseItem[];
}

const normalizeAliases = (value?: string[] | string | null): string[] => {
  if (!value) return [];
  const segments = Array.isArray(value)
    ? value
    : value
        .split(/[,;\n]/)
        .map((alias) => alias.trim())
        .filter(Boolean);

  return Array.from(new Set(segments.map((alias) => alias.trim())));
};

const toClientEntity = (item: ClientEntityResponseItem): ClientEntity => {
  const name = item.entityName?.trim() || 'Unnamed Entity';
  const id = slugify(name) || name;
  return {
    id,
    name,
    aliases: normalizeAliases(item.aliases),
  };
};

export const useClientEntityStore = create<ClientEntityState>((set, get) => ({
  entitiesByClient: {},
  isLoading: false,
  error: null,
  async fetchForClient(clientId) {
    if (!clientId) {
      return [];
    }

    const cached = get().entitiesByClient[clientId];
    if (cached && cached.length > 0) {
      logDebug('Using cached entities for client', clientId);
      return cached;
    }

    set({ isLoading: true, error: null });

    try {
      const response = await fetch(
        `${API_BASE_URL}/client-entities?clientId=${encodeURIComponent(clientId)}`,
        {
          headers: { Accept: 'application/json' },
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to load client entities (${response.status})`);
      }

      const payload = (await response.json()) as ClientEntityResponse;
      const entities = (payload.items ?? []).map(toClientEntity);

      set((state) => ({
        entitiesByClient: { ...state.entitiesByClient, [clientId]: entities },
        isLoading: false,
        error: null,
      }));

      logDebug('Fetched client entities', { clientId, count: entities.length });
      return entities;
    } catch (error) {
      logError('Unable to load client entities', error);
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load entities',
      });
      return [];
    }
  },
  reset: () => set({ entitiesByClient: {}, isLoading: false, error: null }),
}));
