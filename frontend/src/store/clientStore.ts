import { create } from 'zustand';
import type { ClientProfile, UserClientAccess, UserClientCompany, UserClientOperation } from '../types';
import { checkClientFMStatistics, refreshFMStatistics } from '../services/clientOperationalStatsService';

type FMCheckStatus = 'idle' | 'checking' | 'refreshing' | 'completed' | 'error';

interface FMCheckState {
  status: FMCheckStatus;
  hasFMStatistics: boolean;
  error: string | null;
}

interface ClientState {
  clients: ClientProfile[];
  activeClientId: string | null;
  isLoading: boolean;
  error: string | null;
  // FM statistics background check state
  fmCheckState: Record<string, FMCheckState>;
  hydrateFromAccessList: (accessList: UserClientAccess[], activeClientId?: string | null) => void;
  setActiveClientId: (clientId: string | null) => void;
  upsertClient: (client: ClientProfile) => void;
  checkAndRefreshFMStatistics: (clientId: string, scac: string | null | undefined) => void;
  reset: () => void;
}

const normalizeClientId = (clientId?: string | null): string | null => {
  if (clientId == null) {
    return null;
  }

  const normalizedInput = typeof clientId === 'string' ? clientId : String(clientId);
  const trimmed = normalizedInput.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const storageKey = 'map-ledger-active-client';

const getStoredActiveClientId = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return normalizeClientId(window.localStorage.getItem(storageKey));
  } catch (error) {
    console.warn('Unable to read stored active client:', error);
    return null;
  }
};

const persistActiveClientId = (clientId: string | null): void => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (clientId) {
      window.localStorage.setItem(storageKey, clientId);
    } else {
      window.localStorage.removeItem(storageKey);
    }
  } catch (error) {
    console.warn('Unable to persist active client:', error);
  }
};

const initialState: Pick<ClientState, 'clients' | 'activeClientId' | 'isLoading' | 'error' | 'fmCheckState'> = {
  clients: [],
  activeClientId: getStoredActiveClientId(),
  isLoading: false,
  error: null,
  fmCheckState: {},
};

const normalizeOperation = (operation: UserClientOperation): UserClientOperation => {
  const id = operation.id || operation.code || operation.name;
  const code = operation.code || id;
  const name = operation.name || code || id;
  return {
    id: id ?? crypto.randomUUID(),
    code: code ?? 'OP',
    name: name ?? 'Operation',
    operationalScac: operation.operationalScac ?? null,
    isActive: operation.isActive,
  } satisfies UserClientOperation;
};

const extractOperations = (companies: UserClientCompany[]): UserClientOperation[] => {
  const operations = new Map<string, UserClientOperation>();
  companies.forEach(company => {
    (company.operations ?? []).forEach(operation => {
      const normalized = normalizeOperation(operation);
      if (!operations.has(normalized.id)) {
        operations.set(normalized.id, normalized);
      }
    });
  });

  return Array.from(operations.values());
};

const toClientProfile = (access: UserClientAccess): ClientProfile => {
  const normalizedOperations = (access.operations ?? []).map(normalizeOperation);
  const companyOperations = extractOperations(access.companies ?? []);
  const operations = normalizedOperations.length > 0 ? normalizedOperations : companyOperations;

  return {
    id: access.clientId,
    clientId: access.clientId,
    name: access.clientName,
    scac: access.clientScac ?? null,
    operations,
  } satisfies ClientProfile;
};

