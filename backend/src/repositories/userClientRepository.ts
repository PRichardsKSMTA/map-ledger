import { runQuery } from '../utils/sqlClient';

const logPrefix = '[userClientRepository]';

const logDebug = (...args: unknown[]) => {
  if (process.env.NODE_ENV === 'test') {
    return;
  }
  // eslint-disable-next-line no-console
  console.debug(logPrefix, ...args);
};

const logInfo = (...args: unknown[]) => {
  if (process.env.NODE_ENV === 'test') {
    return;
  }
  // eslint-disable-next-line no-console
  console.info(logPrefix, ...args);
};

const logWarn = (...args: unknown[]) => {
  if (process.env.NODE_ENV === 'test') {
    return;
  }
  // eslint-disable-next-line no-console
  console.warn(logPrefix, ...args);
};

const logError = (...args: unknown[]) => {
  if (process.env.NODE_ENV === 'test') {
    return;
  }
  // eslint-disable-next-line no-console
  console.error(logPrefix, ...args);
};

export interface UserClientOperation {
  id: string;
  code: string;
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

export interface UserClientMappingSummary {
  totalAccounts: number;
  mappedAccounts: number;
}

export interface UserClientAccess {
  clientId: string;
  clientName: string;
  clientScac: string | null;
  companies: UserClientCompany[];
  metadata: UserClientMetadata;
  mappingSummary: UserClientMappingSummary;
}

export interface UserClientAccessResult {
  userEmail: string;
  userName: string | null;
  clients: UserClientAccess[];
}

type RawRow = Record<string, unknown>;

type ValueExtractor = (row: RawRow) => string | null;

type MappingSummaryRow = {
  client_id: string | number | null;
  total_accounts?: number | string | null;
  mapped_accounts?: number | string | null;
};

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

const extractClientScac = createValueExtractor([
  'client_scac',
  'clientscac',
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

const extractOperationalScac = createValueExtractor([
  'operational_scac',
]);

const extractOperationName = createValueExtractor([
  'operation_name',
  'operationname',
  'operation',
]);

const extractOperationCode = createValueExtractor([
  'operation_cd',
  'operation_code',
  'operationcode',
]);

const extractOperationId = createValueExtractor([
  'operation_id',
  'operationid',
  'operation_code',
  'operationcode',
]);

const extractEntityId = createValueExtractor([
  'entity_id',
  'entityid',
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

const extractMappingStatus = createValueExtractor([
  'mapping_status',
  'mappingstatus',
  'mapping_state',
  'mappingstate',
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

const normalizeLowerValue = (value: string | null): string | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.toLowerCase() : null;
};

const isUnmappedStatus = (value: string | null): boolean => {
  const normalized = normalizeLowerValue(value);
  return normalized === 'unmapped' || normalized === 'new';
};

const isMappedStatus = (value: string | null): boolean => {
  const normalized = normalizeLowerValue(value);
  return normalized === 'mapped' || normalized === 'excluded';
};

const isExcludedMappingType = (value: string | null): boolean => {
  const normalized = normalizeLowerValue(value);
  return normalized === 'exclude' || normalized === 'excluded';
};

const isMappedForSummary = (
  mappingStatus: string | null,
  mappingType: string | null,
  targetSCoA: string | null,
  preset: string | null,
  exclusion: string | null
): boolean => {
  if (isUnmappedStatus(mappingStatus)) {
    return false;
  }
  return (
    isMappedStatus(mappingStatus) ||
    isExcludedMappingType(mappingType) ||
    Boolean(targetSCoA || preset || exclusion)
  );
};

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

const toNumber = (value: unknown): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const hasSqlConfiguration = (): boolean =>
  Boolean(
    process.env.SQL_CONN_STR ||
      process.env.SQL_CONNECTION_STRING ||
      process.env.SQL_CONN_STRINGS ||
      process.env.SQL_CONN_STRING ||
      (process.env.SQL_SERVER &&
        process.env.SQL_DATABASE &&
        (process.env.SQL_USERNAME || process.env.SQL_USER) &&
        process.env.SQL_PASSWORD)
  );

const deriveEmailVariants = (candidate: string): string[] => {
  const aliases: Record<string, string[]> = {
    'ksmcpa.com': ['ksmta.com'],
    'ksmta.com': ['ksmcpa.com'],
  };

  const baseMatch = candidate.match(/^([^@]+)@([^@]+)$/);
  if (!baseMatch) {
    return [candidate];
  }

  const [, localPart, domain] = baseMatch;
  const variantDomains = aliases[domain] ?? [];
  const variants = new Set<string>([candidate]);

  variantDomains.forEach((variantDomain) => {
    variants.add(`${localPart}@${variantDomain}`);
  });

  return Array.from(variants);
};

const buildClientMappingSummaryLookup = async (
  clientIds: string[]
): Promise<Map<string, UserClientMappingSummary>> => {
  const normalizedClientIds = Array.from(
    new Set(
      clientIds.map((clientId) => clientId.trim()).filter((clientId) => clientId.length > 0)
    )
  );

  if (normalizedClientIds.length === 0) {
    return new Map();
  }

  const params: Record<string, unknown> = {};
  const clientParams = normalizedClientIds.map((clientId, index) => {
    const key = `clientId${index}`;
    params[key] = clientId;
    return `@${key}`;
  });

  const result = await runQuery<MappingSummaryRow>(
    [
      'WITH RankedRecords AS (',
      '  SELECT',
      '    cf.CLIENT_ID as client_id,',
      '    fr.ENTITY_ID as entity_id,',
      '    fr.ACCOUNT_ID as account_id,',
      '    fr.GL_MONTH as gl_month,',
      '    ROW_NUMBER() OVER (',
      '      PARTITION BY cf.CLIENT_ID, fr.ENTITY_ID, fr.ACCOUNT_ID, fr.GL_MONTH',
      '      ORDER BY COALESCE(cf.LAST_STEP_COMPLETED_DTTM, cf.INSERTED_DTTM, fr.INSERTED_DTTM) DESC,',
      '               fr.INSERTED_DTTM DESC,',
      '               fr.FILE_UPLOAD_GUID DESC,',
      '               fr.RECORD_ID DESC',
      '    ) as rn',
      '  FROM ml.FILE_RECORDS fr',
      '  INNER JOIN ml.CLIENT_FILES cf ON cf.FILE_UPLOAD_GUID = fr.FILE_UPLOAD_GUID',
      `  WHERE cf.IS_DELETED = 0 AND cf.CLIENT_ID IN (${clientParams.join(', ')})`,
      '),',
      'LatestRecords AS (',
      '  SELECT client_id, entity_id, account_id, gl_month',
      '  FROM RankedRecords',
      '  WHERE rn = 1',
      '),',
      'RecordsWithMappings AS (',
      '  SELECT',
      '    lr.client_id,',
      '    lr.entity_id,',
      '    lr.account_id,',
      '    lr.gl_month,',
      '    eam.MAPPING_STATUS as mapping_status,',
      '    eam.MAPPING_TYPE as mapping_type,',
      '    eam.PRESET_GUID as preset_id,',
      '    eam.EXCLUSION_PCT as exclusion_pct',
      '  FROM LatestRecords lr',
      '  OUTER APPLY (',
      '    SELECT TOP 1',
      '      eam.MAPPING_STATUS,',
      '      eam.MAPPING_TYPE,',
      '      eam.PRESET_GUID,',
      '      eam.EXCLUSION_PCT,',
      '      eam.GL_MONTH,',
      '      eam.UPDATED_DTTM',
      '    FROM ml.ENTITY_ACCOUNT_MAPPING eam',
      '    WHERE eam.ENTITY_ACCOUNT_ID = lr.account_id',
      '      AND (eam.ENTITY_ID = lr.entity_id OR lr.entity_id IS NULL)',
      '      AND (eam.GL_MONTH = lr.gl_month OR eam.GL_MONTH IS NULL)',
      '    ORDER BY CASE WHEN eam.GL_MONTH = lr.gl_month THEN 0 ELSE 1 END, eam.UPDATED_DTTM DESC',
      '  ) eam',
      ')',
      'SELECT',
      '  client_id,',
      '  COUNT(1) as total_accounts,',
      '  SUM(CASE',
      "        WHEN LOWER(COALESCE(mapping_status, '')) IN ('unmapped', 'new') THEN 0",
      "        WHEN LOWER(COALESCE(mapping_status, '')) IN ('mapped', 'excluded') THEN 1",
      "        WHEN LOWER(COALESCE(mapping_type, '')) IN ('exclude', 'excluded') THEN 1",
      '        WHEN preset_id IS NOT NULL THEN 1',
      '        WHEN exclusion_pct IS NOT NULL THEN 1',
      '        ELSE 0',
      '      END) as mapped_accounts',
      'FROM RecordsWithMappings',
      'GROUP BY client_id',
    ].join(' '),
    params
  );

  const summaries = new Map<string, UserClientMappingSummary>();
  (result.recordset ?? []).forEach((row) => {
    const rawClientId = row.client_id;
    const normalizedClientId = rawClientId !== null && rawClientId !== undefined
      ? String(rawClientId).trim()
      : '';
    if (!normalizedClientId) {
      return;
    }

    summaries.set(normalizedClientId, {
      totalAccounts: toNumber(row.total_accounts),
      mappedAccounts: toNumber(row.mapped_accounts),
    });
  });

  return summaries;
};

type CompanyAggregate = {
  companyId: string;
  companyName: string;
  operations: Map<string, UserClientOperation>;
};

type ClientAggregate = {
  clientId: string;
  clientIdGenerated: boolean;
  clientName: string;
  clientScac: string | null;
  companies: Map<string, CompanyAggregate>;
  metadata: {
    sourceAccounts: Map<string, UserClientSourceAccount>;
    reportingPeriods: Set<string>;
    mappingTypes: Set<string>;
    targetSCoAs: Set<string>;
    polarities: Set<string>;
    presets: Set<string>;
    exclusions: Set<string>;
  };
  mappingSummary: {
    totalAccountKeys: Set<string>;
    mappedAccountKeys: Set<string>;
  };
};

export const fetchUserClientAccess = async (
  email: string
): Promise<UserClientAccessResult> => {
  const normalizedEmail = email.trim().toLowerCase();

  logInfo('Fetching user client access', { normalizedEmail });

  if (!hasSqlConfiguration()) {
    logError('SQL configuration is missing; cannot fetch user client access');
    throw new Error('SQL configuration is required to fetch user client access');
  }

  try {
    const emailVariants = deriveEmailVariants(normalizedEmail);
    logDebug('Derived email variants for lookup', { emailVariants });

    logDebug('Executing user client access query', { normalizedEmail });

    // Optimized query: Only fetch client/operation data without the expensive mapping detail join.
    // The mapping summary counts are fetched separately via buildClientMappingSummaryLookup.
    // This reduces the result set from ~130K+ rows to ~100-200 rows (one per client/operation).
    const { recordset = [] } = await runQuery<RawRow>(
      [
        'SELECT DISTINCT',
        '  ops.CLIENT_ID, ops.CLIENT_NAME, ops.CLIENT_SCAC, ops.OPERATIONAL_SCAC, ops.OPERATION_CD, ops.OPERATION_NAME',
        'FROM ML.V_CLIENT_OPERATIONS ops',
        'ORDER BY ops.CLIENT_NAME ASC',
      ].join(' '),
      {}
    );

    logInfo('Successfully executed user client access query', {
      rowCount: recordset.length,
    });
    if (recordset.length > 0) {
      logDebug('User client access query results sample', {
        firstRow: recordset[0],
      });
    }

    const clientAggregates = new Map<string, ClientAggregate>();
    let discoveredUserName: string | null = null;

    recordset.forEach((row: RawRow, rowIndex: number) => {
      const clientName = extractClientName(row);
      if (!clientName) {
        return;
      }

      const clientScac = extractClientScac(row);
      const rawClientId = extractClientId(row);
      const clientId = normalizeIdentifier(
        rawClientId,
        clientName,
        `client-${rowIndex}`
      );

      const clientKey = clientName.trim().toLowerCase();
      if (!clientAggregates.has(clientKey)) {
        clientAggregates.set(clientKey, {
          clientId,
          clientIdGenerated: !rawClientId,
          clientName,
          clientScac: clientScac || null,
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
          mappingSummary: {
            totalAccountKeys: new Set(),
            mappedAccountKeys: new Set(),
          },
        });
      }

      const aggregate = clientAggregates.get(clientKey)!;

      if (aggregate.clientIdGenerated && rawClientId) {
        aggregate.clientId = clientId;
        aggregate.clientIdGenerated = false;
      }

      if (!aggregate.clientScac && clientScac) {
        aggregate.clientScac = clientScac;
      }

      const operationalScac = extractOperationalScac(row);
      const companyName =
        extractCompanyName(row) || operationalScac || clientScac || clientName;
      const companyId = normalizeIdentifier(
        extractCompanyId(row) || operationalScac || clientScac,
        companyName,
        `company-${rowIndex}`
      );

      if (!aggregate.companies.has(companyId)) {
        aggregate.companies.set(companyId, {
          companyId,
          companyName,
          operations: new Map(),
        });
      }

      const operationName = extractOperationName(row);
      const operationCode = extractOperationCode(row);
      const operationIdentifier = normalizeIdentifier(
        operationCode || extractOperationId(row),
        operationName || operationCode,
        `operation-${rowIndex}`
      );

      if (operationName || operationCode) {
        const company = aggregate.companies.get(companyId)!;
        if (!company.operations.has(operationIdentifier)) {
          company.operations.set(operationIdentifier, {
            id: operationIdentifier,
            code: operationCode || operationIdentifier,
            name: operationName || operationCode || operationIdentifier,
          });
        }
      }

      // Note: Metadata fields (sourceAccounts, reportingPeriods, etc.) are no longer populated
      // from this query to avoid the expensive V_CLIENT_MAPPING_DETAIL join. These fields remain
      // empty but are still included in the response for API compatibility. The mapping summary
      // counts are still fetched via buildClientMappingSummaryLookup below.
    });

    let mappingSummaryLookup = new Map<string, UserClientMappingSummary>();
    const clientIdsForSummary: string[] = [];
    clientAggregates.forEach((aggregate) => {
      if (!aggregate.clientIdGenerated && aggregate.clientId.trim().length > 0) {
        clientIdsForSummary.push(aggregate.clientId);
      }
    });

    if (clientIdsForSummary.length > 0) {
      try {
        mappingSummaryLookup = await buildClientMappingSummaryLookup(
          clientIdsForSummary
        );
      } catch (error) {
        logWarn('Failed to load mapping summary counts; using inline aggregation', error);
      }
    }

    const clients: UserClientAccess[] = Array.from(clientAggregates.values()).map(
      (aggregate) => {
        const mappedSummaryOverride = mappingSummaryLookup.get(aggregate.clientId);
        const totalAccounts =
          mappedSummaryOverride?.totalAccounts ??
          aggregate.mappingSummary.totalAccountKeys.size;
        const mappedAccounts =
          mappedSummaryOverride?.mappedAccounts ??
          aggregate.mappingSummary.mappedAccountKeys.size;

        return {
          clientId: aggregate.clientId,
          clientName: aggregate.clientName,
          clientScac: aggregate.clientScac,
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
          mappingSummary: {
            totalAccounts,
            mappedAccounts,
          },
        };
      }
    );

    logInfo('Assembled user client access response', {
      clientCount: clients.length,
      normalizedEmail,
    });
    logDebug('Assembled user client access response details', {
      clientIds: clients.map((client) => client.clientId),
    });

    return {
      userEmail: normalizedEmail,
      userName: discoveredUserName,
      clients,
    };
  } catch (error) {
    logError('User client access retrieval failed', error);
    throw error;
  }
};

export default {
  fetchUserClientAccess,
};
