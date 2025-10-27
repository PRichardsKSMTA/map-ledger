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
      Unmapped: 1,
      Mapped: 1,
      Excluded: 1,
    });
  });
});
