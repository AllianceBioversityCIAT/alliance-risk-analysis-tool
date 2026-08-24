'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
 */
export function useDeleteDocument() {
  const queryClient = useQueryClient();
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
      queryClient.invalidateQueries({
        queryKey: ['merged-content', variables.assessmentId],
      });
      queryClient.invalidateQueries({
        queryKey: ['gap-fields', variables.assessmentId],
      });
    },
  });
}
