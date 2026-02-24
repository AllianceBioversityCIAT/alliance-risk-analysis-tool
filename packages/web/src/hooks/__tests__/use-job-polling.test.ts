import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JobStatus } from '@alliance-risk/shared';
import { useJobPolling } from '../use-job-polling';

// Mock api-client
const mockGet = jest.fn();
jest.mock('@/lib/api-client', () => ({
  __esModule: true,
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    post: jest.fn(),
  },
}));

function makeJobResponse(status: JobStatus, overrides = {}) {
  return {
    id: 'job-1',
    type: 'AI_PREVIEW',
    status,
    result: status === JobStatus.COMPLETED ? { output: 'Preview text', tokensUsed: 50, processingTime: 1200 } : null,
    error: status === JobStatus.FAILED ? 'Bedrock error' : null,
    createdAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    completedAt: status === JobStatus.COMPLETED ? new Date().toISOString() : null,
    ...overrides,
  };
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  return { Wrapper, queryClient };
}

describe('useJobPolling', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts with null status and no result', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useJobPolling(), { wrapper: Wrapper });

    expect(result.current.status).toBeNull();
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isProcessing).toBe(false);
  });

  it('starts polling when startPolling is called', async () => {
    mockGet.mockResolvedValue({ data: { data: makeJobResponse(JobStatus.PROCESSING) } });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useJobPolling(), { wrapper: Wrapper });

    act(() => {
      result.current.startPolling('job-1');
    });

    await waitFor(() => {
      expect(result.current.status).toBe(JobStatus.PROCESSING);
    });

    expect(mockGet).toHaveBeenCalledWith('/api/jobs/job-1');
    expect(result.current.isProcessing).toBe(true);
  });

  it('stops polling when job reaches COMPLETED status', async () => {
    mockGet.mockResolvedValue({ data: { data: makeJobResponse(JobStatus.COMPLETED) } });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useJobPolling(), { wrapper: Wrapper });

    act(() => {
      result.current.startPolling('job-1');
    });

    await waitFor(() => {
      expect(result.current.status).toBe(JobStatus.COMPLETED);
    });

    expect(result.current.isProcessing).toBe(false);
    expect(result.current.result).toEqual(
      expect.objectContaining({ output: 'Preview text', tokensUsed: 50 }),
    );
    expect(result.current.error).toBeNull();
  });

  it('stops polling when job reaches FAILED status', async () => {
    mockGet.mockResolvedValue({ data: { data: makeJobResponse(JobStatus.FAILED) } });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useJobPolling(), { wrapper: Wrapper });

    act(() => {
      result.current.startPolling('job-1');
    });

    await waitFor(() => {
      expect(result.current.status).toBe(JobStatus.FAILED);
    });

    expect(result.current.isProcessing).toBe(false);
    expect(result.current.error).toBe('Bedrock error');
    expect(result.current.result).toBeNull();
  });

  it('resets all state when reset() is called', async () => {
    mockGet.mockResolvedValue({ data: { data: makeJobResponse(JobStatus.COMPLETED) } });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useJobPolling(), { wrapper: Wrapper });

    act(() => {
      result.current.startPolling('job-1');
    });

    await waitFor(() => {
      expect(result.current.status).toBe(JobStatus.COMPLETED);
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBeNull();
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isProcessing).toBe(false);
  });

  it('transitions from PROCESSING to COMPLETED across multiple polls', async () => {
    mockGet
      .mockResolvedValueOnce({ data: { data: makeJobResponse(JobStatus.PROCESSING) } })
      .mockResolvedValueOnce({ data: { data: makeJobResponse(JobStatus.PROCESSING) } })
      .mockResolvedValueOnce({ data: { data: makeJobResponse(JobStatus.COMPLETED) } });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => useJobPolling({ pollingInterval: 100 }),
      { wrapper: Wrapper },
    );

    act(() => {
      result.current.startPolling('job-1');
    });

    await waitFor(() => {
      expect(result.current.status).toBe(JobStatus.COMPLETED);
    }, { timeout: 5000 });

    expect(result.current.result).toBeDefined();
    expect(result.current.isProcessing).toBe(false);
  });
});
