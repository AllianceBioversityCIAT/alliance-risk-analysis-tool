import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ForgotPasswordForm } from '../forgot-password-form';

const mockPost = jest.fn();
jest.mock('@/lib/api-client', () => ({
  __esModule: true,
  default: { post: (...args: unknown[]) => mockPost(...args) },
}));



jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe('ForgotPasswordForm', () => {
  const mockOnSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderForm = () => render(<ForgotPasswordForm onSuccess={mockOnSuccess} />);

  // ─── Step 1: Email ──────────────────────────────────────────────────────────

  it('should render the email step by default', () => {
    renderForm();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send reset code/i })).toBeInTheDocument();
  });

  it('should show validation error for empty email', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('button', { name: /send reset code/i }));

    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
    });
  });

  it('should show validation error for invalid email format', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/email address/i), 'not-an-email');
    await user.click(screen.getByRole('button', { name: /send reset code/i }));

    await waitFor(() => {
      expect(screen.getByText(/valid email/i)).toBeInTheDocument();
    });
  });

  it('should advance to the reset step after successfully sending code', async () => {
    const user = userEvent.setup();
    mockPost.mockResolvedValueOnce({ data: {} });

    renderForm();

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /send reset code/i }));

    await waitFor(() => {
      // Step 2 should now be visible
      expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
      // Shows the email that was used
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });
  });

  it('should show server error when send code fails', async () => {
    const user = userEvent.setup();
    mockPost.mockRejectedValueOnce({
      response: { data: { message: 'Too many requests' } },
    });

    renderForm();

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /send reset code/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Too many requests');
    });
  });

  // ─── Step 2: Code + New Password ──────────────────────────────────────────

  const advanceToStep2 = async () => {
    const user = userEvent.setup();
    mockPost.mockResolvedValueOnce({ data: {} });

    renderForm();

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /send reset code/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
    });

    return user;
  };

  it('should show validation error for missing verification code', async () => {
    const user = await advanceToStep2();

    await user.type(screen.getByLabelText('New password'), 'NewPassword1!');
    await user.type(screen.getByLabelText('Confirm password'), 'NewPassword1!');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(screen.getByText(/verification code is required/i)).toBeInTheDocument();
    });
  });

  it('should show error when passwords do not match', async () => {
    const user = await advanceToStep2();

    await user.type(screen.getByLabelText(/verification code/i), '123456');
    await user.type(screen.getByLabelText('New password'), 'NewPassword1!');
    await user.type(screen.getByLabelText('Confirm password'), 'DifferentPass1!');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
  });

  it('should call onSuccess after successful password reset', async () => {
    // Pre-queue BOTH mocks before any interaction
    mockPost
      .mockResolvedValueOnce({ data: {} }) // step 1: forgot-password
      .mockResolvedValueOnce({ data: {} }); // step 2: reset-password

    // Use advanceToStep2 for step 1 (same pattern as passing tests)
    await advanceToStep2();
    // We need a second mock for step 2 (advanceToStep2 only queued one for step 1)
    mockPost.mockResolvedValueOnce({ data: {} }); // step 2: reset-password

    // Create a FRESH userEvent instance with delay to allow React 19 to flush
    // state updates between keystrokes (React 19 changed controlled input behavior)
    // Create a fresh userEvent instance for step 2
    const user2 = userEvent.setup();
    await user2.type(screen.getByLabelText(/verification code/i), '123456');
    await user2.type(screen.getByLabelText('New password'), 'NewPassword1!');
    await user2.type(screen.getByLabelText('Confirm password'), 'NewPassword1!');
    await user2.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it('should allow going back to step 1 via "Try again" button', async () => {
    const user = await advanceToStep2();

    await user.click(screen.getByText(/try again/i));

    // Back to step 1
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /send reset code/i })).toBeInTheDocument();
    });
  });
});
