import { runQuery } from '../utils/sqlClient';

export interface ClientHeaderMappingRecord {
  clientId: string;
  templateHeader: string;
  sourceHeader: string;
  updatedAt?: string;
}

export interface ClientHeaderMappingInput {
  templateHeader: string;
  sourceHeader?: string | null;
}

const TABLE_NAME = 'ml.CLIENT_HEADER_MAPPING';
let tableEnsured = false;

const normalizeHeader = (value?: string | null): string | null => {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = value.toString().trim();
  return trimmed.length > 0 ? trimmed : null;
};

const ensureTable = async () => {
  if (tableEnsured) {
    return;
  }

  await runQuery(
    `IF NOT EXISTS (
      SELECT 1
      FROM sys.tables t
      JOIN sys.schemas s ON t.schema_id = s.schema_id
      WHERE t.name = 'CLIENT_HEADER_MAPPING' AND s.name = 'ml'
    )
    BEGIN
      CREATE TABLE ${TABLE_NAME} (
        CLIENT_ID NVARCHAR(128) NOT NULL,
        TEMPLATE_HEADER NVARCHAR(256) NOT NULL,
        SOURCE_HEADER NVARCHAR(256) NOT NULL,
        UPDATED_AT DATETIME2 NOT NULL CONSTRAINT DF_CLIENT_HEADER_MAPPING_UPDATED DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_CLIENT_HEADER_MAPPING PRIMARY KEY (CLIENT_ID, TEMPLATE_HEADER)
      );
    END`
  );

  tableEnsured = true;
};

type NormalizedMapping = {
  templateHeader: string;
  sourceHeader: string | null;
};

const normalizeMappings = (
  mappings: ClientHeaderMappingInput[]
): NormalizedMapping[] => {
  const unique = new Map<string, string | null>();

  mappings.forEach(({ templateHeader, sourceHeader }) => {
    const normalizedTemplate = normalizeHeader(templateHeader);
    const normalizedSource = normalizeHeader(sourceHeader ?? null);

    if (!normalizedTemplate) {
      return;
    }

    unique.set(normalizedTemplate, normalizedSource);
  });

  return Array.from(unique.entries()).map(([templateHeader, sourceHeader]) => ({
    templateHeader,
    sourceHeader,
  }));
};

const mapRowToRecord = (row: {
  client_id: string;
  template_header: string;
  source_header: string;
  updated_at?: Date | string | null;
}): ClientHeaderMappingRecord => ({
  clientId: row.client_id,
  templateHeader: row.template_header,
  sourceHeader: row.source_header,
  updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
});

export const listClientHeaderMappings = async (
  clientId: string
): Promise<ClientHeaderMappingRecord[]> => {
  if (!normalizeHeader(clientId)) {
    return [];
  }

  await ensureTable();

  const result = await runQuery<{
    client_id: string;
    template_header: string;
    source_header: string;
    updated_at?: Date | string | null;
  }>(
    `SELECT
      CLIENT_ID AS client_id,
      TEMPLATE_HEADER AS template_header,
      SOURCE_HEADER AS source_header,
      CASE
        WHEN COL_LENGTH('ml.CLIENT_HEADER_MAPPING', 'UPDATED_AT') IS NOT NULL THEN UPDATED_AT
        ELSE NULL
      END AS updated_at
    FROM ${TABLE_NAME}
    WHERE CLIENT_ID = @clientId
    ORDER BY TEMPLATE_HEADER ASC`,
    { clientId }
  );

  return (result.recordset ?? []).map(mapRowToRecord);
};

export const upsertClientHeaderMappings = async (
  clientId: string,
  mappings: ClientHeaderMappingInput[]
): Promise<ClientHeaderMappingRecord[]> => {
  const normalizedClientId = normalizeHeader(clientId);
  if (!normalizedClientId) {
    return [];
  }

  const normalizedMappings = normalizeMappings(mappings).filter(
    (mapping) => mapping.sourceHeader !== null
  );

  if (normalizedMappings.length === 0) {
    return listClientHeaderMappings(normalizedClientId);
  }

  await ensureTable();

  const params: Record<string, unknown> = {
    clientId: normalizedClientId,
  };

  const valuesClause = normalizedMappings
    .map((mapping, index) => {
      const templateKey = `templateHeader${index}`;
      const sourceKey = `sourceHeader${index}`;
      params[templateKey] = mapping.templateHeader;
      params[sourceKey] = mapping.sourceHeader;
      return `(@clientId, @${templateKey}, @${sourceKey})`;
    })
    .join(', ');

  await runQuery(
    `MERGE ${TABLE_NAME} AS target
    USING (VALUES ${valuesClause}) AS source (CLIENT_ID, TEMPLATE_HEADER, SOURCE_HEADER)
      ON target.CLIENT_ID = source.CLIENT_ID AND target.TEMPLATE_HEADER = source.TEMPLATE_HEADER
    WHEN MATCHED THEN
      UPDATE SET SOURCE_HEADER = source.SOURCE_HEADER, UPDATED_AT = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN
      INSERT (CLIENT_ID, TEMPLATE_HEADER, SOURCE_HEADER, UPDATED_AT)
      VALUES (source.CLIENT_ID, source.TEMPLATE_HEADER, source.SOURCE_HEADER, SYSUTCDATETIME());`,
    params
  );

  return listClientHeaderMappings(normalizedClientId);
};

export const replaceClientHeaderMappings = async (
  clientId: string,
  mappings: ClientHeaderMappingInput[]
): Promise<ClientHeaderMappingRecord[]> => {
  const normalizedClientId = normalizeHeader(clientId);
  if (!normalizedClientId) {
    return [];
  }

  const normalizedMappings = normalizeMappings(mappings);
  if (normalizedMappings.length === 0) {
    return listClientHeaderMappings(normalizedClientId);
  }

  await ensureTable();

  const params: Record<string, unknown> = {
    clientId: normalizedClientId,
  };

  const mappingsWithIndex = normalizedMappings.map((mapping, index) => ({
    mapping,
    index,
  }));

  mappingsWithIndex.forEach(({ mapping, index }) => {
    params[`templateHeader${index}`] = mapping.templateHeader;
    if (mapping.sourceHeader !== null) {
      params[`sourceHeader${index}`] = mapping.sourceHeader;
    }
  });

  const deletePlaceholders = mappingsWithIndex
    .map(({ index }) => `@templateHeader${index}`)
    .join(', ');

  await runQuery(
    `DELETE FROM ${TABLE_NAME}
    WHERE CLIENT_ID = @clientId AND TEMPLATE_HEADER IN (${deletePlaceholders})`,
    params
  );

  const inserts = mappingsWithIndex.filter(
    ({ mapping }) => mapping.sourceHeader !== null
  );

  if (inserts.length > 0) {
    const valuesClause = inserts
      .map(({ index }) => `(@clientId, @templateHeader${index}, @sourceHeader${index}, SYSUTCDATETIME())`)
      .join(', ');

    await runQuery(
      `INSERT INTO ${TABLE_NAME} (CLIENT_ID, TEMPLATE_HEADER, SOURCE_HEADER, UPDATED_AT)
      VALUES ${valuesClause}`,
      params
    );
  }

  return listClientHeaderMappings(normalizedClientId);
};

export default listClientHeaderMappings;
