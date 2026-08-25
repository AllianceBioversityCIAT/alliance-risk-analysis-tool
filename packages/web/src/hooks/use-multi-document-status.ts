'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import apiClient from '@/lib/api-client';
import type { DocumentInfo } from '@alliance-risk/shared';

/**
 * Polls GET /api/assessments/:id/documents every 3 seconds.
 * Automatically stops polling when all documents reach a terminal state
 * (PARSED or FAILED).
 *
 * Exposes derived flags for use in multi-file upload flow:
 * - allParsed: every document is PARSED
 * - anyFailed: at least one document is FAILED
 * - isProcessing: at least one document is still uploading/parsing
 */
export function useMultiDocumentStatus(
  assessmentId: string | null,
  enabled: boolean,
) {
  const query = useQuery<DocumentInfo[]>({
    queryKey: ['assessment-documents-poll', assessmentId],
    queryFn: async () => {
      const response = await apiClient.get<DocumentInfo[]>(
        `/api/assessments/${assessmentId}/documents`,
      );
      return response.data;
    },
    enabled: enabled && !!assessmentId,
    // Explicit staleTime (T-009, design.md §8.3 v2.1). This query previously
    // had no override, so it inherited the provider's 5-minute default
    // (query-provider.tsx:12) while its own poll below self-disables once
    // every cached document reaches a terminal state — so after a delete,
    // nothing corrected it: not a fresh mount, not window focus, not the
    // poll itself, for up to five minutes (T-008 finding 1, "worse than
    // first diagnosed"). `staleTime: 0` matches this codebase's precedent
    // for an actively-polled status query (`use-job-polling.ts:66`): the
    // query is always considered stale, so the explicit
    // `invalidateQueries` call `useDeleteDocument` now issues below reliably
    // triggers a refetch rather than being swallowed by a multi-minute
    // staleness window.
    staleTime: 0,
    refetchInterval: (q) => {
      const docs = q.state.data as DocumentInfo[] | undefined;
      if (!docs || docs.length === 0) return 3000;
      const allTerminal = docs.every(
        (d) => d.status === 'PARSED' || d.status === 'FAILED',
      );
      return allTerminal ? false : 3000;
    },
  });

  const documents = query.data ?? [];

  const allParsed =
    documents.length > 0 && documents.every((d) => d.status === 'PARSED');

  const anyFailed = documents.some((d) => d.status === 'FAILED');

  const isProcessing = documents.some(
    (d) => d.status === 'PARSING' || d.status === 'UPLOADED',
  );

  return {
    documents,
    allParsed,
    anyFailed,
    isProcessing,
    isLoading: query.isLoading,
    /**
     * True only once this query has produced a confirmed answer — i.e.
     * `documents` reflects a real response, not an empty array standing in
     * for "disabled", "still fetching", or "errored". `query.isLoading`
     * cannot serve this purpose: it is `isPending && isFetching`, and a
     * *disabled* query (before `enabled` flips true) reports `isFetching:
     * false`, so `isLoading` reads `false` before any fetch has ever run —
     * exactly the window in which `documents` is `[]` for a reason
     * unrelated to "zero documents remain". `isSuccess` (`status ===
     * 'success'`) is the one signal that is false across disabled, pending,
     * and errored alike, and true only once data is confirmed — verified
     * against the installed @tanstack/query-core (design.md §14;
     * requirements.md FR-DDP-003 preamble). A failed fetch must read the
     * same as "not yet known", never as a confirmed empty list, so a
     * network error never permanently asserts zero documents.
     */
    isSettled: query.isSuccess,
    refetch: query.refetch,
  };
}

/**
 * Mutation to trigger batch parsing of all uploaded documents.
 * Calls POST /api/assessments/:id/documents/parse-all (HTTP 202).
 */
export function useTriggerParseAll() {
  return useMutation({
    mutationFn: async (assessmentId: string) => {
      const response = await apiClient.post<{ jobIds: string[] }>(
        `/api/assessments/${assessmentId}/documents/parse-all`,
      );
      return response.data;
    },
  });
}

/**
 * Mutation to delete a single document from an assessment before parsing.
 * Calls DELETE /api/assessments/:assessmentId/documents/:documentId (HTTP 204).
 *
 * On success, invalidates the merged-content and gap-fields caches for that
 * assessment (design.md §8.3) — otherwise a correct backend still serves up
 * to `staleTime` of now-deleted content from the client cache (FR-DDP-002 Sc 3),
 * and this is the only refresh path reachable from the deletion screen itself
 * (`/assessments/upload`), which is a different screen from the one rendering
 * that cached content (`/assessments/gap-detector`).
 *
 * A 404 gets the exact same treatment (T-007 Reviewer advisory, Gap 1). The
 * server already agrees the document is gone in that case — the end state is
 * identical to a successful delete, so FR-DDP-002 Sc 3's "must NOT be
 * re-served from any client-side cache" applies just as much. This is
 * handled here, in the hook, rather than at each call site: "404 means it's
 * already gone" is a fact about this mutation's own semantics, not something
 * every future consumer of `useDeleteDocument` should have to rediscover and
 * re-implement. Any other failure leaves server-side state unclear and must
 * NOT invalidate — the row should stay listed so the failure is visible.
 */
export function useDeleteDocument() {
  const queryClient = useQueryClient();

  const invalidateDependentCaches = (assessmentId: string) => {
    queryClient.invalidateQueries({
      queryKey: ['merged-content', assessmentId],
    });
    queryClient.invalidateQueries({
      queryKey: ['gap-fields', assessmentId],
    });
    // T-008 finding 1 / T-009: the documents list itself was never
    // invalidated, so `documents.length` stayed at its pre-delete count from
    // stale cache — the deleted document reappeared in Manage Documents, and
    // it also kept `DocumentViewer`'s zero-documents branch from ever firing
    // after the only document on an assessment was deleted (design.md §8.3
    // v2.1). This is the query the upload modal and DocumentViewer both read
    // (`use-multi-document-status.ts` above), on a different screen from
    // where the deletion happens.
    queryClient.invalidateQueries({
      queryKey: ['assessment-documents-poll', assessmentId],
    });
  };

  return useMutation({
    mutationFn: async ({
      assessmentId,
      documentId,
    }: {
      assessmentId: string;
      documentId: string;
    }) => {
      await apiClient.delete(
        `/api/assessments/${assessmentId}/documents/${documentId}`,
      );
    },
    onSuccess: (_data, variables) => {
      invalidateDependentCaches(variables.assessmentId);
    },
    onError: (error, variables) => {
      if (error instanceof AxiosError && error.response?.status === 404) {
        invalidateDependentCaches(variables.assessmentId);
      }
    },
  });
}
