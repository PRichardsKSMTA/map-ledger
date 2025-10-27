import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Mapping from '../pages/Mapping';
import { useClientStore } from '../store/clientStore';
import { useMappingStore, createInitialMappingAccounts } from '../store/mappingStore';
import { useRatioAllocationStore } from '../store/ratioAllocationStore';

const clientSnapshot = (() => {
  const { clients } = useClientStore.getState();
  return clients.map(client => ({ ...client }));
})();

const ratioSnapshot = (() => {
  const { allocations, metrics } = useRatioAllocationStore.getState();
  return {
    allocations: allocations.map(allocation => ({
      ...allocation,
      sourceAccount: { ...allocation.sourceAccount },
      targetDatapoints: allocation.targetDatapoints.map(target => ({
        ...target,
        ratioMetric: { ...target.ratioMetric },
      })),
    })),
    metrics: metrics.map(metric => ({ ...metric })),
  };
})();

const resetClientStore = () => {
  useClientStore.setState({
    clients: clientSnapshot.map(client => ({ ...client })),
  });
};

const resetMappingStore = () => {
  useMappingStore.setState({
    accounts: createInitialMappingAccounts(),
    searchTerm: '',
    activeStatuses: [],
  });
};

const resetRatioStore = () => {
  useRatioAllocationStore.setState({
    allocations: ratioSnapshot.allocations.map(allocation => ({
      ...allocation,
      sourceAccount: { ...allocation.sourceAccount },
      targetDatapoints: allocation.targetDatapoints.map(target => ({
        ...target,
        ratioMetric: { ...target.ratioMetric },
      })),
    })),
    metrics: ratioSnapshot.metrics.map(metric => ({ ...metric })),
    selectedPeriod: null,
    results: [],
    isProcessing: false,
  });
};

describe('Mapping page layout', () => {
  beforeEach(() => {
    resetClientStore();
    resetMappingStore();
    resetRatioStore();
  });

  afterEach(() => {
    resetClientStore();
    resetMappingStore();
    resetRatioStore();
  });

  it('renders full-width workspace while preserving responsive padding', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/gl/mapping/demo']}>
        <Routes>
          <Route path="/gl/mapping/:uploadId" element={<Mapping />} />
        </Routes>
      </MemoryRouter>
    );

    const page = screen.getByTestId('mapping-page');
    expect(page).toHaveClass('px-4');
    expect(page).toHaveClass('sm:px-6');
    expect(page).toHaveClass('lg:px-8');

    const workspace = screen.getByRole('region', { name: 'Mapping workspace content' });
    expect(workspace).toHaveClass('w-full');

    expect(container.querySelector('.max-w-7xl')).toBeNull();
  });
});
