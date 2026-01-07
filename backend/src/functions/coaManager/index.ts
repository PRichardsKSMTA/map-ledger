import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { json, readJson } from '../../http';
import {
  IndustryNotFoundError,
  InvalidIndustryNameError,
  InvalidIndustryTableError,
  listIndustryCoaData,
  insertIndustryAccounts,
  updateIndustryIsFinancial,
  updateIndustryIsFinancialBatch,
  updateIndustryIsSurvey,
  updateIndustryIsSurveyBatch,
  updateIndustryCostType,
  updateIndustryCostTypeBatch,
} from '../../repositories/coaManagerRepository';
import { getFirstStringValue } from '../../utils/requestParsers';

const MAX_CREATE_ROWS = 500;

type AccountRowInput = {
  accountNumber?: string | null;
  coreAccount?: string | null;
  operationalGroupCode?: string | null;
  laborGroupCode?: string | null;
  accountName?: string | null;
  laborGroup?: string | null;
  operationalGroup?: string | null;
  category?: string | null;
  accountType?: string | null;
  subCategory?: string | null;
  department?: string | null;
  costType?: string | null;
  isFinancial?: boolean | null;
  isSurvey?: boolean | null;
};

const resolveIndustryParam = (request: HttpRequest): string | undefined => {
  const params = request.params as Partial<{ industry?: string }> | undefined;
  return getFirstStringValue(params?.industry);
};

const normalizeCostType = (value: unknown): string | null | undefined => {
  if (value === null) {
    return null;
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  return undefined;
};

const normalizeIsFinancial = (value: unknown): boolean | null | undefined => {
  if (value === null) {
    return null;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const normalized = trimmed.toLowerCase();
    if (
      normalized === 'true' ||
      normalized === '1' ||
      normalized === 'yes' ||
      normalized === 'y' ||
      normalized.includes('financial') ||
      normalized === 'fin' ||
      normalized.startsWith('fin')
    ) {
      return true;
    }
    if (
      normalized === 'false' ||
      normalized === '0' ||
      normalized === 'no' ||
      normalized === 'n' ||
      normalized.includes('operational') ||
      normalized === 'ops' ||
      normalized.startsWith('oper')
    ) {
      return false;
    }
    return undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value === 1) {
      return true;
    }
    if (value === 0) {
      return false;
    }
    return undefined;
  }
  return undefined;
};

const normalizeIsSurvey = (value: unknown): boolean | null | undefined =>
  normalizeIsFinancial(value);

const parseRowIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => getFirstStringValue(entry))
    .filter((entry): entry is string => Boolean(entry));
};

const normalizeAccountText = (value: unknown): string | null => {
  const resolved = getFirstStringValue(value);
  return resolved ? resolved.trim() : null;
};

const getRowText = (row: Record<string, unknown>, keys: string[]): string | null => {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(row, key)) {
      continue;
    }
    const value = normalizeAccountText(row[key]);
    if (value !== null) {
      return value;
    }
  }
  return null;
};

const normalizeAccountRow = (row: Record<string, unknown>): AccountRowInput => {
  const isFinancialValue =
    row.isFinancial ?? row.is_financial ?? row.IS_FINANCIAL ?? row.financialFlag;
  const isSurveyValue = row.isSurvey ?? row.is_survey ?? row.IS_SURVEY ?? row.surveyFlag;

  return {
    accountNumber: getRowText(row, [
      'accountNumber',
      'account_number',
      'ACCOUNT_NUMBER',
      'account',
      'ACCOUNT',
    ]),
    coreAccount: getRowText(row, ['coreAccount', 'core_account', 'CORE_ACCOUNT']),
    operationalGroupCode: getRowText(row, [
      'operationalGroupCode',
      'operational_group_code',
      'OPERATIONAL_GROUP_CODE',
    ]),
    laborGroupCode: getRowText(row, [
      'laborGroupCode',
      'labor_group_code',
      'LABOR_GROUP_CODE',
    ]),
    accountName: getRowText(row, [
      'accountName',
      'account_name',
      'ACCOUNT_NAME',
      'description',
      'DESCRIPTION',
      'name',
      'NAME',
    ]),
    laborGroup: getRowText(row, ['laborGroup', 'labor_group', 'LABOR_GROUP']),
    operationalGroup: getRowText(row, [
      'operationalGroup',
      'operational_group',
      'OPERATIONAL_GROUP',
      'opGroup',
    ]),
    category: getRowText(row, ['category', 'CATEGORY']),
    accountType: getRowText(row, ['accountType', 'account_type', 'ACCOUNT_TYPE']),
    subCategory: getRowText(row, ['subCategory', 'sub_category', 'SUB_CATEGORY']),
    department: getRowText(row, ['department', 'DEPARTMENT', 'dept', 'DEPT']),
    costType: getRowText(row, ['costType', 'cost_type', 'COST_TYPE']),
    isFinancial: normalizeIsFinancial(isFinancialValue),
    isSurvey: normalizeIsSurvey(isSurveyValue),
  };
};

