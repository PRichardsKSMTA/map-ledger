import { fireEvent, render, screen, within } from '@testing-library/react';
import MappingTable from '../components/mapping/MappingTable';
import { createInitialMappingAccounts, useMappingStore } from '../store/mappingStore';
import { STANDARD_CHART_OF_ACCOUNTS } from '../data/standardChartOfAccounts';

const resetMappingStore = () => {
  useMappingStore.setState({
    accounts: createInitialMappingAccounts(),
    searchTerm: '',
    activeStatuses: [],
  });
};

describe('MappingTable', () => {
  beforeEach(() => {
    resetMappingStore();
  });

  test('updates mapping type when a new option is selected', () => {
    render(<MappingTable />);

    const mappingTypeSelect = screen.getByLabelText('Select mapping type for Payroll Taxes');
    expect(mappingTypeSelect).toHaveValue('percentage');

    fireEvent.change(mappingTypeSelect, { target: { value: 'direct' } });

    const updatedAccount = useMappingStore
      .getState()
      .accounts.find(account => account.accountName === 'Payroll Taxes');
    expect(updatedAccount?.mappingType).toBe('direct');
    expect(mappingTypeSelect).toHaveValue('direct');
  });

  test('lists all COA datapoints in the target selector', () => {
    render(<MappingTable />);

    const targetSelect = screen.getByLabelText('Select target SCoA for Fuel Expense');
    const optionLabels = within(targetSelect)
      .getAllByRole('option')
      .map(option => option.textContent?.trim())
      .filter((label): label is string => Boolean(label));

    STANDARD_CHART_OF_ACCOUNTS.forEach(option => {
      expect(optionLabels).toContain(option.label);
    });
  });
});

