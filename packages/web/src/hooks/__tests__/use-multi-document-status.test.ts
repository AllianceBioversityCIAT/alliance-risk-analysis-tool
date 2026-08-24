import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useDeleteDocument } from '../use-multi-document-status';

// Mock api-client
const mockDelete = jest.fn();
jest.mock('@/lib/api-client', () => ({
  __esModule: true,
  default: {
    delete: (...args: unknown[]) => mockDelete(...args),
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