export const useClientStore = create<ClientState>((set, get) => ({
  ...initialState,
  hydrateFromAccessList: (accessList, activeClientId) => {
    try {
      const mappedClients = accessList.map(toClientProfile);
      const preferredClientId = normalizeClientId(activeClientId ?? get().activeClientId);
      const resolvedActiveClientId =
        preferredClientId && mappedClients.some(client => client.clientId === preferredClientId)
          ? preferredClientId
          : mappedClients[0]?.clientId ?? null;

      set({
        clients: mappedClients,
        activeClientId: resolvedActiveClientId,
        isLoading: false,
        error: null,
      });
      persistActiveClientId(resolvedActiveClientId);

      // Trigger FM statistics check for the active client in the background
      if (resolvedActiveClientId) {
        const activeClient = mappedClients.find(c => c.clientId === resolvedActiveClientId);
        if (activeClient) {
          // Use setTimeout to ensure the state is fully set before triggering the check
          setTimeout(() => {
            get().checkAndRefreshFMStatistics(resolvedActiveClientId, activeClient.scac);
          }, 0);
        }
      }
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to hydrate clients',
      });
    }
  },
  setActiveClientId: (clientId) => {
    const normalized = normalizeClientId(clientId);
    const { clients, activeClientId } = get();
    const nextActiveClientId =
      normalized === null
        ? clients[0]?.clientId ?? null
        : clients.some(client => client.clientId === normalized)
        ? normalized
        : activeClientId;

    set({ activeClientId: nextActiveClientId });
    persistActiveClientId(nextActiveClientId ?? null);

    // Trigger FM statistics check for the newly selected client in the background
    if (nextActiveClientId && nextActiveClientId !== activeClientId) {
      const nextClient = clients.find(c => c.clientId === nextActiveClientId);
      if (nextClient) {
        // Use setTimeout to ensure the state is fully set before triggering the check
        setTimeout(() => {
          get().checkAndRefreshFMStatistics(nextActiveClientId, nextClient.scac);
        }, 0);
      }
    }
  },
  upsertClient: (client) =>
    set((state) => {
      const existingIndex = state.clients.findIndex(({ clientId }) => clientId === client.clientId);
      if (existingIndex === -1) {
        return { clients: [...state.clients, client] };
      }

      const nextClients = [...state.clients];
      nextClients[existingIndex] = client;
      return { clients: nextClients };
    }),
  checkAndRefreshFMStatistics: (clientId, scac) => {
    // Need both clientId (for state tracking) and scac (for the actual check)
    if (!clientId || !scac) {
      return;
    }

    const currentState = get().fmCheckState[clientId];
    // Skip if already checking, refreshing, or completed
    if (currentState?.status === 'checking' || currentState?.status === 'refreshing' || currentState?.status === 'completed') {
      return;
    }

    // Set status to checking
    set((state) => ({
      fmCheckState: {
        ...state.fmCheckState,
        [clientId]: { status: 'checking', hasFMStatistics: false, error: null },
      },
    }));

    // Run the check in the background using SCAC
    checkClientFMStatistics(scac)
      .then((result) => {
        if (result.hasFMStatistics) {
          // Client already has FM statistics, mark as completed
          set((state) => ({
            fmCheckState: {
              ...state.fmCheckState,
              [clientId]: { status: 'completed', hasFMStatistics: true, error: null },
            },
          }));
        } else {
          // No FM statistics, need to refresh - update status and trigger refresh
          set((state) => ({
            fmCheckState: {
              ...state.fmCheckState,
              [clientId]: { status: 'refreshing', hasFMStatistics: false, error: null },
            },
          }));

          refreshFMStatistics(scac)
            .then(() => {
              set((state) => ({
                fmCheckState: {
                  ...state.fmCheckState,
                  [clientId]: { status: 'completed', hasFMStatistics: true, error: null },
                },
              }));
            })
            .catch((refreshError) => {
              const message = refreshError instanceof Error ? refreshError.message : 'Failed to refresh FM statistics';
              set((state) => ({
                fmCheckState: {
                  ...state.fmCheckState,
                  [clientId]: { status: 'error', hasFMStatistics: false, error: message },
                },
              }));
            });
        }
      })
      .catch((checkError) => {
        const message = checkError instanceof Error ? checkError.message : 'Failed to check FM statistics';
        set((state) => ({
          fmCheckState: {
            ...state.fmCheckState,
            [clientId]: { status: 'error', hasFMStatistics: false, error: message },
          },
        }));
      });
  },
  reset: () => {
    persistActiveClientId(null);
    set({ ...initialState, activeClientId: null, fmCheckState: {} });
  },
}));
