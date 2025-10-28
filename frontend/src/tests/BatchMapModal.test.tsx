import { render, screen, within } from '@testing-library/react';
import BatchMapModal from '../components/mapping/BatchMapModal';
import { listSeedDatapoints } from '../data/coaSeeds';

describe('BatchMapModal', () => {
  it('renders all COA options in the batch mapping selector', () => {
    const datapoints = listSeedDatapoints();

    render(
      <BatchMapModal
        open
        datapoints={datapoints}
        selectedCount={3}
        onClose={jest.fn()}
        onApply={jest.fn()}
      />,
    );

    const targetSelect = screen.getByLabelText('Target SCoA');
    const optionLabels = within(targetSelect)
      .getAllByRole('option')
      .map(option => option.textContent?.trim())
      .filter((label): label is string => Boolean(label));

    datapoints.forEach(datapoint => {
      expect(optionLabels).toContain(datapoint.accountName);
    });
  });
});
