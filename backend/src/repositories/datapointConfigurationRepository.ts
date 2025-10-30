import crypto from 'node:crypto';
import { runQuery } from '../utils/sqlClient';

const TABLE_NAME = 'UserDatapointConfigurations';

interface RawDatapointConfigurationRow extends Record<string, unknown> {
  id: string;
  user_email: string;
  user_name: string | null;
  client_id: string;
  client_name: string;
  configuration_label: string | null;
  company_name: string | null;
  source_account_id: string | null;
  source_account_name: string | null;
  source_account_description: string | null;
  reporting_period: string | null;
  mapping_type: string | null;
  target_scoa: string | null;
  polarity: string | null;
  preset: string | null;
  operations_json: string | null;
  exclusions_json: string | null;
  configuration_json: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface DatapointConfigurationInput {
  label?: string | null;
  userEmail: string;
  userName?: string | null;
  clientId: string;
  clientName: string;
  companyName?: string | null;
  sourceAccountId?: string | null;
  sourceAccountName?: string | null;
  sourceAccountDescription?: string | null;
  reportingPeriod?: string | null;
  mappingType?: string | null;
  targetSCoA?: string | null;
  polarity?: string | null;
  preset?: string | null;
  operations?: string[];
  exclusions?: string[];
  configuration?: Record<string, unknown> | null;
}

export interface DatapointConfigurationUpdate
  extends DatapointConfigurationInput {
  id: string;
}

export interface UserDatapointConfiguration
  extends Omit<DatapointConfigurationInput, 'configuration'> {
  id: string;
  configuration: Record<string, unknown> | null;
  operations: string[];
  exclusions: string[];
  createdAt: string;
  updatedAt: string;
}

let tableEnsured = false;

const ensureTable = async () => {
  if (tableEnsured) {
    return;
  }

  await runQuery(
    `IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = '${TABLE_NAME}')
BEGIN
  CREATE TABLE dbo.${TABLE_NAME} (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    user_email NVARCHAR(256) NOT NULL,
    user_name NVARCHAR(256) NULL,
    client_id NVARCHAR(128) NOT NULL,
    client_name NVARCHAR(256) NOT NULL,
    configuration_label NVARCHAR(256) NULL,
    company_name NVARCHAR(256) NULL,
    source_account_id NVARCHAR(128) NULL,
    source_account_name NVARCHAR(256) NULL,
    source_account_description NVARCHAR(MAX) NULL,
    reporting_period NVARCHAR(64) NULL,
    mapping_type NVARCHAR(128) NULL,
    target_scoa NVARCHAR(128) NULL,
    polarity NVARCHAR(64) NULL,
    preset NVARCHAR(128) NULL,
    operations_json NVARCHAR(MAX) NULL,
    exclusions_json NVARCHAR(MAX) NULL,
    configuration_json NVARCHAR(MAX) NULL,
    created_at DATETIME2(7) NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(7) NOT NULL DEFAULT SYSUTCDATETIME()
  );
  CREATE INDEX IX_${TABLE_NAME}_EmailClient
    ON dbo.${TABLE_NAME}(user_email, client_id);
END;`
  );

  tableEnsured = true;
};

const parseJsonArray = (value: string | null): string[] => {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      const normalized = parsed
        .map((entry) =>
          typeof entry === 'string' ? entry : JSON.stringify(entry)
        )
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
      return Array.from(new Set(normalized)).sort((a, b) =>
        a.localeCompare(b)
      );
    }
    return [];
  } catch (error) {
    return [];
  }
};

const parseJsonObject = (
  value: string | null
): Record<string, unknown> | null => {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch (error) {
    return null;
  }
};