const handleIndustryError = (
  error: unknown,
  context: InvocationContext,
  action: string,
): HttpResponseInit => {
  if (error instanceof InvalidIndustryNameError) {
    return json({ message: error.message }, 400);
  }
  if (error instanceof IndustryNotFoundError) {
    return json({ message: error.message }, 404);
  }
  if (error instanceof InvalidIndustryTableError) {
    return json({ message: error.message }, 400);
  }

  const message = error instanceof Error ? error.message : 'Unknown error';
  context.error(`Failed to ${action}`, error);
  return json({ message: `Unable to ${action}`, detail: message }, 500);
};

export async function getIndustryCoaHandler(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const industry = resolveIndustryParam(request);
  if (!industry) {
    return json({ message: 'industry is required' }, 400);
  }

  try {
    const data = await listIndustryCoaData(industry);
    return json(data);
  } catch (error) {
    return handleIndustryError(error, context, 'fetch COA data');
  }
}

export async function createIndustryAccountsHandler(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const industry = resolveIndustryParam(request);
  if (!industry) {
    return json({ message: 'industry is required' }, 400);
  }

  const payload = (await readJson<Record<string, unknown>>(request)) ?? {};
  const rawRows = Array.isArray(payload.rows) ? payload.rows : [];

  if (rawRows.length === 0) {
    return json({ message: 'rows are required' }, 400);
  }

  if (rawRows.length > MAX_CREATE_ROWS) {
    return json({ message: `Too many rows. Max allowed is ${MAX_CREATE_ROWS}.` }, 400);
  }

  const normalizedRows = rawRows
    .map((row) =>
      row && typeof row === 'object'
        ? normalizeAccountRow(row as Record<string, unknown>)
        : null,
    )
    .filter((row): row is AccountRowInput => row !== null);

  if (normalizedRows.length === 0) {
    return json({ message: 'rows are required' }, 400);
  }

  const invalidIndex = normalizedRows.findIndex(
    (row) => !row.accountName && !row.accountNumber,
  );
  if (invalidIndex !== -1) {
    return json(
      { message: `Row ${invalidIndex + 1} must include an account name or number.` },
      400,
    );
  }

  const uniqueRows = new Map<string, AccountRowInput>();
  normalizedRows.forEach((row) => {
    const key = [
      row.accountNumber ?? '',
      row.coreAccount ?? '',
      row.operationalGroupCode ?? '',
      row.laborGroupCode ?? '',
      row.accountName ?? '',
      row.laborGroup ?? '',
      row.operationalGroup ?? '',
      row.category ?? '',
      row.accountType ?? '',
      row.subCategory ?? '',
      row.department ?? '',
      row.costType ?? '',
      row.isFinancial ?? '',
      row.isSurvey ?? '',
    ].join('|');
    uniqueRows.set(key, row);
  });

  try {
    const inserted = await insertIndustryAccounts(industry, Array.from(uniqueRows.values()));
    return json({ inserted });
  } catch (error) {
    return handleIndustryError(error, context, 'create COA accounts');
  }
}

export async function updateIndustryCostTypeHandler(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const industry = resolveIndustryParam(request);
  if (!industry) {
    return json({ message: 'industry is required' }, 400);
  }

  const payload = (await readJson<Record<string, unknown>>(request)) ?? {};
  const rowId = getFirstStringValue(payload.rowId ?? payload.recordId ?? payload.id);
  const costType = normalizeCostType(payload.costType);

  if (!rowId || costType === undefined) {
    return json({ message: 'rowId and costType are required' }, 400);
  }

  try {
    const updated = await updateIndustryCostType(industry, rowId, costType);
    if (!updated) {
      return json({ message: 'Record not found' }, 404);
    }
    return json({ ok: true });
  } catch (error) {
    return handleIndustryError(error, context, 'update cost type');
  }
}

export async function updateIndustryCostTypeBatchHandler(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const industry = resolveIndustryParam(request);
  if (!industry) {
    return json({ message: 'industry is required' }, 400);
  }

  const payload = (await readJson<Record<string, unknown>>(request)) ?? {};
  const rowIds = parseRowIds(payload.rowIds ?? payload.recordIds);
  const costType = normalizeCostType(payload.costType);

  if (rowIds.length === 0 || costType === undefined) {
    return json({ message: 'rowIds and costType are required' }, 400);
  }

  try {
    const updatedCount = await updateIndustryCostTypeBatch(industry, rowIds, costType);
    return json({ updated: updatedCount });
  } catch (error) {
    return handleIndustryError(error, context, 'update cost types');
  }
}

