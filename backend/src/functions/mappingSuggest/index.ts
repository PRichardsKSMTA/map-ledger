import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { json } from '../../http';
import {
  listEntityAccountMappingsByFileUpload,
  EntityAccountMappingWithRecord,
  EntityMappingPresetDetailRow,
  listEntityAccountMappingsWithPresets,
} from '../../repositories/entityAccountMappingRepository';

type MappingStatus = 'Mapped' | 'Unmapped' | 'New' | 'Excluded';
type MappingType = 'direct' | 'percentage' | 'dynamic' | 'exclude';
type MappingPolarity = 'Debit' | 'Credit' | 'Absolute';

interface MappingSuggestionRow {
  id: string;
  entityId: string;
  entityName: string;
  accountId: string;
  accountName: string;
  activity: number;
  netChange: number;
  status: MappingStatus;
  mappingType: MappingType;
  polarity: MappingPolarity;
  originalPolarity?: MappingPolarity | null;
  modifiedPolarity?: MappingPolarity | null;
  presetId?: string | null;
  exclusionPct?: number | null;
  splitDefinitions: {
    id: string;
    targetId: string;
    targetName: string;
    allocationType: 'percentage' | 'amount' | 'dynamic';
    allocationValue: number;
    notes?: string;
    basisDatapoint?: string;
    isCalculated?: boolean;
    isExclusion?: boolean;
  }[];
  entities: { id: string; entity: string; balance: number }[];
  glMonth?: string | null;
}

const normalizePolarity = (value?: string | null): MappingPolarity | null => {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'debit') {
    return 'Debit';
  }
  if (normalized === 'credit') {
    return 'Credit';
  }
  if (normalized === 'absolute') {
    return 'Absolute';
  }
  return null;
};

const derivePolarity = (amount?: number | null, override?: MappingPolarity | null): MappingPolarity => {
  if (override) {
    return override;
  }

  if ((amount ?? 0) > 0) {
    return 'Debit';
  }
  if ((amount ?? 0) < 0) {
    return 'Credit';
  }
  return 'Absolute';
};

const applyPolarityToAmount = (amount: number, polarity: MappingPolarity): number => {
  if (!Number.isFinite(amount)) {
    return 0;
  }
  const absolute = Math.abs(amount);
  if (polarity === 'Credit') {
    return -absolute;
  }
  return absolute;
};

const normalizeStatus = (status?: string | null, mappingType?: string | null): MappingStatus => {
  if (status) {
    const normalized = status.trim().toLowerCase();
    if (normalized === 'excluded' || normalized === 'exclude') {
      return 'Excluded';
    }
    if (normalized === 'mapped') {
      return 'Mapped';
    }
    if (normalized === 'new') {
      return 'New';
    }
  }

  if (mappingType?.trim().toLowerCase() === 'exclude') {
    return 'Excluded';
  }

  return 'Unmapped';
};

const mapToSuggestion = (
  row: EntityAccountMappingWithRecord,
  fileUploadGuid: string,
): MappingSuggestionRow => {
  const normalizedType = (row.mappingType ?? '').trim().toLowerCase();
  const mappingType = ['direct', 'percentage', 'dynamic', 'exclude'].includes(normalizedType)
    ? (normalizedType as MappingType)
    : 'direct';
  const presetId = row.presetId ?? null;
  const details = presetId ? row.presetDetails ?? [] : [];
  const baseActivity = Number.isFinite(row.activityAmount ?? NaN) ? (row.activityAmount as number) : 0;
  const originalPolarity = normalizePolarity(row.originalPolarity ?? null);
  const modifiedPolarity = normalizePolarity(row.modifiedPolarity ?? null);
  const overridePolarity = modifiedPolarity ?? normalizePolarity(row.polarity ?? null);
  const polarity = derivePolarity(baseActivity, overridePolarity);
  const status = normalizeStatus(row.mappingStatus, mappingType);
  const entityId = row.entityId?.trim() || 'unknown-entity';
  const activity = overridePolarity ? applyPolarityToAmount(baseActivity, overridePolarity) : baseActivity;
  const hydratedDetails = details.filter(
    (detail): detail is EntityMappingPresetDetailRow & { targetDatapoint: string } =>
      Boolean(detail.targetDatapoint),
  );

  return {
    id: `${fileUploadGuid}-${row.recordId ?? row.entityAccountId}`,
    entityId,
    entityName: entityId,
    accountId: row.entityAccountId,
    accountName: row.accountName ?? row.entityAccountId,
    activity,
    netChange: activity,
    status,
    mappingType,
    polarity,
    originalPolarity,
    modifiedPolarity,
    presetId,
    exclusionPct: row.exclusionPct ?? null,
    splitDefinitions: hydratedDetails.map((detail, index) => {
      const isExclusionSplit = detail.targetDatapoint.toLowerCase() === 'excluded';
      const isDynamicSplit = detail.isCalculated === true;

      return {
        id: `${presetId ?? 'preset'}-${index}`,
        targetId: isExclusionSplit ? '' : detail.targetDatapoint,
        targetName: isExclusionSplit ? 'Exclusion' : detail.targetDatapoint,
        allocationType: isDynamicSplit ? 'dynamic' : 'percentage',
        allocationValue: detail.specifiedPct ?? 0,
        notes: isExclusionSplit ? 'Excluded amount' : undefined,
        basisDatapoint: detail.basisDatapoint ?? undefined,
        isCalculated: detail.isCalculated ?? undefined,
        isExclusion: isExclusionSplit,
        recordId: detail.recordId ?? undefined,
      };
    }),
    entities: [
      {
        id: entityId,
        entity: entityId,
        balance: activity,
      },
    ],
    glMonth: row.glMonth ?? null,
  };
};

export async function mappingSuggestHandler(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  try {
    const fileUploadGuid = request.query.get('fileUploadGuid')?.trim();
    const entityId = request.query.get('entityId')?.trim();

    if (!fileUploadGuid && !entityId) {
      return json({ message: 'fileUploadGuid or entityId is required' }, 400);
    }

    const mappings = fileUploadGuid
      ? await listEntityAccountMappingsByFileUpload(fileUploadGuid)
      : await listEntityAccountMappingsWithPresets(entityId as string);

    const resolvedUploadGuid = fileUploadGuid ?? `${entityId}-preset`;
    const items = mappings.map((row) => mapToSuggestion(row, resolvedUploadGuid));
    return json({ items });
  } catch (error) {
    context.error('Failed to build mapping suggestions', error);
    return json({ message: 'Failed to build mapping suggestions' }, 500);
  }
}

app.http('mappingSuggest', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'mapping/suggest',
  handler: mappingSuggestHandler
});

export default mappingSuggestHandler;
