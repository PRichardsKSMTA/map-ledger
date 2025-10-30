import { runQuery } from '../utils/sqlClient';

export interface UserClientOperation {
  id: string;
  name: string;
}

export interface UserClientCompany {
  companyId: string;
  companyName: string;
  operations: UserClientOperation[];
}

export interface UserClientSourceAccount {
  id: string;
  name: string;
  description: string | null;
}

export interface UserClientMetadata {
  sourceAccounts: UserClientSourceAccount[];
  reportingPeriods: string[];
  mappingTypes: string[];
  targetSCoAs: string[];
  polarities: string[];
  presets: string[];
  exclusions: string[];
}

export interface UserClientAccess {
  clientId: string;
  clientName: string;
  companies: UserClientCompany[];
  metadata: UserClientMetadata;
}

export interface UserClientAccessResult {
  userEmail: string;
  userName: string | null;
  clients: UserClientAccess[];
}

type RawRow = Record<string, unknown>;

type ValueExtractor = (row: RawRow) => string | null;

const createValueExtractor = (candidateKeys: string[]): ValueExtractor => {
  const normalizedKeys = candidateKeys.map((key) => key.toLowerCase());

  return (row: RawRow) => {
    for (const key of Object.keys(row)) {
      const normalized = key.toLowerCase();
      if (!normalizedKeys.includes(normalized)) {
        continue;
      }

      const rawValue = row[key];
      if (rawValue === null || rawValue === undefined) {
        continue;
      }

      if (typeof rawValue === 'string') {
        const trimmed = rawValue.trim();
        if (trimmed.length === 0) {
          continue;
        }
        return trimmed;
      }

      if (typeof rawValue === 'number' || typeof rawValue === 'boolean') {
        return String(rawValue);
      }
    }

    return null;
  };
};

const extractClientName = createValueExtractor([
  'client_name',
  'clientname',
  'client',
]);

const extractClientId = createValueExtractor([
  'client_id',
  'clientid',
  'client_code',
  'clientcode',
]);

const extractCompanyName = createValueExtractor([
  'company_name',
  'companyname',
  'company',
]);

const extractCompanyId = createValueExtractor([
  'company_id',
  'companyid',
  'company_code',
  'companycode',
]);

const extractOperationName = createValueExtractor([
  'operation_name',
  'operationname',
  'operation',
]);

const extractOperationId = createValueExtractor([
  'operation_id',
  'operationid',
  'operation_code',
  'operationcode',
]);

const extractSourceAccountId = createValueExtractor([
  'source_account_id',
  'sourceaccountid',
  'source_account_identifier',
]);

const extractSourceAccountName = createValueExtractor([
  'source_account_name',
  'sourceaccountname',
  'source_account',
]);

const extractSourceAccountDescription = createValueExtractor([
  'source_account_description',
  'sourceaccountdescription',
  'source_account_desc',
  'sourceaccountdesc',
]);

const extractReportingPeriod = createValueExtractor([
  'reporting_period',
  'reportingperiod',
  'period',
]);

const extractMappingType = createValueExtractor([
  'mapping_type',
  'mappingtype',
  'mapping_category',
]);

const extractTargetSCoA = createValueExtractor([
  'target_scoa',
  'targetscoa',
  'target_chart_of_accounts',
  'targetcoa',
]);

const extractPolarity = createValueExtractor([
  'polarity',
  'balance',
  'balance_type',
]);

const extractPreset = createValueExtractor([
  'preset',
  'preset_name',
  'configuration_preset',
]);

const extractExclusion = createValueExtractor([
  'exclusion',
  'exclusion_name',
  'exclusionreason',
  'exclusion_reason',
]);

const extractUserName = createValueExtractor([
  'user_name',
  'username',
  'user',
  'full_name',
]);

const normalizeIdentifier = (
  preferredValue: string | null,
  fallback: string | null,
  prefix: string
): string => {
  if (preferredValue && preferredValue.length > 0) {
    return preferredValue;
  }

  if (fallback && fallback.length > 0) {
    return fallback;
  }

  return `${prefix}-unknown`;
};

const uniqueStringArray = (values: Iterable<string>) =>
  Array.from(
    new Set(
      Array.from(values)
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    )
  ).sort((a, b) => a.localeCompare(b));

