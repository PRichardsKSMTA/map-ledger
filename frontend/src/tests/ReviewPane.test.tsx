import { fireEvent, render, screen } from '@testing-library/react';
import ReviewPane from '../components/mapping/ReviewPane';
import { useMappingStore } from '../store/mappingStore';
import { useRatioAllocationStore } from '../store/ratioAllocationStore';

const initialMappingSnapshot = (() => {
  const snapshot = useMappingStore.getState();
  return {
    accounts: snapshot.accounts.map(account => ({
      ...account,
      entities: account.entities.map(entity => ({ ...entity })),
      splitDefinitions: account.splitDefinitions.map(split => ({ ...split })),
    })),
    searchTerm: snapshot.searchTerm,
    activeStatuses: snapshot.activeStatuses.slice(),
  };
})();

const initialRatioSnapshot = (() => {
  const snapshot = useRatioAllocationStore.getState();
  return {
    allocations: snapshot.allocations.map(allocation => ({
      ...allocation,
      sourceAccount: { ...allocation.sourceAccount },
      targetDatapoints: allocation.targetDatapoints.map(target => ({
        ...target,
        ratioMetric: { ...target.ratioMetric },
      })),
    })),
    metrics: snapshot.metrics.map(metric => ({ ...metric })),
    selectedPeriod: snapshot.selectedPeriod,
    results: snapshot.results.map(result => ({
      ...result,
      allocations: result.allocations.map(allocation => ({ ...allocation })),
    })),
    isProcessing: snapshot.isProcessing,
  };
})();

const resetStores = () => {
  useMappingStore.setState({
    accounts: initialMappingSnapshot.accounts.map(account => ({
      ...account,
      entities: account.entities.map(entity => ({ ...entity })),
      splitDefinitions: account.splitDefinitions.map(split => ({ ...split })),
    })),
    searchTerm: initialMappingSnapshot.searchTerm,
    activeStatuses: initialMappingSnapshot.activeStatuses.slice(),
  });

  useRatioAllocationStore.setState({
    allocations: initialRatioSnapshot.allocations.map(allocation => ({
      ...allocation,
      sourceAccount: { ...allocation.sourceAccount },
      targetDatapoints: allocation.targetDatapoints.map(target => ({
        ...target,
        ratioMetric: { ...target.ratioMetric },
      })),
    })),
    metrics: initialRatioSnapshot.metrics.map(metric => ({ ...metric })),
    selectedPeriod: initialRatioSnapshot.selectedPeriod,
    results: initialRatioSnapshot.results.map(result => ({
      ...result,
      allocations: result.allocations.map(allocation => ({ ...allocation })),
    })),
    isProcessing: false,
  });
};

describe('ReviewPane', () => {
  beforeEach(() => {
    resetStores();
  });

  test('shows KPI cards and publish log', () => {
    render(<ReviewPane />);

    expect(screen.getByText('Review readiness')).toBeInTheDocument();
    expect(screen.getByText('Publish log')).toBeInTheDocument();
    expect(screen.getByText('Mapped accounts')).toBeInTheDocument();
  });

  test('runs checks and updates status message', () => {
    render(<ReviewPane />);

    const runChecks = screen.getByText('Run checks');
    fireEvent.click(runChecks);

    expect(
      screen.getByText(/Validation checks passed|Checks completed/i)
    ).toBeInTheDocument();
  });

  test('publishes mappings when no warnings exist', () => {
    render(<ReviewPane />);

    const publishButton = screen.getByText('Publish mappings');
    fireEvent.click(publishButton);

    expect(screen.getByText('Mappings published successfully.')).toBeInTheDocument();
  });
});