export async function updateIndustryIsFinancialHandler(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const industry = resolveIndustryParam(request);
  if (!industry) {
    return json({ message: 'industry is required' }, 400);
  }

  const payload = (await readJson<Record<string, unknown>>(request)) ?? {};
  const rowId = getFirstStringValue(payload.rowId ?? payload.recordId ?? payload.id);
  const isFinancial = normalizeIsFinancial(payload.isFinancial);

  if (!rowId || isFinancial === undefined) {
    return json({ message: 'rowId and isFinancial are required' }, 400);
  }

  try {
    const updated = await updateIndustryIsFinancial(industry, rowId, isFinancial);
    if (!updated) {
      return json({ message: 'Record not found' }, 404);
    }
    return json({ ok: true });
  } catch (error) {
    return handleIndustryError(error, context, 'update financial flag');
  }
}

export async function updateIndustryIsFinancialBatchHandler(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const industry = resolveIndustryParam(request);
  if (!industry) {
    return json({ message: 'industry is required' }, 400);
  }

  const payload = (await readJson<Record<string, unknown>>(request)) ?? {};
  const rowIds = parseRowIds(payload.rowIds ?? payload.recordIds);
  const isFinancial = normalizeIsFinancial(payload.isFinancial);

  if (rowIds.length === 0 || isFinancial === undefined) {
    return json({ message: 'rowIds and isFinancial are required' }, 400);
  }

  try {
    const updatedCount = await updateIndustryIsFinancialBatch(industry, rowIds, isFinancial);
    return json({ updated: updatedCount });
  } catch (error) {
    return handleIndustryError(error, context, 'update financial flags');
  }
}

export async function updateIndustryIsSurveyHandler(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const industry = resolveIndustryParam(request);
  if (!industry) {
    return json({ message: 'industry is required' }, 400);
  }

  const payload = (await readJson<Record<string, unknown>>(request)) ?? {};
  const rowId = getFirstStringValue(payload.rowId ?? payload.recordId ?? payload.id);
  const isSurvey = normalizeIsSurvey(payload.isSurvey);

  if (!rowId || isSurvey === undefined) {
    return json({ message: 'rowId and isSurvey are required' }, 400);
  }

  try {
    const updated = await updateIndustryIsSurvey(industry, rowId, isSurvey);
    if (!updated) {
      return json({ message: 'Record not found' }, 404);
    }
    return json({ ok: true });
  } catch (error) {
    return handleIndustryError(error, context, 'update survey flag');
  }
}

export async function updateIndustryIsSurveyBatchHandler(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const industry = resolveIndustryParam(request);
  if (!industry) {
    return json({ message: 'industry is required' }, 400);
  }

  const payload = (await readJson<Record<string, unknown>>(request)) ?? {};
  const rowIds = parseRowIds(payload.rowIds ?? payload.recordIds);
  const isSurvey = normalizeIsSurvey(payload.isSurvey);

  if (rowIds.length === 0 || isSurvey === undefined) {
    return json({ message: 'rowIds and isSurvey are required' }, 400);
  }

  try {
    const updatedCount = await updateIndustryIsSurveyBatch(industry, rowIds, isSurvey);
    return json({ updated: updatedCount });
  } catch (error) {
    return handleIndustryError(error, context, 'update survey flags');
  }
}

app.http('coaManager-industry', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'coa-manager/industry/{industry}',
  handler: getIndustryCoaHandler,
});

app.http('coaManager-accounts', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'coa-manager/industry/{industry}/accounts',
  handler: createIndustryAccountsHandler,
});

app.http('coaManager-costType', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'coa-manager/industry/{industry}/cost-type',
  handler: updateIndustryCostTypeHandler,
});

app.http('coaManager-costType-batch', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'coa-manager/industry/{industry}/cost-type/batch',
  handler: updateIndustryCostTypeBatchHandler,
});

app.http('coaManager-isFinancial', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'coa-manager/industry/{industry}/is-financial',
  handler: updateIndustryIsFinancialHandler,
});

app.http('coaManager-isFinancial-batch', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'coa-manager/industry/{industry}/is-financial/batch',
  handler: updateIndustryIsFinancialBatchHandler,
});

app.http('coaManager-isSurvey', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'coa-manager/industry/{industry}/is-survey',
  handler: updateIndustryIsSurveyHandler,
});

app.http('coaManager-isSurvey-batch', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'coa-manager/industry/{industry}/is-survey/batch',
  handler: updateIndustryIsSurveyBatchHandler,
});

export default getIndustryCoaHandler;
