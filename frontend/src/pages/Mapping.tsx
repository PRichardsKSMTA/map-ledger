import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import MappingHeader from '../components/mapping/MappingHeader';
import StepTabs, { MappingStep } from '../components/mapping/StepTabs';
import SummaryCards from '../components/mapping/SummaryCards';
import MappingTable from '../components/mapping/MappingTable';
import DistributionTable from '../components/mapping/DistributionTable';
import ReconcilePane from '../components/mapping/ReconcilePane';
import ReviewPane from '../components/mapping/ReviewPane';
import MappingMonthHelper from '../components/mapping/MappingMonthHelper';
import EntityTabs from '../components/mapping/EntityTabs';
import {
  selectActiveEntityId,
  selectAvailableEntities,
  selectEntityMappingProgress,
  type HydrationMode,
  useMappingStore,
} from '../store/mappingStore';
import { selectDistributionProgress, useDistributionStore } from '../store/distributionStore';
import { useOrganizationStore } from '../store/organizationStore';
import { useClientStore } from '../store/clientStore';
import scrollPageToTop from '../utils/scroll';

const normalizeEntityId = (value: string | null): string | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const isValidUploadGuid = (value: string | null | undefined): boolean => {
  if (!value) {
    return false;
  }
  const normalized = value.replace(/[{}]/g, '').trim();
  return /^[0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}$/.test(
    normalized,
  );
};

const stepParam = (value: string | null): MappingStep => {
  if (value === 'reconcile' || value === 'distribution' || value === 'review') {
    return value;
  }
  return 'mapping';
};

const resolveHydrationMode = (value: string | null): HydrationMode => {
  if (value === 'restart' || value === 'none') {
    return value;
  }
  return 'resume';
};

type EntityStepCompletion = {
  mapping: boolean;
  distribution: boolean;
  review: boolean;
};

