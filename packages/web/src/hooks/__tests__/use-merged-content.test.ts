import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import type { MergedContentResponse } from '@alliance-risk/shared';
import {
  useMergedContent,
  getMergedContentRefetchInterval,
  MERGED_CONTENT_MAX_EMPTY_POLLS,
} from '../use-merged-content';

// Mock api-client
const mockGet = jest.fn();
jest.mock('@/lib/api-client', () => ({
  __esModule: true,
  default: {
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

describe('getMergedContentRefetchInterval — the poll decision per response shape (NFR-DDP-010, D5)', () => {
  it('keeps polling when no response has arrived yet', () => {
    expect(getMergedContentRefetchInterval(undefined, 0)).toBe(5000);
  });

  it('keeps polling when content is absent and the analysis is not superseded', () => {
    const data: MergedContentResponse = { mergedMarkdown: null, superseded: false };
    expect(getMergedContentRefetchInterval(data, 1)).toBe(5000);
  });

  it('stops polling once mergedMarkdown arrives', () => {
    const data: MergedContentResponse = { mergedMarkdown: '# Doc', superseded: false };
    expect(getMergedContentRefetchInterval(data, 1)).toBe(false);
  });

  it('stops polling immediately when superseded is true, even on the very first poll', () => {
    const data: MergedContentResponse = { mergedMarkdown: null, superseded: true };
    // dataUpdateCount === 1: nowhere near the attempt cap, proving this is a
    // direct stop on `superseded`, not an accidental cap hit (FR-DDP-002 Sc 3).
    expect(getMergedContentRefetchInterval(data, 1)).toBe(false);
  });

  it('stops polling immediately on superseded even if content is somehow also present', () => {
    // Defensive: the server contract guarantees mergedMarkdown is null when
    // superseded (design.md §6), but the client must not serve stale content
    // if that contract were ever violated.
    const data: MergedContentResponse = { mergedMarkdown: 'stale', superseded: true };
    expect(getMergedContentRefetchInterval(data, 1)).toBe(false);
  });

  it('continues polling one attempt below the cap', () => {
    const data: MergedContentResponse = { mergedMarkdown: null, superseded: false };
    expect(
      getMergedContentRefetchInterval(data, MERGED_CONTENT_MAX_EMPTY_POLLS - 1),
    ).toBe(5000);
  });

  it('stops polling exactly at the cap', () => {
    const data: MergedContentResponse = { mergedMarkdown: null, superseded: false };
    expect(
      getMergedContentRefetchInterval(data, MERGED_CONTENT_MAX_EMPTY_POLLS),
    ).toBe(false);
  });

  it('stops polling past the cap', () => {
    const data: MergedContentResponse = { mergedMarkdown: null, superseded: false };
    expect(
      getMergedContentRefetchInterval(data, MERGED_CONTENT_MAX_EMPTY_POLLS + 1),
    ).toBe(false);
  });
});

describe('useMergedContent — wiring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches the merged-content endpoint for the given assessment', async () => {
    mockGet.mockResolvedValue({
      data: { mergedMarkdown: null, superseded: false } as MergedContentResponse,
    });
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useMergedContent('assessment-1'), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith(
      '/api/assessments/assessment-1/merged-content',
    );
    expect(result.current.data).toEqual({ mergedMarkdown: null, superseded: false });
  });

  it('does not fetch when assessmentId is null', () => {
    const { Wrapper } = createWrapper();

    renderHook(() => useMergedContent(null), { wrapper: Wrapper });

    expect(mockGet).not.toHaveBeenCalled();
  });

  it('surfaces superseded on the returned data so callers can withhold content', async () => {
    mockGet.mockResolvedValue({
      data: { mergedMarkdown: null, superseded: true } as MergedContentResponse,
    });
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useMergedContent('assessment-2'), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.superseded).toBe(true);
    expect(result.current.data?.mergedMarkdown).toBeNull();
  });
});

describe('useMergedContent — bounds polling by completed attempts, not successes (NFR-DDP-010)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps polling below the cap while every attempt fails and none has ever succeeded', async () => {
    jest.useFakeTimers();
    mockGet.mockRejectedValue(new Error('Not Found'));
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useMergedContent('assessment-fail-1'), {
      wrapper: Wrapper,
    });

    // Initial fetch (attempt 1) settles to an error — dataUpdateCount stays
    // 0 forever in this scenario; only errorUpdateCount ever advances.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(result.current.isError).toBe(true);
    expect(result.current.data).toBeUndefined();

    // Advance through most, but not all, of the cap.
    for (let i = 0; i < MERGED_CONTENT_MAX_EMPTY_POLLS - 10; i++) {
      await act(async () => {
        await jest.advanceTimersByTimeAsync(5000);
      });
    }

    expect(result.current.data).toBeUndefined();
    // Still polling: more attempts than just the initial one, and short of
    // the cap — the composed failure count must not stop the poll early.
    expect(mockGet.mock.calls.length).toBeGreaterThan(1);
    expect(mockGet.mock.calls.length).toBeLessThan(MERGED_CONTENT_MAX_EMPTY_POLLS);
  });

  it('stops polling exactly at the cap even though no fetch ever succeeded', async () => {
    // Against a dataUpdateCount-only cap (the prior implementation),
    // dataUpdateCount never leaves 0 when every fetch errors, so this
    // scenario polls forever — this case cannot go red under that
    // implementation, which is exactly why it was missing before.
    jest.useFakeTimers();
    mockGet.mockRejectedValue(new Error('Not Found'));
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useMergedContent('assessment-fail-2'), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(result.current.isError).toBe(true);

    // Advance well past the cap.
    for (let i = 0; i < MERGED_CONTENT_MAX_EMPTY_POLLS + 10; i++) {
      await act(async () => {
        await jest.advanceTimersByTimeAsync(5000);
      });
    }

    expect(result.current.data).toBeUndefined();
    // Bounded exactly at the cap: one fetch per attempt, and no further
    // fetches fire no matter how much more time passes.
    expect(mockGet.mock.calls.length).toBe(MERGED_CONTENT_MAX_EMPTY_POLLS);
  });
});
