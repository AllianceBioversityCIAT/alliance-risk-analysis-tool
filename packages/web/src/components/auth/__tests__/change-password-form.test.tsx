import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChangePasswordForm } from '../change-password-form';

const mockPost = jest.fn();
jest.mock('@/lib/api-client', () => ({
  __esModule: true,
  default: { post: (...args: unknown[]) => mockPost(...args) },
}));

const mockSetTokens = jest.fn();
jest.mock('@/lib/token-manager', () => ({
  tokenManager: {
    setTokens: (...args: unknown[]) => mockSetTokens(...args),
    clearTokens: jest.fn(),
    isAuthenticated: jest.fn().mockReturnValue(false),
    getAccessToken: jest.fn().mockReturnValue(null),
    getRefreshToken: jest.fn().mockReturnValue(null),
  },
}));

describe('ChangePasswordForm', () => {
  const defaultProps = {
    username: 'test@example.com',
    session: 'mock-session',
    onSuccess: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderForm = (props = defaultProps) => render(<ChangePasswordForm {...props} />);

  // Helper to get fields by their exact labels
  const getNewPasswordInput = () => screen.getByLabelText('New password');
  const getConfirmPasswordInput = () => screen.getByLabelText('Confirm new password');

  it('should render new password and confirm password fields', () => {
    renderForm();
    expect(getNewPasswordInput()).toBeInTheDocument();
    expect(getConfirmPasswordInput()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /set new password/i })).toBeInTheDocument();
  });

  it('should show validation error for password shorter than 8 chars', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(getNewPasswordInput(), 'short');
    await user.type(getConfirmPasswordInput(), 'short');
    await user.click(screen.getByRole('button', { name: /set new password/i }));

    await waitFor(() => {
      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    });
  });

  it('should show validation error when password lacks uppercase', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(getNewPasswordInput(), 'password1!');
    await user.click(screen.getByRole('button', { name: /set new password/i }));

    await waitFor(() => {
      expect(screen.getByText(/uppercase letter/i)).toBeInTheDocument();
    });
  });

  it('should show validation error when password lacks a number', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(getNewPasswordInput(), 'PasswordOnly!');
    await user.click(screen.getByRole('button', { name: /set new password/i }));

    await waitFor(() => {
      expect(screen.getByText(/one number/i)).toBeInTheDocument();
    });
  });

  it('should show error when passwords do not match', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(getNewPasswordInput(), 'NewPassword1!');
    await user.type(getConfirmPasswordInput(), 'DifferentPass1!');
    await user.click(screen.getByRole('button', { name: /set new password/i }));

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
  });

  it('should show password requirements checklist when typing', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(getNewPasswordInput(), 'Pass');

    await waitFor(() => {
      // The checklist is a <ul> with aria-label="Password requirements"
      const list = screen.getByRole('list', { name: /password requirements/i });
      expect(list).toBeInTheDocument();
    });
  });

  it('should call onSuccess and store tokens after successful password change', async () => {
    const user = userEvent.setup();
    mockPost.mockResolvedValueOnce({
      data: {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      },
    });

    renderForm();

    await user.type(getNewPasswordInput(), 'NewPassword1!');
    await user.type(getConfirmPasswordInput(), 'NewPassword1!');
    await user.click(screen.getByRole('button', { name: /set new password/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/api/auth/complete-password-change', {
        username: 'test@example.com',
        session: 'mock-session',
        newPassword: 'NewPassword1!',
      });
      expect(mockSetTokens).toHaveBeenCalledWith(
        { accessToken: 'new-access-token', refreshToken: 'new-refresh-token' },
        false,
      );
      expect(defaultProps.onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it('should display server error on failed password change', async () => {
    const user = userEvent.setup();
    mockPost.mockRejectedValueOnce({
      response: { data: { message: 'Session expired' } },
    });

    renderForm();

    await user.type(getNewPasswordInput(), 'NewPassword1!');
    await user.type(getConfirmPasswordInput(), 'NewPassword1!');
    await user.click(screen.getByRole('button', { name: /set new password/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Session expired');
    });
  });
});