export default function Mapping() {
  const { uploadId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const hydrateClients = useClientStore(state => state.hydrateFromAccessList);
  const clientAccess = useOrganizationStore(state => state.clientAccess);
  const activeClientId = useClientStore(state => state.activeClientId);
  const activeUploadId = useMappingStore(state => state.activeUploadId);
  const mappingActiveClientId = useMappingStore(state => state.activeClientId);
  const availableEntities = useMappingStore(selectAvailableEntities);
  const activeEntityId = useMappingStore(selectActiveEntityId);
  const entityMappingProgress = useMappingStore(selectEntityMappingProgress);
  const distributionProgress = useDistributionStore(selectDistributionProgress);
  const [entityStages, setEntityStages] = useState<Record<string, MappingStep>>({});
  const [distributionCompletionByEntity, setDistributionCompletionByEntity] = useState<
    Record<string, boolean>
  >({});
  const activeStep = useMemo(() => {
    if (activeEntityId && entityStages[activeEntityId]) {
      return entityStages[activeEntityId];
    }
    return stepParam(searchParams.get('stage'));
  }, [activeEntityId, entityStages, searchParams]);
  const setActiveEntityId = useMappingStore(state => state.setActiveEntityId);
  const fetchFileRecords = useMappingStore(state => state.fetchFileRecords);
  const fetchClientRecords = useMappingStore(state => state.fetchClientRecords);
  const setMappingActiveClientId = useMappingStore(state => state.setActiveClientId);
  const hydrationMode = useMemo(
    () => resolveHydrationMode(searchParams.get('mode')),
    [searchParams],
  );
  const isUploadGuid = useMemo(() => isValidUploadGuid(uploadId), [uploadId]);
  const aggregateUploadId = useMemo(
    () => (activeClientId ? `client-${activeClientId}` : null),
    [activeClientId],
  );
  const availableEntityIds = useMemo(
    () => new Set(availableEntities.map(entity => entity.id)),
    [availableEntities],
  );
  const lastActiveEntityId = useRef<string | null>(null);
  const hasInitializedEntityFromUrl = useRef(false);
  const resolveSelectableEntityId = useCallback(
    (preferredId?: string | null) => {
      if (preferredId && availableEntityIds.has(preferredId)) {
        return preferredId;
      }

      const lastKnown =
        lastActiveEntityId.current && availableEntityIds.has(lastActiveEntityId.current)
          ? lastActiveEntityId.current
          : null;

      return lastKnown ?? availableEntities[0]?.id ?? null;
    },
    [availableEntities, availableEntityIds],
  );
  const lastClientIdRef = useRef<string | null>(null);
  const entityStepCompletion = useMemo<Record<string, EntityStepCompletion>>(() => {
    const completion: Record<string, EntityStepCompletion> = {};
    availableEntities.forEach(entity => {
      const mappingProgress = entityMappingProgress[entity.id];
      const totalAccounts = mappingProgress?.totalAccounts ?? 0;
      const resolvedAccounts = mappingProgress?.resolvedAccounts ?? 0;
      const mappingComplete = totalAccounts === 0 || resolvedAccounts === totalAccounts;
      const distributionComplete =
        totalAccounts === 0
          ? true
          : distributionCompletionByEntity[entity.id] ?? false;

      completion[entity.id] = {
        mapping: mappingComplete,
        distribution: distributionComplete,
        review: mappingComplete && distributionComplete,
      };
    });
    return completion;
  }, [availableEntities, distributionCompletionByEntity, entityMappingProgress]);

  useEffect(() => {
    if (!activeEntityId) {
      return;
    }

    const mappingProgress = entityMappingProgress[activeEntityId];
    const totalAccounts = mappingProgress?.totalAccounts ?? 0;
    const distributionComplete =
      distributionProgress.totalRows > 0
        ? distributionProgress.isComplete
        : totalAccounts === 0;

    setDistributionCompletionByEntity(prev => {
      if (prev[activeEntityId] === distributionComplete) {
        return prev;
      }
      return { ...prev, [activeEntityId]: distributionComplete };
    });
  }, [activeEntityId, distributionProgress, entityMappingProgress]);

  // Note: fetchOrganizations is handled by Navbar component which mounts before pages.
  // Removed duplicate call here to prevent redundant API requests on startup.

  useEffect(() => {
    if (clientAccess.length === 0) {
      return;
    }

    hydrateClients(clientAccess, activeClientId);
  }, [activeClientId, clientAccess, hydrateClients]);

  useEffect(() => {
    setMappingActiveClientId(activeClientId ?? null);
  }, [activeClientId, setMappingActiveClientId]);
  // Entity param from URL - used for restoring entity selection on page refresh
  const rawEntityParam = useMemo(() => {
    return normalizeEntityId(searchParams.get('entityId'));
  }, [searchParams]);

  useEffect(() => {
    if (activeStep === 'mapping') {
      scrollPageToTop({ behavior: 'auto' });
    }
  }, [activeStep]);

  useEffect(() => {
    if (!uploadId || !isUploadGuid) {
      return;
    }

    const currentClientId = activeClientId ?? null;
    const previousClientId = lastClientIdRef.current;
    const clientChanged =
      currentClientId !== null &&
      previousClientId !== null &&
      currentClientId !== previousClientId;

    if (clientChanged) {
      fetchClientRecords(currentClientId, { hydrateMode: hydrationMode });

      if (hydrationMode === 'restart') {
        const next = new URLSearchParams(searchParams);
        next.delete('mode');
        setSearchParams(next, { replace: true });
      }

      return;
    }

    const isAggregateActive =
      Boolean(aggregateUploadId) &&
      activeUploadId === aggregateUploadId &&
      Boolean(activeClientId);

    if (isAggregateActive) {
      return;
    }

    const shouldReload =
      uploadId !== activeUploadId ||
      hydrationMode === 'restart' ||
      (activeClientId ?? null) !== (mappingActiveClientId ?? null);
    if (shouldReload) {
      fetchFileRecords(uploadId, { hydrateMode: hydrationMode, clientId: activeClientId });

      if (hydrationMode === 'restart') {
        const next = new URLSearchParams(searchParams);
        next.delete('mode');
        setSearchParams(next, { replace: true });
      }
    }
  }, [
    activeClientId,
    activeUploadId,
    aggregateUploadId,
    fetchFileRecords,
    fetchClientRecords,
    hydrationMode,
    isUploadGuid,
    mappingActiveClientId,
    searchParams,
    setSearchParams,
    uploadId,
  ]);

  useEffect(() => {
    const previousClientId = lastClientIdRef.current;
    const currentClientId = activeClientId ?? null;
    lastClientIdRef.current = currentClientId;

    // Reset entity URL initialization flag when client changes
    // so the new client's entities can be initialized from URL
    if (previousClientId !== null && currentClientId !== previousClientId) {
      hasInitializedEntityFromUrl.current = false;
    }
  }, [activeClientId]);

  useEffect(() => {
    if (isUploadGuid || !activeClientId) {
      return;
    }

    const shouldReload =
      aggregateUploadId !== activeUploadId ||
      hydrationMode === 'restart' ||
      mappingActiveClientId !== activeClientId;
    if (shouldReload) {
      fetchClientRecords(activeClientId, { hydrateMode: hydrationMode });

      if (hydrationMode === 'restart') {
        const next = new URLSearchParams(searchParams);
        next.delete('mode');
        setSearchParams(next, { replace: true });
      }
    }
  }, [
    activeClientId,
    activeUploadId,
    aggregateUploadId,
    fetchClientRecords,
    hydrationMode,
    isUploadGuid,
    mappingActiveClientId,
    searchParams,
    setSearchParams,
  ]);

  useEffect(() => {
    if (availableEntities.length === 0) {
      return;
    }

    if (activeStep === 'review') {
      return;
    }

    // Only initialize from URL once per page load to avoid flickering loops.
    // After initialization, let the store be the source of truth.
    if (hasInitializedEntityFromUrl.current) {
      // After initial load, only update if current entity became invalid
      if (activeEntityId && availableEntityIds.has(activeEntityId)) {
        return;
      }
      // Current entity is invalid, fall back to first available
      const fallbackEntityId = availableEntities[0]?.id ?? null;
      if (fallbackEntityId && fallbackEntityId !== activeEntityId) {
        setActiveEntityId(fallbackEntityId);
      }
      return;
    }

    // First initialization: prefer URL param (raw, before validation), then first entity.
    // Use rawEntityParam here because normalizedEntityParam depends on availableEntityIds,
    // which may not be populated yet when this effect first runs after page refresh.
    // resolveSelectableEntityId will validate against available entities.
    const preferredEntityId = rawEntityParam ?? activeEntityId;
    const fallbackEntityId = resolveSelectableEntityId(preferredEntityId);

    if (fallbackEntityId !== activeEntityId) {
      setActiveEntityId(fallbackEntityId);
    }

    // Mark as initialized once we have entities and have made a selection
    if (fallbackEntityId) {
      hasInitializedEntityFromUrl.current = true;
    }
  }, [
    activeEntityId,
    activeStep,
    availableEntities,
    availableEntityIds,
    rawEntityParam,
    resolveSelectableEntityId,
    setActiveEntityId,
  ]);

  useEffect(() => {
    if (!activeEntityId) {
      return;
    }

    if (!availableEntityIds.has(activeEntityId)) {
      return;
    }

    lastActiveEntityId.current = activeEntityId;

    const stageFromParams = stepParam(searchParams.get('stage'));
    setEntityStages(prev => {
      if (prev[activeEntityId] === stageFromParams) {
        return prev;
      }
      return { ...prev, [activeEntityId]: stageFromParams };
    });
  }, [activeEntityId, availableEntityIds, searchParams]);

  useEffect(() => {
    if (!activeEntityId) {
      return;
    }

    const entityStage = entityStages[activeEntityId] ?? stepParam(searchParams.get('stage'));
    const currentEntityParam = normalizeEntityId(searchParams.get('entityId'));

    const next = new URLSearchParams(searchParams);
    let shouldUpdate = false;

    if (currentEntityParam !== activeEntityId) {
      if (activeEntityId) {
        next.set('entityId', activeEntityId);
      } else {
        next.delete('entityId');
      }
      shouldUpdate = true;
    }

    if (searchParams.get('stage') !== entityStage) {
      next.set('stage', entityStage);
      shouldUpdate = true;
    }

    if (shouldUpdate) {
      setSearchParams(next, { replace: true });
    }
  }, [activeEntityId, entityStages, searchParams, setSearchParams]);

  useEffect(() => {
    if (activeStep !== 'review' || activeEntityId === null) {
      return;
    }

    lastActiveEntityId.current = activeEntityId;
    setActiveEntityId(null);
  }, [activeEntityId, activeStep, setActiveEntityId]);

  const updateStage = useCallback(
    (step: MappingStep) => {
      if (searchParams.get('stage') === step) {
        return;
      }
      const next = new URLSearchParams(searchParams);
      next.set('stage', step);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const handleStepChange = (step: MappingStep) => {
    const targetEntityId = resolveSelectableEntityId(activeEntityId);
    if (!targetEntityId) {
      return;
    }

    setEntityStages(prev => {
      if (prev[targetEntityId] === step) {
        return prev;
      }
      return { ...prev, [targetEntityId]: step };
    });

    updateStage(step);
    setActiveEntityId(targetEntityId);
  };

  const resolveEntityStage = useCallback(
    (entityId: string): MappingStep => entityStages[entityId] ?? 'mapping',
    [entityStages],
  );

  const handleEntityChange = useCallback(
    (entityId: string) => {
      const nextStage = resolveEntityStage(entityId);
      setEntityStages(prev => {
        if (prev[entityId] === nextStage) {
          return prev;
        }
        return { ...prev, [entityId]: nextStage };
      });

      const next = new URLSearchParams(searchParams);
      next.set('entityId', entityId);
      next.set('stage', nextStage);
      setSearchParams(next, { replace: true });
      setActiveEntityId(entityId);
    },
    [resolveEntityStage, searchParams, setActiveEntityId, setSearchParams],
  );

  const statusEntityId = activeEntityId ?? lastActiveEntityId.current;
  const activeStepCompletion = statusEntityId ? entityStepCompletion[statusEntityId] : null;
  const stepStatuses = activeStepCompletion
    ? {
        mapping: activeStepCompletion.mapping,
        distribution: activeStepCompletion.distribution,
        review: activeStepCompletion.review,
      }
    : undefined;

  return (
    <div data-testid="mapping-page" className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <MappingHeader
        clientId={activeClientId ?? undefined}
        glUploadId={isUploadGuid && activeUploadId === uploadId ? uploadId : undefined}
        hidePeriodSelector={activeStep === 'review'}
      />
      <SummaryCards />
      {activeStep !== 'review' && (
        <EntityTabs
          entities={availableEntities}
          activeEntityId={activeEntityId}
          onSelect={handleEntityChange}
        />
      )}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <StepTabs
          activeStep={activeStep}
          onStepChange={handleStepChange}
          stepStatuses={stepStatuses}
        />
        <section
          aria-label="Mapping workspace content"
          className="w-full border-t border-gray-200 p-6 dark:border-slate-700"
        >
          {activeStep === 'mapping' && <MappingMonthHelper />}
          {activeStep === 'mapping' && <MappingTable />}
          {activeStep === 'reconcile' && <ReconcilePane />}
          {activeStep === 'distribution' && <DistributionTable />}
          {activeStep === 'review' && <ReviewPane />}
        </section>
      </div>
    </div>
  );
}
