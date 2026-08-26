import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, type AxiosResponse } from 'axios';
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

  // ─── T-009 / T-008 finding 1 — the documents list itself must be
  // invalidated too, not merely "some key". Asserting only that
  // `invalidateQueries` was called (or called some number of times) would
  // pass against the pre-T-009 hook, which invalidates two *other* keys and
  // none of this one — that is the exact defect this test exists to catch:
  // the deleted document reappearing in Manage Documents because
  // `['assessment-documents-poll', assessmentId]` was never told to
  // refetch. ───────────────────────────────────────────────────────────────
  it('invalidates the documents-list query (["assessment-documents-poll", assessmentId]) specifically, on a successful delete (T-009)', async () => {
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

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['assessment-documents-poll', 'assessment-1'],
    });
  });

  it('invalidates the documents-list query on a 404 (already gone server-side) too, not only on a clean success', async () => {
    const notFound = new AxiosError('Not Found');
    notFound.response = {
      status: 404,
      statusText: 'Not Found',
      data: {},
      headers: {},
      config: {} as AxiosResponse['config'],
    };
    mockDelete.mockRejectedValue(notFound);
    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteDocument(), { wrapper: Wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          assessmentId: 'assessment-1',
          documentId: 'doc-1',
        }),
      ).rejects.toThrow();
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['assessment-documents-poll', 'assessment-1'],
    });
  });

  it('does NOT invalidate the documents-list query on a non-404 failure — the row must stay listed', async () => {
    const serverError = new AxiosError('Internal Server Error');
    serverError.response = {
      status: 500,
      statusText: 'Internal Server Error',
      data: {},
      headers: {},
      config: {} as AxiosResponse['config'],
    };
    mockDelete.mockRejectedValue(serverError);
    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteDocument(), { wrapper: Wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          assessmentId: 'assessment-1',
          documentId: 'doc-1',
        }),
      ).rejects.toThrow();
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(invalidateSpy).not.toHaveBeenCalledWith({
      queryKey: ['assessment-documents-poll', 'assessment-1'],
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

  // T-007 Reviewer advisory, Gap 1: `handleRemoveFile` in
  // upload-business-plan-modal.tsx swallows a 404 (the server already agrees
  // the document is gone) and removes the row without going through
  // `onSuccess`. Without this, the wrong implementation — invalidation
  // wired only into `onSuccess`, as it was before this fix — leaves
  // `['merged-content']` and `['gap-fields']` serving up to `staleTime` of
  // now-deleted content on the Gap Detector (FR-DDP-002 Sc 3: "must NOT be
  // re-served from any client-side cache"). This test catches exactly that
  // implementation: it fails against the pre-fix hook, which only ever
  // invalidated inside `onSuccess`.
  it('invalidates both merged-content and gap-fields when the delete rejects with a 404 (already gone server-side)', async () => {
    const notFound = new AxiosError('Not Found');
    notFound.response = {
      status: 404,
      statusText: 'Not Found',
      data: {},
      headers: {},
      config: {} as AxiosResponse['config'],
    };
    mockDelete.mockRejectedValue(notFound);
    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteDocument(), { wrapper: Wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          assessmentId: 'assessment-1',
          documentId: 'doc-1',
        }),
      ).rejects.toThrow();
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['merged-content', 'assessment-1'],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['gap-fields', 'assessment-1'],
    });
  });

  it('does NOT invalidate when the delete rejects with a non-404 error (e.g. 500) — the row must stay listed, not silently cleared', async () => {
    const serverError = new AxiosError('Internal Server Error');
    serverError.response = {
      status: 500,
      statusText: 'Internal Server Error',
      data: {},
      headers: {},
      config: {} as AxiosResponse['config'],
    };
    mockDelete.mockRejectedValue(serverError);
    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteDocument(), { wrapper: Wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          assessmentId: 'assessment-1',
          documentId: 'doc-1',
        }),
      ).rejects.toThrow();
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

// ─── T-009 / T-008 finding 1 — this query previously had no `staleTime`
// override at all, so it silently inherited the provider's 5-minute default
// (query-provider.tsx:12). Combined with the poll self-disabling once every
// cached document is terminal (above), nothing corrected a stale read for up
// to five minutes after a delete — not a fresh mount, not window focus, not
// the poll itself. A test that only checks the invalidation call (above)
// cannot catch a regression here: TanStack Query treats an invalidated-but-
// still-fresh query differently only insofar as `staleTime` governs what
// "fresh" means, so this needs its own assertion on the query's own options. ─
describe('useMultiDocumentStatus — explicit staleTime (T-009, design.md §8.3 v2.1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sets an explicit staleTime on the assessment-documents-poll query, rather than inheriting the provider default', async () => {
    mockGet.mockResolvedValue({ data: [] });
    const { Wrapper, queryClient } = createWrapper();

    const { result } = renderHook(
      () => useMultiDocumentStatus('assessment-1', true),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(result.current.isSettled).toBe(true));

    const query = queryClient
      .getQueryCache()
      .find({ queryKey: ['assessment-documents-poll', 'assessment-1'] });

    // `Query.options` is statically typed as `QueryOptions`, which omits
    // `staleTime` (that field lives on `QueryObserverOptions`, one level up
    // — see `@tanstack/query-core`'s `hydration-*.d.ts`). The runtime object
    // is a superset built from the merged observer options, so the value is
    // genuinely present; the cast below is type-only and reads the exact
    // same property this assertion always read.
    const staleTime = (query?.options as { staleTime?: number } | undefined)
      ?.staleTime;

    // Fails against the pre-T-009 hook, which sets no `staleTime` at all on
    // this query — its options carry no `staleTime` key, so this reads
    // `undefined`, not `0`. `undefined` here is the "inherits the provider's
    // 5 minutes" bug this test exists to catch.
    expect(staleTime).toBe(0);
  });
});
