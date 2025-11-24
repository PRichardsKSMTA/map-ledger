import { runQuery } from '../utils/sqlClient';

export interface ClientEntityRecord {
  clientId: string;
  entityName: string;
  aliases: string[];
}

interface RawClientEntityRow {
  entityName: string;
  aliases?: string | null;
}

const parseAliases = (value?: string | null): string[] => {
  if (!value) {
    return [];
  }

  return value
    .split(/[,;\n]/)
    .map((alias) => alias.trim())
    .filter((alias) => alias.length > 0);
};

export const listClientEntities = async (
  clientId: string
): Promise<ClientEntityRecord[]> => {
  if (!clientId || clientId.trim().length === 0) {
    return [];
  }

  const result = await runQuery<RawClientEntityRow>(
    `SELECT
      ENTITY_NAME as entityName,
      CASE
        WHEN COL_LENGTH('ml.CLIENT_ENTITIES', 'ALIASES') IS NOT NULL THEN ALIASES
        ELSE NULL
      END as aliases
    FROM ml.CLIENT_ENTITIES
    WHERE CLIENT_ID = @clientId`,
    { clientId }
  );

  return (result.recordset ?? []).map((row) => ({
    clientId,
    entityName: row.entityName,
    aliases: parseAliases(row.aliases),
  }));
};

export default listClientEntities;