const mapRowToConfiguration = (
  row: RawDatapointConfigurationRow
): UserDatapointConfiguration => ({
  id: row.id,
  label: row.configuration_label,
  userEmail: row.user_email,
  userName: row.user_name,
  clientId: row.client_id,
  clientName: row.client_name,
  companyName: row.company_name,
  sourceAccountId: row.source_account_id,
  sourceAccountName: row.source_account_name,
  sourceAccountDescription: row.source_account_description,
  reportingPeriod: row.reporting_period,
  mappingType: row.mapping_type,
  targetSCoA: row.target_scoa,
  polarity: row.polarity,
  preset: row.preset,
  operations: parseJsonArray(row.operations_json),
  exclusions: parseJsonArray(row.exclusions_json),
  configuration: parseJsonObject(row.configuration_json),
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

export const listDatapointConfigurations = async (
  email: string,
  clientId?: string
): Promise<UserDatapointConfiguration[]> => {
  await ensureTable();

  const filters: string[] = ['user_email = @email'];
  const parameters: Record<string, unknown> = { email };

  if (clientId) {
    filters.push('client_id = @clientId');
    parameters.clientId = clientId;
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const { recordset = [] } = await runQuery<RawDatapointConfigurationRow>(
    `SELECT * FROM dbo.${TABLE_NAME} ${whereClause} ORDER BY updated_at DESC`,
    parameters
  );

  return recordset.map(mapRowToConfiguration);
};

export const createDatapointConfiguration = async (
  input: DatapointConfigurationInput
): Promise<UserDatapointConfiguration> => {
  await ensureTable();

  const id = crypto.randomUUID();

  await runQuery(
    `INSERT INTO dbo.${TABLE_NAME} (
      id,
      user_email,
      user_name,
      client_id,
      client_name,
      configuration_label,
      company_name,
      source_account_id,
      source_account_name,
      source_account_description,
      reporting_period,
      mapping_type,
      target_scoa,
      polarity,
      preset,
      operations_json,
      exclusions_json,
      configuration_json
    ) VALUES (
      @id,
      @userEmail,
      @userName,
      @clientId,
      @clientName,
      @label,
      @companyName,
      @sourceAccountId,
      @sourceAccountName,
      @sourceAccountDescription,
      @reportingPeriod,
      @mappingType,
      @targetSCoA,
      @polarity,
      @preset,
      @operationsJson,
      @exclusionsJson,
      @configurationJson
    )`,
    {
      id,
      userEmail: input.userEmail,
      userName: input.userName ?? null,
      clientId: input.clientId,
      clientName: input.clientName,
      label: input.label ?? null,
      companyName: input.companyName ?? null,
      sourceAccountId: input.sourceAccountId ?? null,
      sourceAccountName: input.sourceAccountName ?? null,
      sourceAccountDescription: input.sourceAccountDescription ?? null,
      reportingPeriod: input.reportingPeriod ?? null,
      mappingType: input.mappingType ?? null,
      targetSCoA: input.targetSCoA ?? null,
      polarity: input.polarity ?? null,
      preset: input.preset ?? null,
      operationsJson: JSON.stringify(input.operations ?? []),
      exclusionsJson: JSON.stringify(input.exclusions ?? []),
      configurationJson: JSON.stringify(input.configuration ?? {}),
    }
  );

  return getDatapointConfigurationById(id);
};

export const updateDatapointConfiguration = async (
  input: DatapointConfigurationUpdate
): Promise<UserDatapointConfiguration> => {
  await ensureTable();

  await runQuery(
    `UPDATE dbo.${TABLE_NAME}
    SET
      user_name = @userName,
      client_id = @clientId,
      client_name = @clientName,
      configuration_label = @label,
      company_name = @companyName,
      source_account_id = @sourceAccountId,
      source_account_name = @sourceAccountName,
      source_account_description = @sourceAccountDescription,
      reporting_period = @reportingPeriod,
      mapping_type = @mappingType,
      target_scoa = @targetSCoA,
      polarity = @polarity,
      preset = @preset,
      operations_json = @operationsJson,
      exclusions_json = @exclusionsJson,
      configuration_json = @configurationJson,
      updated_at = SYSUTCDATETIME()
    WHERE id = @id AND user_email = @userEmail`,
    {
      id: input.id,
      userEmail: input.userEmail,
      userName: input.userName ?? null,
      clientId: input.clientId,
      clientName: input.clientName,
      label: input.label ?? null,
      companyName: input.companyName ?? null,
      sourceAccountId: input.sourceAccountId ?? null,
      sourceAccountName: input.sourceAccountName ?? null,
      sourceAccountDescription: input.sourceAccountDescription ?? null,
      reportingPeriod: input.reportingPeriod ?? null,
      mappingType: input.mappingType ?? null,
      targetSCoA: input.targetSCoA ?? null,
      polarity: input.polarity ?? null,
      preset: input.preset ?? null,
      operationsJson: JSON.stringify(input.operations ?? []),
      exclusionsJson: JSON.stringify(input.exclusions ?? []),
      configurationJson: JSON.stringify(input.configuration ?? {}),
    }
  );

  return getDatapointConfigurationById(input.id);
};

export const getDatapointConfigurationById = async (
  id: string
): Promise<UserDatapointConfiguration> => {
  await ensureTable();

  const { recordset = [] } = await runQuery<RawDatapointConfigurationRow>(
    `SELECT * FROM dbo.${TABLE_NAME} WHERE id = @id`,
    { id }
  );

  if (recordset.length === 0) {
    throw new Error('Datapoint configuration not found');
  }

  return mapRowToConfiguration(recordset[0]);
};
