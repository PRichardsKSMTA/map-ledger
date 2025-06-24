import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { useAuthStore } from '../store/authStore';

afterEach(() => {
  useAuthStore.setState({ user: null, isAuthenticated: false });
});

test('successful login sets auth state and redirects to dashboard', async () => {
  render(<App />);

  await userEvent.type(screen.getByLabelText(/email address/i), 'john@example.com');
  await userEvent.type(screen.getByLabelText(/password/i), 'secret');
  await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

  expect(useAuthStore.getState().isAuthenticated).toBe(true);
  expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
});

test('unauthenticated access redirects to login', () => {
  window.history.pushState({}, '', '/users');
  render(<App />);
  expect(screen.getByText(/sign in to mapledger/i)).toBeInTheDocument();
});
