import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
}));

const mockUsePrompts = jest.fn();
const mockUseToggleActive = jest.fn();
const mockUseDeletePrompt = jest.fn();

jest.mock('@/hooks/use-prompts', () => ({
  usePrompts: (...args: unknown[]) => mockUsePrompts(...args),
  useToggleActive: () => mockUseToggleActive(),
  useDeletePrompt: () => mockUseDeletePrompt(),
}));

import { PromptList } from '../prompt-list';
import { AgentSection } from '@alliance-risk/shared';

const mockPrompts = [
  {
    id: 'prompt-1',
    name: 'Parser Prompt',
    section: AgentSection.PARSER,
    version: 1,
    isActive: true,
    categories: ['Financial'],
    tags: ['important'],
    commentsCount: 2,
    updatedAt: '2025-06-01T00:00:00Z',
  },
  {
    id: 'prompt-2',
    name: 'Gap Detector Prompt',
    section: AgentSection.GAP_DETECTOR,
    version: 3,
    isActive: false,
    categories: [],
    tags: [],
    commentsCount: 0,
    updatedAt: '2025-07-01T00:00:00Z',
  },
];

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('PromptList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePrompts.mockReturnValue({
      data: {
        prompts: mockPrompts,
        total: 2,
        page: 1,
        limit: 12,
        hasMore: false,
      },
      isLoading: false,
      isError: false,
    });
    mockUseToggleActive.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    mockUseDeletePrompt.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
  });

  it('should render all prompt cards', () => {
    renderWithQuery(<PromptList />);

    expect(screen.getByText('Parser Prompt')).toBeInTheDocument();
    expect(screen.getByText('Gap Detector Prompt')).toBeInTheDocument();
  });

  it('should show active/inactive badges on cards', () => {
    renderWithQuery(<PromptList />);

    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('should show loading skeletons when fetching', () => {
    mockUsePrompts.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    renderWithQuery(<PromptList />);

    const skeletons = screen.getAllByTestId('prompt-skeleton');
    expect(skeletons).toHaveLength(6);
  });

  it('should show error message when fetch fails', () => {
    mockUsePrompts.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    renderWithQuery(<PromptList />);

    expect(screen.getByText(/failed to load prompts/i)).toBeInTheDocument();
  });

  it('should show empty state when no prompts exist', () => {
    mockUsePrompts.mockReturnValue({
      data: { prompts: [], total: 0, page: 1, limit: 12, hasMore: false },
      isLoading: false,
      isError: false,
    });
    renderWithQuery(<PromptList />);

    expect(screen.getByText(/no prompts found/i)).toBeInTheDocument();
  });

  it('should navigate to create page when Create New Prompt is clicked', async () => {
    const user = userEvent.setup();
    renderWithQuery(<PromptList />);

    await user.click(screen.getByRole('button', { name: /create new prompt/i }));

    expect(mockPush).toHaveBeenCalledWith('/admin/prompt-manager/create');
  });

  it('should navigate to edit page when edit button is clicked', async () => {
    const user = userEvent.setup();
    renderWithQuery(<PromptList />);

    await user.click(screen.getByRole('button', { name: /edit parser prompt/i }));

    expect(mockPush).toHaveBeenCalledWith('/admin/prompt-manager/edit?id=prompt-1');
  });

  it('should open delete confirmation when delete button is clicked', async () => {
    const user = userEvent.setup();
    renderWithQuery(<PromptList />);

    await user.click(screen.getByRole('button', { name: /delete parser prompt/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/delete prompt/i)).toBeInTheDocument();
    });
  });

  it('should call toggleActive when toggle button is clicked', async () => {
    const mockMutateAsync = jest.fn().mockResolvedValueOnce({});
    mockUseToggleActive.mockReturnValue({ mutateAsync: mockMutateAsync, isPending: false });

    const user = userEvent.setup();
    renderWithQuery(<PromptList />);

    await user.click(screen.getByRole('button', { name: /deactivate parser prompt/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith('prompt-1');
    });
  });
});
