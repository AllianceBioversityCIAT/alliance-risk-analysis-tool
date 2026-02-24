import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock next/navigation
const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

const mockUseCreatePrompt = jest.fn();
const mockUseUpdatePrompt = jest.fn();
const mockUsePromptComments = jest.fn();
const mockUseAddComment = jest.fn();
const mockUsePromptHistory = jest.fn();

jest.mock('@/hooks/use-prompts', () => ({
  useCreatePrompt: () => mockUseCreatePrompt(),
  useUpdatePrompt: () => mockUseUpdatePrompt(),
  usePromptComments: (...args: unknown[]) => mockUsePromptComments(...args),
  useAddComment: (...args: unknown[]) => mockUseAddComment(...args),
  usePromptHistory: (...args: unknown[]) => mockUsePromptHistory(...args),
}));

import { PromptEditorForm } from '../prompt-editor-form';
import { AgentSection } from '@alliance-risk/shared';
import type { PromptDetail } from '@alliance-risk/shared';

const mockExistingPrompt: PromptDetail = {
  id: 'prompt-1',
  name: 'Parser Prompt',
  section: AgentSection.PARSER,
  subSection: 'Sub A',
  route: '/route-a',
  systemPrompt: 'You are an expert.',
  userPromptTemplate: 'Analyze {{category_1}}',
  tone: 'Professional',
  outputFormat: 'JSON',
  isActive: true,
  version: 2,
  categories: ['Financial', 'Operational'],
  tags: ['important', 'production'],
  commentsCount: 3,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-06-01T00:00:00Z',
};

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('PromptEditorForm — create mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCreatePrompt.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    mockUseUpdatePrompt.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    mockUsePromptComments.mockReturnValue({ data: [], isLoading: false });
    mockUseAddComment.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    mockUsePromptHistory.mockReturnValue({ data: [], isLoading: false });
  });

  it('renders the create form heading', () => {
    renderWithQuery(<PromptEditorForm mode="create" />);
    expect(screen.getByText('Create New Prompt')).toBeInTheDocument();
  });

  it('renders all required fields', () => {
    renderWithQuery(<PromptEditorForm mode="create" />);
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/system prompt/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/user prompt template/i)).toBeInTheDocument();
  });

  it('shows validation errors when submitting empty form', async () => {
    const user = userEvent.setup();
    renderWithQuery(<PromptEditorForm mode="create" />);

    await user.click(screen.getByRole('button', { name: /create prompt/i }));

    await waitFor(() => {
      expect(screen.getByText('Name is required')).toBeInTheDocument();
    });
  });

  it('shows validation error when system prompt is missing', async () => {
    const user = userEvent.setup();
    renderWithQuery(<PromptEditorForm mode="create" />);

    await user.type(screen.getByLabelText(/^name/i), 'Test Prompt');
    await user.click(screen.getByRole('button', { name: /create prompt/i }));

    await waitFor(() => {
      expect(screen.getByText('System prompt is required')).toBeInTheDocument();
    });
  });

  it('calls createPrompt.mutateAsync with form values on valid submit', async () => {
    const mockMutateAsync = jest.fn().mockResolvedValueOnce({});
    mockUseCreatePrompt.mockReturnValue({ mutateAsync: mockMutateAsync, isPending: false });

    const user = userEvent.setup();
    renderWithQuery(<PromptEditorForm mode="create" />);

    await user.type(screen.getByLabelText(/^name/i), 'My Prompt');
    // Use fireEvent.change for fields with special chars like {{ }} to avoid userEvent bracket interpretation
    fireEvent.change(screen.getByLabelText(/system prompt/i), {
      target: { value: 'You are an expert.' },
    });
    fireEvent.change(screen.getByLabelText(/user prompt template/i), {
      target: { value: 'Analyze {{category_1}}' },
    });

    // Open the section Select and pick Parser
    await user.click(screen.getByRole('combobox', { name: /select section/i }));
    await user.click(screen.getByRole('option', { name: /parser/i }));

    await user.click(screen.getByRole('button', { name: /create prompt/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'My Prompt',
          systemPrompt: 'You are an expert.',
          userPromptTemplate: 'Analyze {{category_1}}',
          section: AgentSection.PARSER,
          categories: [],
          tags: [],
        }),
      );
    });
  });

  it('navigates back to prompt-manager on successful create', async () => {
    const mockMutateAsync = jest.fn().mockResolvedValueOnce({});
    mockUseCreatePrompt.mockReturnValue({ mutateAsync: mockMutateAsync, isPending: false });

    const user = userEvent.setup();
    renderWithQuery(<PromptEditorForm mode="create" />);

    await user.type(screen.getByLabelText(/^name/i), 'My Prompt');
    fireEvent.change(screen.getByLabelText(/system prompt/i), {
      target: { value: 'You are an expert.' },
    });
    fireEvent.change(screen.getByLabelText(/user prompt template/i), {
      target: { value: 'Analyze {{category_1}}' },
    });
    await user.click(screen.getByRole('combobox', { name: /select section/i }));
    await user.click(screen.getByRole('option', { name: /parser/i }));

    await user.click(screen.getByRole('button', { name: /create prompt/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/admin/prompt-manager');
    });
  });

  it('shows server error when create fails', async () => {
    const mockMutateAsync = jest.fn().mockRejectedValueOnce({
      response: { data: { message: 'Duplicate prompt name' } },
    });
    mockUseCreatePrompt.mockReturnValue({ mutateAsync: mockMutateAsync, isPending: false });

    const user = userEvent.setup();
    renderWithQuery(<PromptEditorForm mode="create" />);

    await user.type(screen.getByLabelText(/^name/i), 'My Prompt');
    fireEvent.change(screen.getByLabelText(/system prompt/i), {
      target: { value: 'You are an expert.' },
    });
    fireEvent.change(screen.getByLabelText(/user prompt template/i), {
      target: { value: 'Analyze {{category_1}}' },
    });
    await user.click(screen.getByRole('combobox', { name: /select section/i }));
    await user.click(screen.getByRole('option', { name: /parser/i }));

    await user.click(screen.getByRole('button', { name: /create prompt/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Duplicate prompt name');
    });
  });

  it('can add and remove a category', async () => {
    const user = userEvent.setup();
    renderWithQuery(<PromptEditorForm mode="create" />);

    const categoryInput = screen.getByLabelText(/new category/i);
    await user.type(categoryInput, 'Financial');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText('Financial')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /remove category financial/i }));

    await waitFor(() => {
      expect(screen.queryByText('Financial')).not.toBeInTheDocument();
    });
  });

  it('can add a tag (slugified)', async () => {
    const user = userEvent.setup();
    renderWithQuery(<PromptEditorForm mode="create" />);

    const tagInput = screen.getByLabelText(/new tag/i);
    await user.type(tagInput, 'My Tag');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText('#my-tag')).toBeInTheDocument();
    });
  });

  it('navigates back when Back button is clicked', async () => {
    const user = userEvent.setup();
    renderWithQuery(<PromptEditorForm mode="create" />);

    await user.click(screen.getByRole('button', { name: /back/i }));

    expect(mockBack).toHaveBeenCalled();
  });
});

