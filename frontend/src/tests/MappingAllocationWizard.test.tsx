import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MappingAllocationWizard from '../components/MappingAllocationWizard';

describe('MappingAllocationWizard', () => {
  test('clicking Configure Allocation moves to allocation stage', () => {
    render(
      <MemoryRouter>
        <MappingAllocationWizard glUploadId="1" />
      </MemoryRouter>
    );

    const btn = screen.getByText('Configure Allocation');
    fireEvent.click(btn);

    expect(screen.getByText('Back to Mapping')).toBeInTheDocument();
  });

  test('saving allocation and clicking Back returns to mapping stage', () => {
    render(
      <MemoryRouter initialEntries={[ '/?stage=allocation' ]}>
        <MappingAllocationWizard glUploadId="1" />
      </MemoryRouter>
    );

    const back = screen.getByText('Back to Mapping');
    fireEvent.click(back);

    expect(screen.getByText('Configure Allocation')).toBeInTheDocument();
  });
});
