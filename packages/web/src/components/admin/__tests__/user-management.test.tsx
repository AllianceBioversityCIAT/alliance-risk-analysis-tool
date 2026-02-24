import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UserManagement } from '../user-management';

// Mock hooks
const mockUseUsers = jest.fn();
const mockUseDeleteUser = jest.fn();

jest.mock('@/hooks/use-users', () => ({
  useUsers: (...args: unknown[]) => mockUseUsers(...args),
  useDeleteUser: () => mockUseDeleteUser(),
  useCreateUser: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useUpdateUser: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useEnableUser: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useDisableUser: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useResetUserPassword: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useAddUserToGroup: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useRemoveUserFromGroup: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useGroups: () => ({ data: { groups: ['admin', 'users'] } }),
}));

const mockUsers = [
  {
    username: 'alice@example.com',
    email: 'alice@example.com',
    enabled: true,
    userStatus: 'CONFIRMED',
    groups: ['admin'],
    isAdmin: true,
    createdDate: '2025-01-01T00:00:00Z',
    lastModifiedDate: '2025-06-01T00:00:00Z',
  },
  {
    username: 'bob@example.com',
    email: 'bob@example.com',
    enabled: true,
    userStatus: 'CONFIRMED',
    groups: [],
    isAdmin: false,
    createdDate: '2025-02-01T00:00:00Z',
    lastModifiedDate: '2025-07-01T00:00:00Z',
  },
  {
    username: 'carol@example.com',
    email: 'carol@example.com',
    enabled: false,
    userStatus: 'FORCE_CHANGE_PASSWORD',
    groups: [],
    isAdmin: false,
    createdDate: '2025-03-01T00:00:00Z',
    lastModifiedDate: '2025-08-01T00:00:00Z',
  },
];

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe('UserManagement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseUsers.mockReturnValue({
      data: { users: mockUsers },
      isLoading: false,
      isError: false,
    });
    mockUseDeleteUser.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    });
  });

  it('should render the user table with all users', () => {
    renderWithQuery(<UserManagement />);
    // Each email may appear twice (as username label + email column) - just verify presence
    expect(screen.getAllByText('alice@example.com').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('bob@example.com').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('carol@example.com').length).toBeGreaterThanOrEqual(1);
  });

  it('should show loading skeletons when fetching', () => {
    mockUseUsers.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    renderWithQuery(<UserManagement />);
    // Table rows still render, just with skeleton placeholders
    const rows = screen.getAllByRole('row');
    // Header + 5 skeleton rows
    expect(rows.length).toBeGreaterThan(1);
  });

  it('should show an error message when fetch fails', () => {
    mockUseUsers.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    renderWithQuery(<UserManagement />);
    expect(screen.getByText(/failed to load users/i)).toBeInTheDocument();
  });

  it('should display role badges correctly', () => {
    renderWithQuery(<UserManagement />);
    const adminBadges = screen.getAllByText('Admin');
    expect(adminBadges.length).toBeGreaterThanOrEqual(1);
    const userBadges = screen.getAllByText('User');
    expect(userBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('should display active/inactive status badges', () => {
    renderWithQuery(<UserManagement />);
    const activeBadges = screen.getAllByText('Active');
    expect(activeBadges.length).toBe(2); // alice and bob
    const inactiveBadges = screen.getAllByText('Inactive');
    expect(inactiveBadges.length).toBe(1); // carol
  });

  it('should filter users by search query', async () => {
    const user = userEvent.setup();
    renderWithQuery(<UserManagement />);

    await user.type(screen.getByRole('textbox', { name: /search/i }), 'alice');

    await waitFor(() => {
      expect(screen.getAllByText('alice@example.com').length).toBeGreaterThanOrEqual(1);
      expect(screen.queryByText('bob@example.com')).not.toBeInTheDocument();
    });
  });

  it('should filter users by status (inactive)', async () => {
    const user = userEvent.setup();
    renderWithQuery(<UserManagement />);

    const statusTrigger = screen.getByRole('combobox', { name: /filter by status/i });
    await user.click(statusTrigger);

    const inactiveOption = screen.getByRole('option', { name: /inactive/i });
    await user.click(inactiveOption);

    await waitFor(() => {
      expect(screen.getAllByText('carol@example.com').length).toBeGreaterThanOrEqual(1);
      expect(screen.queryByText('alice@example.com')).not.toBeInTheDocument();
      expect(screen.queryByText('bob@example.com')).not.toBeInTheDocument();
    });
  });

  it('should filter users by role (admin)', async () => {
    const user = userEvent.setup();
    renderWithQuery(<UserManagement />);

    const roleTrigger = screen.getByRole('combobox', { name: /filter by role/i });
    await user.click(roleTrigger);

    const adminOption = screen.getByRole('option', { name: /^admin$/i });
    await user.click(adminOption);

    await waitFor(() => {
      expect(screen.getAllByText('alice@example.com').length).toBeGreaterThanOrEqual(1);
      expect(screen.queryByText('bob@example.com')).not.toBeInTheDocument();
    });
  });

  it('should open create user modal when Add User is clicked', async () => {
    const user = userEvent.setup();
    renderWithQuery(<UserManagement />);

    await user.click(screen.getByRole('button', { name: /add user/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Create New User')).toBeInTheDocument();
    });
  });

  it('should open edit modal when edit button is clicked', async () => {
    const user = userEvent.setup();
    renderWithQuery(<UserManagement />);

    const editButton = screen.getByRole('button', { name: /edit alice@example.com/i });
    await user.click(editButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Edit User')).toBeInTheDocument();
    });
  });

  it('should open delete confirmation dialog when delete button is clicked', async () => {
    const user = userEvent.setup();
    renderWithQuery(<UserManagement />);

    const deleteButton = screen.getByRole('button', { name: /delete alice@example.com/i });
    await user.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/delete user/i)).toBeInTheDocument();
      expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    });
  });

  it('should call deleteUser.mutateAsync when delete is confirmed', async () => {
    const mockMutateAsync = jest.fn().mockResolvedValueOnce(undefined);
    mockUseDeleteUser.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });

    const user = userEvent.setup();
    renderWithQuery(<UserManagement />);

    await user.click(screen.getByRole('button', { name: /delete alice@example.com/i }));
    await waitFor(() => screen.getByRole('dialog'));

    const dialog = screen.getByRole('dialog');
    const confirmButton = within(dialog).getByRole('button', { name: /^delete$/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith('alice@example.com');
    });
  });

  it('should show results count pagination text', () => {
    renderWithQuery(<UserManagement />);
    expect(screen.getByText(/showing 3 results/i)).toBeInTheDocument();
  });

  it('should show empty state when no users match filter', async () => {
    const user = userEvent.setup();
    renderWithQuery(<UserManagement />);

    await user.type(
      screen.getByRole('textbox', { name: /search/i }),
      'nonexistentuserxyz',
    );

    await waitFor(() => {
      expect(screen.getByText(/no users found/i)).toBeInTheDocument();
    });
  });
});
