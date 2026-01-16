import { runQuery } from '../utils/sqlClient';

export type AppUserRole = 'super' | 'admin' | 'viewer';

export interface AppUser {
  id: string;
  aadUserId: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  role: AppUserRole;
  clientName: string | null;
  clientScac: string | null;
  monthlyClosingDate: number | null;
  isActive: boolean;
  surveyNotify: boolean;
  createdDttm: string;
  updatedDttm: string | null;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface CreateAppUserInput {
  aadUserId: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  role: AppUserRole;
  createdBy?: string;
}

export interface UpdateAppUserInput {
  id: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  role?: AppUserRole;
  monthlyClosingDate?: number | null;
  surveyNotify?: boolean;
  isActive?: boolean;
  updatedBy?: string;
}

interface AppUserRow {
  USER_GUID: string;
  AAD_USER_ID: string;
  USER_EMAIL: string;
  FIRST_NAME: string;
  LAST_NAME: string;
  DISPLAY_NAME: string;
  USER_ROLE: string;
  CLIENT_NAME: string | null;
  CLIENT_SCAC: string | null;
  MONTHLY_CLOSING_DATE: number | null;
  IS_ACTIVE: boolean;
  SURVEY_NOTIFY: boolean;
  CREATED_DTTM: Date;
  UPDATED_DTTM: Date | null;
  CREATED_BY: string | null;
  UPDATED_BY: string | null;
}

const mapRowToAppUser = (row: AppUserRow): AppUser => ({
  id: row.USER_GUID,
  aadUserId: row.AAD_USER_ID,
  email: row.USER_EMAIL,
  firstName: row.FIRST_NAME,
  lastName: row.LAST_NAME,
  displayName: row.DISPLAY_NAME,
  role: row.USER_ROLE as AppUserRole,
  clientName: row.CLIENT_NAME,
  clientScac: row.CLIENT_SCAC,
  monthlyClosingDate: row.MONTHLY_CLOSING_DATE ?? null,
  isActive: row.IS_ACTIVE,
  surveyNotify: row.SURVEY_NOTIFY,
  createdDttm: row.CREATED_DTTM.toISOString(),
  updatedDttm: row.UPDATED_DTTM ? row.UPDATED_DTTM.toISOString() : null,
  createdBy: row.CREATED_BY,
  updatedBy: row.UPDATED_BY,
});

interface ClientLookupRow {
  CLIENT_NAME: string;
  CLIENT_SCAC: string;
}

const getClientInfoByEmail = async (
  email: string
): Promise<{ clientName: string; clientScac: string } | null> => {
  const result = await runQuery<ClientLookupRow>(
    `SELECT DISTINCT CLIENT_NAME, CLIENT_SCAC
     FROM dbo.v_USER_CLIENT_COMPANY_OPERATIONS
     WHERE EMAIL = @email
     ORDER BY CLIENT_NAME ASC`,
    { email }
  );
  const row = result.recordset?.[0];
  if (!row) {
    return null;
  }
  return { clientName: row.CLIENT_NAME, clientScac: row.CLIENT_SCAC };
};

export const listAppUsers = async (includeInactive = false): Promise<AppUser[]> => {
  const query = includeInactive
    ? `SELECT * FROM ml.APP_USER ORDER BY DISPLAY_NAME ASC`
    : `SELECT * FROM ml.APP_USER WHERE IS_ACTIVE = 1 ORDER BY DISPLAY_NAME ASC`;

  const result = await runQuery<AppUserRow>(query, {});
  return (result.recordset ?? []).map(mapRowToAppUser);
};

export const getAppUserById = async (id: string): Promise<AppUser | null> => {
  const result = await runQuery<AppUserRow>(
    `SELECT * FROM ml.APP_USER WHERE USER_GUID = @id`,
    { id }
  );
  const row = result.recordset?.[0];
  return row ? mapRowToAppUser(row) : null;
};

export const getAppUserByEmail = async (email: string): Promise<AppUser | null> => {
  const result = await runQuery<AppUserRow>(
    `SELECT * FROM ml.APP_USER WHERE LOWER(USER_EMAIL) = LOWER(@email)`,
    { email }
  );
  const row = result.recordset?.[0];
  return row ? mapRowToAppUser(row) : null;
};

export const getAppUserByAadId = async (aadUserId: string): Promise<AppUser | null> => {
  const result = await runQuery<AppUserRow>(
    `SELECT * FROM ml.APP_USER WHERE AAD_USER_ID = @aadUserId`,
    { aadUserId }
  );
  const row = result.recordset?.[0];
  return row ? mapRowToAppUser(row) : null;
};

export const createAppUser = async (input: CreateAppUserInput): Promise<AppUser | null> => {
  const id = crypto.randomUUID();
  const now = new Date();
  const clientInfo = await getClientInfoByEmail(input.email.toLowerCase());

  const result = await runQuery<AppUserRow>(
    `INSERT INTO ml.APP_USER (
      USER_GUID, AAD_USER_ID, USER_EMAIL, FIRST_NAME, LAST_NAME, DISPLAY_NAME, USER_ROLE,
      CLIENT_NAME, CLIENT_SCAC, MONTHLY_CLOSING_DATE, IS_ACTIVE, SURVEY_NOTIFY,
      CREATED_DTTM, UPDATED_DTTM, CREATED_BY, UPDATED_BY
    ) OUTPUT INSERTED.*
    VALUES (
      @id, @aadUserId, @email, @firstName, @lastName, @displayName, @role,
      @clientName, @clientScac, @monthlyClosingDate, 1, @surveyNotify,
      @now, NULL, @createdBy, NULL
    )`,
    {
      id,
      aadUserId: input.aadUserId,
      email: input.email.toLowerCase(),
      firstName: input.firstName,
      lastName: input.lastName,
      displayName: input.displayName,
      role: input.role,
      clientName: clientInfo?.clientName ?? null,
      clientScac: clientInfo?.clientScac ?? null,
      monthlyClosingDate: null,
      surveyNotify: 0,
      now,
      createdBy: input.createdBy ?? null,
    }
  );

  const row = result.recordset?.[0];
  return row ? mapRowToAppUser(row) : null;
};

export const updateAppUser = async (input: UpdateAppUserInput): Promise<AppUser | null> => {
  const updates: string[] = [];
  const params: Record<string, unknown> = { id: input.id };

  if (input.firstName !== undefined) {
    updates.push('FIRST_NAME = @firstName');
    params.firstName = input.firstName;
  }
  if (input.lastName !== undefined) {
    updates.push('LAST_NAME = @lastName');
    params.lastName = input.lastName;
  }
  if (input.displayName !== undefined) {
    updates.push('DISPLAY_NAME = @displayName');
    params.displayName = input.displayName;
  }
  if (input.role !== undefined) {
    updates.push('USER_ROLE = @role');
    params.role = input.role;
  }
  if (input.monthlyClosingDate !== undefined) {
    updates.push('MONTHLY_CLOSING_DATE = @monthlyClosingDate');
    params.monthlyClosingDate = input.monthlyClosingDate;
  }
  if (input.surveyNotify !== undefined) {
    updates.push('SURVEY_NOTIFY = @surveyNotify');
    params.surveyNotify = input.surveyNotify ? 1 : 0;
  }
  if (input.isActive !== undefined) {
    updates.push('IS_ACTIVE = @isActive');
    params.isActive = input.isActive ? 1 : 0;
  }

  if (updates.length === 0) {
    return getAppUserById(input.id);
  }

  updates.push('UPDATED_DTTM = @now');
  params.now = new Date();

  updates.push('UPDATED_BY = @updatedBy');
  params.updatedBy = input.updatedBy ?? null;

  const result = await runQuery<AppUserRow>(
    `UPDATE ml.APP_USER SET ${updates.join(', ')} OUTPUT INSERTED.* WHERE USER_GUID = @id`,
    params
  );

  const row = result.recordset?.[0];
  return row ? mapRowToAppUser(row) : null;
};

export const deactivateAppUser = async (id: string, updatedBy?: string): Promise<AppUser | null> => {
  return updateAppUser({ id, isActive: false, updatedBy });
};

export const reactivateAppUser = async (id: string, updatedBy?: string): Promise<AppUser | null> => {
  return updateAppUser({ id, isActive: true, updatedBy });
};

export const deleteAppUser = async (id: string): Promise<boolean> => {
  const result = await runQuery(
    `DELETE FROM ml.APP_USER WHERE USER_GUID = @id`,
    { id }
  );
  return (result.rowsAffected?.[0] ?? 0) > 0;
};

export default {
  listAppUsers,
  getAppUserById,
  getAppUserByEmail,
  getAppUserByAadId,
  createAppUser,
  updateAppUser,
  deactivateAppUser,
  reactivateAppUser,
  deleteAppUser,
};
