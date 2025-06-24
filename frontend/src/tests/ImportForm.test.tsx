import { render, screen } from '@testing-library/react';
import ImportForm from '../components/import/ImportForm';

it('does not render operation selector', () => {
  render(<ImportForm onImport={jest.fn()} isImporting={false} />);
  expect(screen.queryByLabelText(/operation/i)).toBeNull();
});
