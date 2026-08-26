'use client';

import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { MergedContentResponse } from '@alliance-risk/shared';

/**
 * Poll interval while content is still absent (design.md §8.2).
 */
const POLL_INTERVAL_MS = 5000;

/**
 * Cap on empty polls (design.md §8.2, NFR-DDP-010).
 *
 * Basis: the Gap Detector's own pipeline copy tells the Analyst the run
 * "typically takes 30-60 seconds" (the `subtitle` prop passed to
 * `PipelineStepper` at `gap-detector-client.tsx:926`). At the 5s interval
 * below, 60 attempts is 300s (5 minutes) of polling — a 5-10x margin over
 * that stated typical duration, and it matches the existing precedent in
 * this codebase for how long the client tolerates an in-flight async
 * Bedrock job before giving up client-side (`use-job-polling.ts`'s
 * `maxAttempts = 100` at a 3s interval is also ~5 minutes). The cap is a
 * bound on wasted polling, not the primary refresh mechanism — §8.3's cache
 * invalidation on completion is that backstop, so a genuinely slower run
 * still refreshes the panel once it finishes even after the poll itself has
 * stopped.
 */
export const MERGED_CONTENT_MAX_EMPTY_POLLS = 60;

/**
 * Pure poll-interval decision, exported for direct unit testing of every
 * response shape without needing to fast-forward through the full cap in
 * simulated time.
 *
 * - The attempt cap is checked first and applies **regardless** of
 *   `analysisInFlight` — DD-DDP-006 (v2.1): in-flight decides whether to
 *   *keep spending* the budget, never how large it is, so a job stuck
 *   `PENDING`/`PROCESSING` forever (nothing in this platform retries a job
 *   reset to `PENDING`) still cannot produce an unbounded poll.
 * - `analysisInFlight` keeps polling below the cap — the **only** way the
 *   client can observe a server-chained analysis completing, since that
 *   job's id is created in `jobs.service.ts` and never returned in any HTTP
 *   response (design.md §8.2 v2.1, NFR-DDP-010). This overrides both
 *   `superseded` and "content present" below it: FRESH content stays served
 *   while a newer run is in flight, and a withheld analysis whose remedy is
 *   already running must not stop waiting for that remedy to land.
 * - `superseded` **and nothing in flight** stops the poll immediately —
 *   nothing more can arrive that the client should keep waiting for
 *   (design.md §7.3, FR-DDP-002 Sc 3).
 * - Content present **and nothing in flight** stops the poll — nothing left
 *   to wait for.
 * - Otherwise poll while `completedFetchCount` stays below the cap; stop
 *   once it is reached.
 *
 * `completedFetchCount` must count every completed attempt — success *and*
 * failure — not just successes. TanStack Query v5's `dataUpdateCount` only
 * increments on a successful fetch (`query.js`, `case "success"`); a
 * separate `errorUpdateCount` increments on failure. A request that fails on
 * every attempt (e.g. the assessment's ownership check throwing `NotFound`
 * because it was deleted/unshared in another tab, or a transient 5xx) would
 * never advance `dataUpdateCount` alone, and `refetchInterval` re-arms on
 * every query update regardless of error state — so the poll would run
 * forever. Callers must pass `dataUpdateCount + errorUpdateCount` (see
 * `useMergedContent` below).
 */
export function getMergedContentRefetchInterval(
  data: MergedContentResponse | undefined,
  completedFetchCount: number,
): number | false {
  if (completedFetchCount >= MERGED_CONTENT_MAX_EMPTY_POLLS) return false;
  if (data?.analysisInFlight) return POLL_INTERVAL_MS;
  if (data?.superseded) return false;
  if (data?.mergedMarkdown) return false;
  return POLL_INTERVAL_MS;
}

/**
 * Fetches the merged Markdown content from the latest completed GAP_DETECTION job
 * for the given assessment. Used by DocumentViewer in the Gap Detector.
 *
 * Returns null until the gap detection job completes, or when the stored
 * analysis has been superseded by a document deletion/re-parse (FR-DDP-002).
 * Polls every 5s while content is not yet available and not superseded,
 * bounded by `MERGED_CONTENT_MAX_EMPTY_POLLS` (NFR-DDP-010).
 */
export function useMergedContent(assessmentId: string | null) {
  return useQuery<MergedContentResponse>({
    queryKey: ['merged-content', assessmentId],
    queryFn: async () => {
      const response = await apiClient.get<MergedContentResponse>(
        `/api/assessments/${assessmentId}/merged-content`,
      );
      return response.data;
    },
    enabled: !!assessmentId,
    staleTime: 60 * 1000, // 1 minute — content rarely changes after gap detection
    refetchInterval: (query) =>
      getMergedContentRefetchInterval(
        query.state.data as MergedContentResponse | undefined,
        query.state.dataUpdateCount + query.state.errorUpdateCount,
      ),
  });
}