export const fetchUserClientAccess = async (
  email: string
): Promise<UserClientAccessResult> => {
  const { recordset = [] } = await runQuery<RawRow>(
    'SELECT * FROM dbo.V_USER_CLIENT_COMPANY_OPERATIONS WHERE EMAIL = @email',
    { email }
  );

  const clientAggregates = new Map<string, {
    clientId: string;
    clientName: string;
    companies: Map<
      string,
      {
        companyId: string;
        companyName: string;
        operations: Map<string, UserClientOperation>;
      }
    >;
    metadata: {
      sourceAccounts: Map<string, UserClientSourceAccount>;
      reportingPeriods: Set<string>;
      mappingTypes: Set<string>;
      targetSCoAs: Set<string>;
      polarities: Set<string>;
      presets: Set<string>;
      exclusions: Set<string>;
    };
  }>();

  let discoveredUserName: string | null = null;

  recordset.forEach((row: RawRow, rowIndex: number) => {
    const clientName = extractClientName(row);
    if (!clientName) {
      return;
    }

    const clientId = normalizeIdentifier(
      extractClientId(row),
      clientName,
      `client-${rowIndex}`
    );

    const clientKey = `${clientId}::${clientName}`;
    if (!clientAggregates.has(clientKey)) {
      clientAggregates.set(clientKey, {
        clientId,
        clientName,
        companies: new Map(),
        metadata: {
          sourceAccounts: new Map(),
          reportingPeriods: new Set(),
          mappingTypes: new Set(),
          targetSCoAs: new Set(),
          polarities: new Set(),
          presets: new Set(),
          exclusions: new Set(),
        },
      });
    }

    const aggregate = clientAggregates.get(clientKey)!;

    const companyName = extractCompanyName(row);
    const companyId = normalizeIdentifier(
      extractCompanyId(row),
      companyName,
      `company-${rowIndex}`
    );

    if (companyName) {
      if (!aggregate.companies.has(companyId)) {
        aggregate.companies.set(companyId, {
          companyId,
          companyName,
          operations: new Map(),
        });
      }

      const operationName = extractOperationName(row);
      if (operationName) {
        const operationId = normalizeIdentifier(
          extractOperationId(row),
          operationName,
          `operation-${rowIndex}`
        );
        const company = aggregate.companies.get(companyId)!;
        if (!company.operations.has(operationId)) {
          company.operations.set(operationId, {
            id: operationId,
            name: operationName,
          });
        }
      }
    }

    const sourceAccountId = extractSourceAccountId(row);
    const sourceAccountName = extractSourceAccountName(row);
    const sourceAccountDescription = extractSourceAccountDescription(row);
    if (sourceAccountId || sourceAccountName || sourceAccountDescription) {
      const key = sourceAccountId || sourceAccountName || `account-${rowIndex}`;
      if (!aggregate.metadata.sourceAccounts.has(key)) {
        aggregate.metadata.sourceAccounts.set(key, {
          id: sourceAccountId || key,
          name: sourceAccountName || sourceAccountId || key,
          description: sourceAccountDescription,
        });
      }
    }

    const reportingPeriod = extractReportingPeriod(row);
    if (reportingPeriod) {
      aggregate.metadata.reportingPeriods.add(reportingPeriod);
    }

    const mappingType = extractMappingType(row);
    if (mappingType) {
      aggregate.metadata.mappingTypes.add(mappingType);
    }

    const targetSCoA = extractTargetSCoA(row);
    if (targetSCoA) {
      aggregate.metadata.targetSCoAs.add(targetSCoA);
    }

    const polarity = extractPolarity(row);
    if (polarity) {
      aggregate.metadata.polarities.add(polarity);
    }

    const preset = extractPreset(row);
    if (preset) {
      aggregate.metadata.presets.add(preset);
    }

    const exclusion = extractExclusion(row);
    if (exclusion) {
      aggregate.metadata.exclusions.add(exclusion);
    }

    if (!discoveredUserName) {
      const maybeUserName = extractUserName(row);
      if (maybeUserName) {
        discoveredUserName = maybeUserName;
      }
    }
  });

  const clients: UserClientAccess[] = Array.from(clientAggregates.values()).map(
    (aggregate) => ({
      clientId: aggregate.clientId,
      clientName: aggregate.clientName,
      companies: Array.from(aggregate.companies.values()).map((company) => ({
        companyId: company.companyId,
        companyName: company.companyName,
        operations: Array.from(company.operations.values()),
      })),
      metadata: {
        sourceAccounts: Array.from(aggregate.metadata.sourceAccounts.values()),
        reportingPeriods: uniqueStringArray(aggregate.metadata.reportingPeriods),
        mappingTypes: uniqueStringArray(aggregate.metadata.mappingTypes),
        targetSCoAs: uniqueStringArray(aggregate.metadata.targetSCoAs),
        polarities: uniqueStringArray(aggregate.metadata.polarities),
        presets: uniqueStringArray(aggregate.metadata.presets),
        exclusions: uniqueStringArray(aggregate.metadata.exclusions),
      },
    })
  );

  return {
    userEmail: email,
    userName: discoveredUserName,
    clients,
  };
};