describe('PromptEditorForm — edit mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCreatePrompt.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    mockUseUpdatePrompt.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    mockUsePromptComments.mockReturnValue({ data: [], isLoading: false });
    mockUseAddComment.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    mockUsePromptHistory.mockReturnValue({ data: [], isLoading: false });
  });

  it('renders edit heading with prompt name', () => {
    renderWithQuery(<PromptEditorForm mode="edit" existingPrompt={mockExistingPrompt} />);
    expect(screen.getByText(`Edit: ${mockExistingPrompt.name}`)).toBeInTheDocument();
  });

  it('pre-fills form fields from existing prompt', () => {
    renderWithQuery(<PromptEditorForm mode="edit" existingPrompt={mockExistingPrompt} />);

    expect(screen.getByLabelText(/^name/i)).toHaveValue('Parser Prompt');
    expect(screen.getByLabelText(/system prompt/i)).toHaveValue('You are an expert.');
    expect(screen.getByLabelText(/user prompt template/i)).toHaveValue('Analyze {{category_1}}');
  });

  it('shows existing categories as badges', () => {
    renderWithQuery(<PromptEditorForm mode="edit" existingPrompt={mockExistingPrompt} />);

    expect(screen.getByText('Financial')).toBeInTheDocument();
    expect(screen.getByText('Operational')).toBeInTheDocument();
  });

  it('shows version and status metadata', () => {
    renderWithQuery(<PromptEditorForm mode="edit" existingPrompt={mockExistingPrompt} />);

    // The metadata paragraph contains "Version 2 · Active"
    expect(screen.getByText(/version 2/i)).toBeInTheDocument();
    // Multiple "Active" elements exist (metadata + isActive label), so use getAllByText
    const activeElements = screen.getAllByText(/^active$/i);
    expect(activeElements.length).toBeGreaterThanOrEqual(1);
  });

  it('calls updatePrompt.mutateAsync on valid submit', async () => {
    const mockMutateAsync = jest.fn().mockResolvedValueOnce({});
    mockUseUpdatePrompt.mockReturnValue({ mutateAsync: mockMutateAsync, isPending: false });

    const user = userEvent.setup();
    renderWithQuery(<PromptEditorForm mode="edit" existingPrompt={mockExistingPrompt} />);

    // Clear and retype name
    const nameInput = screen.getByLabelText(/^name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Updated Parser Prompt');

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'prompt-1',
          payload: expect.objectContaining({
            name: 'Updated Parser Prompt',
          }),
        }),
      );
    });
  });

  it('shows Comments and History tabs in edit mode', () => {
    renderWithQuery(<PromptEditorForm mode="edit" existingPrompt={mockExistingPrompt} />);

    expect(screen.getByRole('tab', { name: /comments/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /history/i })).toBeInTheDocument();
  });

  it('does NOT show Comments/History tabs in create mode', () => {
    renderWithQuery(<PromptEditorForm mode="create" />);

    expect(screen.queryByRole('tab', { name: /comments/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /history/i })).not.toBeInTheDocument();
  });
});
