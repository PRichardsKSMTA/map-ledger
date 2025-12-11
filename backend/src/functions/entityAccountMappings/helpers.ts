import type { EntityMappingPresetDetailInput } from '../../repositories/entityMappingPresetDetailRepository';
import type { EntityPresetMappingInput } from '../../repositories/entityPresetMappingRepository';
import type { IncomingSplitDefinition, NormalizedSplitDefinition } from './types';

export interface NormalizationTools {
  normalizeText: (value: unknown) => string | null;
  normalizeNumber: (value: unknown) => number | null;
  resolvePresetType: (value: string | null | undefined) => string;
}

export const normalizeSplitDefinitions = (
  mappingType: string | null,
  splits: IncomingSplitDefinition[] | undefined,
  baseAmount: number | null,
  exclusionPct: number | null,
  tools: NormalizationTools,
): NormalizedSplitDefinition[] => {
  if (!splits || splits.length === 0) {
    return [];
  }

  const normalizedType = tools.resolvePresetType(mappingType);
  const normalizedBaseAmount =
    baseAmount === null || baseAmount === undefined
      ? null
      : Math.abs(baseAmount);

  const normalizedSplits: NormalizedSplitDefinition[] = [];

  splits.forEach((split) => {
    const targetDatapoint = tools.normalizeText(split.targetId);
    const isExclusionSplit = split.isExclusion === true;

    let finalTargetDatapoint: string;
    if (isExclusionSplit) {
      finalTargetDatapoint = 'excluded';
    } else if (!targetDatapoint) {
      return;
    } else {
      finalTargetDatapoint = targetDatapoint;
    }

    const basisDatapoint = tools.normalizeText(split.basisDatapoint);
    const isCalculated = split.isCalculated ?? normalizedType === 'dynamic';
    const allocationType = tools.normalizeText(split.allocationType) ?? 'percentage';
    const allocationValue = tools.normalizeNumber(split.allocationValue);

    let specifiedPct: number | null = null;
    if (normalizedType === 'dynamic') {
      specifiedPct = null;
    } else if (normalizedType === 'direct') {
      specifiedPct = 100;
    } else if (allocationType === 'amount' && normalizedBaseAmount) {
      specifiedPct = Number(
        (((allocationValue ?? 0) / normalizedBaseAmount) * 100).toFixed(3),
      );
    } else {
      specifiedPct = allocationValue ?? null;
    }

    normalizedSplits.push({
      basisDatapoint: basisDatapoint ?? null,
      targetDatapoint: finalTargetDatapoint,
      isCalculated,
      specifiedPct,
      appliedPct: normalizedType === 'dynamic' ? allocationValue ?? null : null,
    });
  });

  if (
    normalizedType === 'percentage' &&
    typeof exclusionPct === 'number' &&
    exclusionPct > 0
  ) {
    const hasExclusionSplit = normalizedSplits.some(
      (detail) => detail.targetDatapoint === 'excluded',
    );

    if (!hasExclusionSplit) {
      normalizedSplits.push({
        basisDatapoint: null,
        targetDatapoint: 'excluded',
        isCalculated: false,
        specifiedPct: exclusionPct,
        appliedPct: null,
      });
    }
  }

  return normalizedSplits;
};

export const mapSplitDefinitionsToPresetDetails = (
  presetGuid: string,
  mappingType: string | null,
  splits: IncomingSplitDefinition[] | undefined,
  updatedBy: string | null,
  baseAmount: number | null,
  exclusionPct: number | null,
  tools: NormalizationTools,
): EntityMappingPresetDetailInput[] => {
  const normalizedSplits = normalizeSplitDefinitions(
    mappingType,
    splits,
    baseAmount,
    exclusionPct,
    tools,
  );

  if (!normalizedSplits.length) {
    return [];
  }

  return normalizedSplits.map((detail) => ({
    presetGuid,
    basisDatapoint: detail.basisDatapoint,
    targetDatapoint: detail.targetDatapoint,
    isCalculated: detail.isCalculated,
    specifiedPct: detail.specifiedPct,
    updatedBy: updatedBy ?? null,
  }));
};

export const buildDynamicPresetMappingInputs = (
  presetGuid: string,
  mappingType: string | null,
  splits: IncomingSplitDefinition[] | undefined,
  updatedBy: string | null,
  baseAmount: number | null,
  exclusionPct: number | null,
  tools: NormalizationTools,
): EntityPresetMappingInput[] => {
  const presetType = tools.resolvePresetType(mappingType);
  if (presetType !== 'dynamic') {
    return [];
  }

  const normalizedSplits = normalizeSplitDefinitions(
    mappingType,
    splits,
    baseAmount,
    exclusionPct,
    tools,
  );

  if (!normalizedSplits.length) {
    return [];
  }

  return normalizedSplits.map((detail) => ({
    presetGuid,
    basisDatapoint: detail.basisDatapoint,
    targetDatapoint: detail.targetDatapoint,
    appliedPct: detail.appliedPct,
    updatedBy: updatedBy ?? null,
  }));
};

export const determinePresetType = (
  mappingType: string | null,
  splits: IncomingSplitDefinition[] | undefined,
  tools: NormalizationTools,
): string => {
  const normalized = tools.resolvePresetType(mappingType);

  if (normalized === 'dynamic') {
    return 'dynamic';
  }

  if (splits && splits.some((split) => {
    const allocationType = tools.normalizeText(split.allocationType)?.toLowerCase();
    return allocationType === 'dynamic';
  })) {
    return 'dynamic';
  }

  return normalized;
};
