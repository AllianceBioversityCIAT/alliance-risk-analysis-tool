'use client';

import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

interface MergedContentResponse {
  mergedMarkdown: string | null;
}

/**
 * Fetches the merged Markdown content from the latest completed GAP_DETECTION job
 * for the given assessment. Used by DocumentViewer in the Gap Detector.
 *
 * Returns null until the gap detection job completes.
 * Polls every 5s while content is not yet available.
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
    refetchInterval: (q) => {
      const data = q.state.data as MergedContentResponse | undefined;
      // Keep polling until merged content is available
      if (!data?.mergedMarkdown) return 5000;
      return false; // Stop polling once content arrives
    },
  });
}
