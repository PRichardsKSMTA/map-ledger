import { act } from 'react-dom/test-utils';
import DistributionPane from '../components/mapping/DistributionPane';
import { useRatioAllocationStore } from '../store/ratioAllocationStore';

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
    results: snapshot.results.map(result => ({
      ...result,
      allocations: result.allocations.map(allocation => ({ ...allocation })),
    })),
  };
})();

const resetRatioStore = () => {
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
    selectedPeriod: null,
    results: initialRatioSnapshot.results.map(result => ({
      ...result,
      allocations: result.allocations.map(allocation => ({ ...allocation })),
    })),
    isProcessing: false,
  });
};

describe('DistributionPane', () => {
  beforeEach(() => {
    resetRatioStore();
  });

  test('renders SCoA tree and allocation editor', () => {
    render(<DistributionPane initialSourceAccountId="1234456" />);

    expect(screen.getByText('SCoA tree')).toBeInTheDocument();
    expect(screen.getByText('Payroll Tax Allocation')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Target datapoint').length).toBeGreaterThan(0);
  });

  test('allows selecting reporting period and basis', () => {
    render(<DistributionPane initialSourceAccountId="1234456" />);

    const periodSelect = screen.getByLabelText('Reporting period') as HTMLSelectElement;
    fireEvent.change(periodSelect, { target: { value: '2024-09' } });
    expect(periodSelect.value).toBe('2024-09');

    const basisSelect = screen.getByLabelText('Basis metric') as HTMLSelectElement;
    act(() => {
      fireEvent.change(basisSelect, { target: { value: basisSelect.options[0].value } });
    });
    expect(basisSelect.value).toBe(basisSelect.options[0].value);
  });
});
