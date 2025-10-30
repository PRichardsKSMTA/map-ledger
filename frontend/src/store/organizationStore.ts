import { create } from 'zustand';
import type {
  DatapointConfiguration,
  UserClientAccess,
  UserClientMetadata,
} from '../types';

export interface Operation {
  id: string;
  name: string;
}

export interface ClientMetadata {
  sourceAccounts: {
    id: string;
    name: string;
    description: string | null;
  }[];
  reportingPeriods: string[];
  mappingTypes: string[];
  targetSCoAs: string[];
  polarities: string[];
  presets: string[];
  exclusions: string[];
}

export interface Client {
  id: string;
  name: string;
  operations: Operation[];
  metadata: ClientMetadata;
}

export interface Company {
  id: string;
  name: string;
  clients: Client[];
}

interface OrganizationState {
  companies: Company[];
  clientAccess: UserClientAccess[];
  configsByClient: Record<string, DatapointConfiguration[]>;
  currentEmail: string | null;
  isLoading: boolean;
  error: string | null;
  fetchForUser: (email: string) => Promise<void>;
  setClientConfigurations: (
    clientId: string,
    configs: DatapointConfiguration[]
  ) => void;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

const shouldLog =
  import.meta.env.DEV ||
  (typeof import.meta.env.VITE_ENABLE_DEBUG_LOGGING === 'string' &&
    import.meta.env.VITE_ENABLE_DEBUG_LOGGING.toLowerCase() === 'true');

const logPrefix = '[OrganizationStore]';

const logDebug = (...args: unknown[]) => {
  if (!shouldLog) {
    return;
  }
  // eslint-disable-next-line no-console
  console.debug(logPrefix, ...args);
};

const logInfo = (...args: unknown[]) => {
  if (!shouldLog) {
    return;
  }
  // eslint-disable-next-line no-console
  console.info(logPrefix, ...args);
};

const logWarn = (...args: unknown[]) => {
  if (!shouldLog) {
    return;
  }
  // eslint-disable-next-line no-console
  console.warn(logPrefix, ...args);
};

const logError = (...args: unknown[]) => {
  if (!shouldLog) {
    return;
  }
  // eslint-disable-next-line no-console
  console.error(logPrefix, ...args);
};

const mergeMetadata = (
  existing: ClientMetadata | undefined,
  incoming: UserClientMetadata
): ClientMetadata => {
  const uniqueStrings = (values: string[]) =>
    Array.from(new Set(values.filter((value) => value && value.length > 0))).sort(
      (a, b) => a.localeCompare(b)
    );

  const mergeSourceAccounts = (
    previous: ClientMetadata['sourceAccounts'],
    next: ClientMetadata['sourceAccounts']
  ) => {
    const map = new Map<string, ClientMetadata['sourceAccounts'][number]>();
    previous.forEach((account) => {
      map.set(account.id || account.name, account);
    });
    next.forEach((account) => {
      map.set(account.id || account.name, account);
    });
    return Array.from(map.values());
  };

  if (!existing) {
    return {
      sourceAccounts: incoming.sourceAccounts.map((account) => ({ ...account })),
      reportingPeriods: uniqueStrings(incoming.reportingPeriods),
      mappingTypes: uniqueStrings(incoming.mappingTypes),
      targetSCoAs: uniqueStrings(incoming.targetSCoAs),
      polarities: uniqueStrings(incoming.polarities),
      presets: uniqueStrings(incoming.presets),
      exclusions: uniqueStrings(incoming.exclusions),
    };
  }

  return {
    sourceAccounts: mergeSourceAccounts(
      existing.sourceAccounts,
      incoming.sourceAccounts as ClientMetadata['sourceAccounts']
    ),
    reportingPeriods: uniqueStrings(
      existing.reportingPeriods.concat(incoming.reportingPeriods)
    ),
    mappingTypes: uniqueStrings(
      existing.mappingTypes.concat(incoming.mappingTypes)
    ),
    targetSCoAs: uniqueStrings(
      existing.targetSCoAs.concat(incoming.targetSCoAs)
    ),
    polarities: uniqueStrings(existing.polarities.concat(incoming.polarities)),
    presets: uniqueStrings(existing.presets.concat(incoming.presets)),
    exclusions: uniqueStrings(existing.exclusions.concat(incoming.exclusions)),
  };
};

export const deriveCompaniesFromAccessList = (
  accessList: UserClientAccess[]
): Company[] => {
  const companyMap = new Map<string, Company>();

  accessList.forEach((clientAccess) => {
    const associatedCompanies =
      clientAccess.companies.length > 0
        ? clientAccess.companies
        : [
            {
              companyId: `${clientAccess.clientId}-default`,
              companyName: clientAccess.clientName,
              operations: [],
            },
          ];

    associatedCompanies.forEach((company) => {
      const companyId = company.companyId || `${clientAccess.clientId}-default`;
      const companyName = company.companyName || companyId;
      const existingCompany = companyMap.get(companyId);
      const normalizedOperations: Operation[] = (company.operations ?? []).map((op) => ({
        id: op.id || op.name,
        name: op.name,
      }));

      if (!existingCompany) {
        companyMap.set(companyId, {
          id: companyId,
          name: companyName,
          clients: [
            {
              id: clientAccess.clientId,
              name: clientAccess.clientName,
              operations: normalizedOperations,
              metadata: mergeMetadata(undefined, clientAccess.metadata),
            },
          ],
        });
        return;
      }

      const clientIndex = existingCompany.clients.findIndex(
        (client) => client.id === clientAccess.clientId
      );

      if (clientIndex === -1) {
        existingCompany.clients.push({
          id: clientAccess.clientId,
          name: clientAccess.clientName,
          operations: normalizedOperations,
          metadata: mergeMetadata(undefined, clientAccess.metadata),
        });
        return;
      }

      const client = existingCompany.clients[clientIndex];
      const opMap = new Map<string, Operation>();
      client.operations.forEach((op) => opMap.set(op.id, op));
      normalizedOperations.forEach((op) => {
        if (!opMap.has(op.id)) {
          opMap.set(op.id, op);
        }
      });

      existingCompany.clients[clientIndex] = {
        ...client,
        operations: Array.from(opMap.values()),
        metadata: mergeMetadata(client.metadata, clientAccess.metadata),
      };
    });
  });

  return Array.from(companyMap.values());
};

export const useOrganizationStore = create<OrganizationState>((set, get) => ({
  companies: [],
  clientAccess: [],
  configsByClient: {},
  currentEmail: null,
  isLoading: false,
  error: null,
  fetchForUser: async (email: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const state = get();
    logDebug('fetchForUser invoked', {
      providedEmail: email,
      normalizedEmail,
      currentEmail: state.currentEmail,
      isLoading: state.isLoading,
      cachedAccessCount: state.clientAccess.length,
    });
    if (
      (state.isLoading && state.currentEmail === normalizedEmail) ||
      (state.currentEmail === normalizedEmail && state.clientAccess.length > 0)
    ) {
      logInfo('Skipping fetch because data is already loading or cached', {
        normalizedEmail,
        isLoading: state.isLoading,
        cachedAccessCount: state.clientAccess.length,
      });
      return;
    }

    logInfo('Starting fetch for user clients', {
      normalizedEmail,
      apiBaseUrl: API_BASE_URL,
    });
    set({ isLoading: true, error: null });

    try {
      const response = await fetch(
        `${API_BASE_URL}/user-clients?email=${encodeURIComponent(normalizedEmail)}`,
        {
          headers: {
            Accept: 'application/json',
          },
        }
      );

      logDebug('Received response from user-clients endpoint', {
        status: response.status,
        ok: response.ok,
        statusText: response.statusText,
      });

      if (!response.ok) {
        logWarn('User clients fetch returned a non-OK status', {
          status: response.status,
          statusText: response.statusText,
        });
        throw new Error(`Failed to load clients (${response.status})`);
      }

      const data = (await response.json()) as {
        clients?: UserClientAccess[];
      };

      logDebug('Parsed user clients payload', {
        hasClientsArray: Array.isArray(data.clients),
        clientCount: Array.isArray(data.clients) ? data.clients.length : 0,
      });

      const accessList = Array.isArray(data.clients) ? data.clients : [];
      const derivedCompanies = deriveCompaniesFromAccessList(accessList);
      logInfo('Successfully processed user clients response', {
        normalizedEmail,
        clientAccessCount: accessList.length,
        companyCount: derivedCompanies.length,
      });
      set({
        companies: derivedCompanies,
        clientAccess: accessList,
        currentEmail: normalizedEmail,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      logError('Failed to fetch user clients', error);
      set({
        companies: [],
        clientAccess: [],
        isLoading: false,
        currentEmail: null,
        error: error instanceof Error ? error.message : 'Failed to load clients',
      });
    }
  },
  setClientConfigurations: (clientId, configs) => {
    set((state) => ({
      configsByClient: {
        ...state.configsByClient,
        [clientId]: configs,
      },
    }));
  },
}));
