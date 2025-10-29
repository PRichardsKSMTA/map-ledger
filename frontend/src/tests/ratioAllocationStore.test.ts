import { act } from '@testing-library/react';
import { useRatioAllocationStore } from '../store/ratioAllocationStore';

const resetStore = () => {
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
};

describe('ratioAllocationStore', () => {
  beforeEach(() => {
    resetStore();
  });

  it('toggles dynamic datapoint groups on an allocation', () => {
    const basisAccount = {
      id: 'basis-1',
      name: 'Operations hours',
      description: 'Operations driver',
      value: 1200,
      mappedTargetId: 'ops-target',
      valuesByPeriod: { '2024-01': 1200 },
    };
    const group = {
      id: 'group-1',
      label: 'Operations ratio',
      targetId: '6000',
      targetName: 'Operations expense',
      members: [{ accountId: basisAccount.id, accountName: basisAccount.name }],
    };
    const allocation = {
      id: 'allocation-1',
      name: 'Operations allocation',
      sourceAccount: {
        id: '4000',
        number: '4000',
        description: 'Operations revenue',
      },
      targetDatapoints: [],
      effectiveDate: new Date().toISOString(),
      status: 'active' as const,
    };

    act(() => {
      useRatioAllocationStore.setState(state => ({
        ...state,
        basisAccounts: [basisAccount],
        groups: [group],
        allocations: [allocation],
      }));
    });

    act(() => {
      useRatioAllocationStore.getState().toggleAllocationGroupTarget('allocation-1', 'group-1');
    });

    let updatedAllocation = useRatioAllocationStore.getState().allocations[0];
    expect(updatedAllocation.targetDatapoints).toHaveLength(1);
    expect(updatedAllocation.targetDatapoints[0]).toMatchObject({
      datapointId: group.targetId,
      groupId: group.id,
      name: group.targetName,
    });
    expect(updatedAllocation.targetDatapoints[0].ratioMetric).toMatchObject({
      id: group.id,
      name: `${group.label} total`,
      value: 1200,
    });

    act(() => {
      useRatioAllocationStore.getState().toggleAllocationGroupTarget('allocation-1', 'group-1');
    });

    updatedAllocation = useRatioAllocationStore.getState().allocations[0];
    expect(updatedAllocation.targetDatapoints).toHaveLength(0);
  });
});
