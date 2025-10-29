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
import type { TrialBalanceRow } from '../types';

describe('mappingStore selectors', () => {
  beforeEach(() => {
    useMappingStore.setState({
      accounts: createInitialMappingAccounts(),
      searchTerm: '',
      activeStatuses: [],
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
