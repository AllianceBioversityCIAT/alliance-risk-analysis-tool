import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from '../login-form';

// ─── Module mocks ─────────────────────────────────────────────────────────────

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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('LoginForm', () => {
  const mockOnSuccess = jest.fn();
  const mockOnPasswordChangeRequired = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderForm = () =>
    render(
      <LoginForm
        onSuccess={mockOnSuccess}
        onPasswordChangeRequired={mockOnPasswordChangeRequired}
      />,
    );

  it('should render email, password fields, remember me checkbox, and submit button', () => {
    renderForm();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/remember me/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
  });

  it('should display a "Forgot password?" link', () => {
    renderForm();
    const link = screen.getByText(/forgot password/i);
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', '/forgot-password');
  });

  it('should show validation error when email is missing', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
    });
  });

  it('should show validation error for password shorter than 8 chars', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'short');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    });
  });

  it('should show validation error for invalid email format', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/email address/i), 'not-an-email');
    await user.type(screen.getByLabelText(/^password/i), 'Password1!');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(screen.getByText(/valid email/i)).toBeInTheDocument();
    });
  });

  it('should toggle password visibility', async () => {
    const user = userEvent.setup();
    renderForm();

    const passwordInput = screen.getByLabelText(/^password/i);
    expect(passwordInput).toHaveAttribute('type', 'password');

    await user.click(screen.getByLabelText(/show password/i));
    expect(passwordInput).toHaveAttribute('type', 'text');

    await user.click(screen.getByLabelText(/hide password/i));
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('should call onSuccess after successful login', async () => {
    const user = userEvent.setup();
    mockPost.mockResolvedValueOnce({
      data: {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: 3600,
        requiresPasswordChange: false,
      },
    });

    renderForm();

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'Password1!');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it('should store tokens with rememberMe=true when checkbox is checked', async () => {
    const user = userEvent.setup();
    mockPost.mockResolvedValueOnce({
      data: {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: 3600,
        requiresPasswordChange: false,
      },
    });

    renderForm();

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'Password1!');
    await user.click(screen.getByLabelText(/remember me/i));
    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(mockSetTokens).toHaveBeenCalledWith(
        { accessToken: 'mock-access-token', refreshToken: 'mock-refresh-token' },
        true,
      );
    });
  });

  it('should store tokens with rememberMe=false when checkbox is not checked', async () => {
    const user = userEvent.setup();
    mockPost.mockResolvedValueOnce({
      data: {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: 3600,
        requiresPasswordChange: false,
      },
    });

    renderForm();

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'Password1!');
    // Do NOT click remember me
    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(mockSetTokens).toHaveBeenCalledWith(
        { accessToken: 'mock-access-token', refreshToken: 'mock-refresh-token' },
        false,
      );
    });
  });

  it('should call onPasswordChangeRequired when challenge is received', async () => {
    const user = userEvent.setup();
    mockPost.mockResolvedValueOnce({
      data: {
        requiresPasswordChange: true,
        session: 'mock-session',
        username: 'test@example.com',
      },
    });

    renderForm();

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'TempPass1!');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(mockOnPasswordChangeRequired).toHaveBeenCalledWith(
        'mock-session',
        'test@example.com',
      );
    });
  });

  it('should display server error on failed login', async () => {
    const user = userEvent.setup();
    mockPost.mockRejectedValueOnce({
      response: { data: { message: 'Invalid credentials' } },
    });

    renderForm();

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'WrongPass1!');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid credentials');
    });
  });

  it('should show a generic error message on unexpected failure', async () => {
    const user = userEvent.setup();
    mockPost.mockRejectedValueOnce(new Error('Network error'));

    renderForm();

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'Password1!');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/login failed/i);
    });
  });
});
