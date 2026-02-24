import { useQuery, useMutation } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { ReportResponse } from '@alliance-risk/shared';

export function useReport(assessmentId: string) {
  return useQuery<ReportResponse>({
    queryKey: ['report', assessmentId],
    queryFn: async () => {
      const response = await apiClient.get<ReportResponse>(
        `/api/assessments/${assessmentId}/report`,
      );
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!assessmentId,
  });
}

export function useGeneratePdf(assessmentId: string) {
  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<{ jobId: string; downloadUrl?: string }>(
        `/api/assessments/${assessmentId}/report/pdf`,
      );
      return response.data;
    },
  });
}
