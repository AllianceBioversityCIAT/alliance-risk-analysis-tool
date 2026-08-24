import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useDeleteDocument, useMultiDocumentStatus } from '../use-multi-document-status';

// Mock api-client
const mockDelete = jest.fn();
const mockGet = jest.fn();
jest.mock('@/lib/api-client', () => ({
  __esModule: true,
  default: {
    delete: (...args: unknown[]) => mockDelete(...args),
    get: (...args: unknown[]) => mockGet(...args),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  return { Wrapper, queryClient };
}

describe('useDeleteDocument — cache invalidation on success (design.md §8.3, D4)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('invalidates both merged-content and gap-fields for the assessment on a successful delete', async () => {
    mockDelete.mockResolvedValue({ data: undefined });
    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteDocument(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        assessmentId: 'assessment-1',
        documentId: 'doc-1',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockDelete).toHaveBeenCalledWith(
      '/api/assessments/assessment-1/documents/doc-1',
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['merged-content', 'assessment-1'],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['gap-fields', 'assessment-1'],
    });
  });

  it('scopes invalidation to the specific assessmentId of the deleted document, not a different one', async () => {
    mockDelete.mockResolvedValue({ data: undefined });
    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteDocument(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        assessmentId: 'assessment-42',
        documentId: 'doc-7',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).not.toHaveBeenCalledWith({
      queryKey: ['merged-content', 'assessment-1'],
    });
    const calledKeys = invalidateSpy.mock.calls.map((call) => call[0]?.queryKey);
    expect(calledKeys).toContainEqual(['merged-content', 'assessment-42']);
    expect(calledKeys).toContainEqual(['gap-fields', 'assessment-42']);
  });

  it('does not invalidate any query when the delete fails', async () => {
    mockDelete.mockRejectedValue(new Error('network error'));
    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteDocument(), { wrapper: Wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          assessmentId: 'assessment-1',
          documentId: 'doc-1',
        }),
      ).rejects.toThrow('network error');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});

describe('useMultiDocumentStatus — isSettled (T-007 rework: the caller-level remedy gate)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('is false while the query is disabled — an empty documents array here is "unknown," not "zero"', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => useMultiDocumentStatus('assessment-1', false),
      { wrapper: Wrapper },
    );

    expect(result.current.documents).toEqual([]);
    expect(result.current.isSettled).toBe(false);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('is false while the first fetch is in flight, then true once data is confirmed', async () => {
    let resolveFetch: (value: { data: unknown[] }) => void;
    mockGet.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );
    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => useMultiDocumentStatus('assessment-1', true),
      { wrapper: Wrapper },
    );

    expect(result.current.isSettled).toBe(false);

    await act(async () => {
      resolveFetch({ data: [] });
    });

    await waitFor(() => expect(result.current.isSettled).toBe(true));
  });

  it('stays false — never a confirmed empty list — when the fetch fails', async () => {
    mockGet.mockRejectedValue(new Error('network error'));
    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () => useMultiDocumentStatus('assessment-1', true),
      { wrapper: Wrapper },
    );

    // `isLoading` (isPending && isFetching) only clears once the query has
    // actually settled — into 'error', here, since retries are disabled —
    // so waiting for it confirms the rejection was processed rather than
    // asserting on the pre-fetch default.
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.documents).toEqual([]);
    // A failed fetch must read the same as "not yet known" — never as a
    // settled, confirmed-empty answer — so a caller gating a remedy on
    // `isSettled` (or its negation) does not lock the remedy away forever
    // on an outage (requirements.md FR-DDP-003 preamble).
    expect(result.current.isSettled).toBe(false);
  });
});
