/**
 * @jest-environment node
 */

import { act } from '@testing-library/react';
import {
  createInitialMappingAccounts,
  selectStatusCounts,
  selectSummaryMetrics,
  useMappingStore,
} from '../store/mappingStore';
import { useRatioAllocationStore } from '../store/ratioAllocationStore';
import type { TrialBalanceRow } from '../types';

describe('mappingStore selectors', () => {
  beforeEach(() => {
    useMappingStore.setState({
      accounts: createInitialMappingAccounts(),
      searchTerm: '',
      activeStatuses: [],
    });
    useRatioAllocationStore.setState({
      allocations: [],
      basisAccounts: [],
      groups: [],
      sourceAccounts: [],
      availablePeriods: [],
      isProcessing: false,
      selectedPeriod: null,
      results: [],
      validationErrors: [],
      auditLog: [],
    });
  });

  it('computes gross, excluded, and net totals from seed data', () => {
    const summary = selectSummaryMetrics(useMappingStore.getState());
    expect(summary).toEqual(
      expect.objectContaining({
        totalAccounts: 4,
        mappedAccounts: 3,
        grossTotal: 700000,
        excludedTotal: 15000,
        netTotal: 685000,
      })
    );
  });

  it('recalculates totals when accounts are excluded', () => {
    act(() => {
      useMappingStore.getState().updateMappingType('acct-2', 'exclude');
      useMappingStore.getState().updateStatus('acct-2', 'Excluded');
    });

    const summary = selectSummaryMetrics(useMappingStore.getState());
    expect(summary.excludedTotal).toBe(135000);
    expect(summary.netTotal).toBe(565000);
  });

  it('calculates exclusions from percentage splits marked as excluded', () => {
    act(() => {
      useMappingStore
        .getState()
        .updateSplitDefinition('acct-2', 'split-2', { isExclusion: true });
    });

    const summary = selectSummaryMetrics(useMappingStore.getState());
    expect(summary.excludedTotal).toBe(15000 + 48000);
    expect(summary.netTotal).toBe(700000 - (15000 + 48000));
  });

  it('derives dynamic exclusion totals from allocation results', () => {
    act(() => {
      useMappingStore.setState(state => ({ ...state, activePeriod: '2024-01' }));
      useRatioAllocationStore.setState(state => ({
        ...state,
        selectedPeriod: '2024-01',
        allocations: [
          {
            id: 'alloc-1',
            name: 'Dynamic test',
            sourceAccount: {
              id: 'acct-3',
              number: '6100',
              description: 'Fuel Expense',
            },
            targetDatapoints: [
              {
                datapointId: 'dp-1',
                name: 'Exclude Pool',
                ratioMetric: { id: 'metric-1', name: 'Metric 1', value: 1 },
                isExclusion: true,
              },
              {
                datapointId: 'dp-2',
                name: 'Mapped Pool',
                ratioMetric: { id: 'metric-2', name: 'Metric 2', value: 1 },
                isExclusion: false,
              },
            ],
            effectiveDate: '2024-01-01',
            status: 'active',
          },
        ],
        results: [
          {
            allocationId: 'alloc-1',
            allocationName: 'Dynamic test',
            periodId: '2024-01',
            sourceAccountId: 'acct-3',
            sourceAccountName: 'Fuel Expense',
            sourceValue: 65000,
            basisTotal: 2,
            runAt: new Date().toISOString(),
            allocations: [
              {
                datapointId: 'dp-1',
                targetId: 'dp-1',
                targetName: 'Exclude Pool',
                basisValue: 1,
                value: 20000,
                percentage: 50,
                ratio: 0.5,
                isExclusion: true,
              },
              {
                datapointId: 'dp-2',
                targetId: 'dp-2',
                targetName: 'Mapped Pool',
                basisValue: 1,
                value: 45000,
                percentage: 50,
                ratio: 0.5,
                isExclusion: false,
              },
            ],
          },
        ],
      }));
    });

    const summary = selectSummaryMetrics(useMappingStore.getState());
    expect(summary.excludedTotal).toBe(15000 + 20000);
    expect(summary.netTotal).toBe(700000 - (15000 + 20000));
  });

  it('tracks status counts across all mapping rows', () => {
    const counts = selectStatusCounts(useMappingStore.getState());
    expect(counts).toEqual({
      New: 1,
      Unmapped: 0,
      Mapped: 2,
      Excluded: 1,
    });
  });

  it('loads imported rows into mapping state', () => {
    const rows: TrialBalanceRow[] = [
      {
        accountId: '1000',
        description: 'Cash',
        entity: 'HQ',
        netChange: 1250,
        glMonth: '2024-01',
      },
      {
        accountId: '2000',
        description: 'Revenue',
        entity: 'HQ',
        netChange: -1250,
        glMonth: '2024-01',
      },
    ];

    act(() => {
      useMappingStore
        .getState()
        .loadImportedAccounts({
          uploadId: 'import-1',
          clientId: 'cli-123',
          companyIds: ['ent-1'],
          period: '2024-01',
          rows,
        });
    });

    const state = useMappingStore.getState();
    expect(state.accounts).toHaveLength(2);
    expect(state.accounts[0]).toEqual(
      expect.objectContaining({
        accountId: '1000',
        status: 'Unmapped',
        mappingType: 'direct',
      }),
    );
    expect(state.activeUploadId).toBe('import-1');
    expect(state.activeClientId).toBe('cli-123');
    expect(state.activeCompanyIds).toEqual(['ent-1']);
    expect(state.activePeriod).toBe('2024-01');
  });
});
