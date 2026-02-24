import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { RiskScoreResponse, AssessmentCommentResponse } from '@alliance-risk/shared';

interface RiskScoresResponse {
  data: RiskScoreResponse[];
  overallScore: number;
  overallLevel: string;
}

export function useRiskScores(assessmentId: string) {
  return useQuery<RiskScoresResponse>({
    queryKey: ['risk-scores', assessmentId],
    queryFn: async () => {
      const response = await apiClient.get<RiskScoresResponse>(
        `/api/assessments/${assessmentId}/risk-scores`,
      );
      return response.data;
    },
    staleTime: 2 * 60 * 1000,
    enabled: !!assessmentId,
  });
}

export function useEditRecommendation(assessmentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ recId, text }: { recId: string; text: string }) => {
      await apiClient.put(
        `/api/assessments/${assessmentId}/recommendations/${recId}`,
        { text },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risk-scores', assessmentId] });
    },
  });
}

export function useAssessmentComments(assessmentId: string) {
  return useQuery<AssessmentCommentResponse[]>({
    queryKey: ['assessment-comments', assessmentId],
    queryFn: async () => {
      const response = await apiClient.get<AssessmentCommentResponse[]>(
        `/api/assessments/${assessmentId}/comments`,
      );
      return response.data;
    },
    staleTime: 60 * 1000,
    enabled: !!assessmentId,
  });
}

export function useAddComment(assessmentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (content: string) => {
      const response = await apiClient.post<AssessmentCommentResponse>(
        `/api/assessments/${assessmentId}/comments`,
        { content },
      );
      return response.data;
    },
    // Optimistic update
    onMutate: async (content) => {
      await queryClient.cancelQueries({ queryKey: ['assessment-comments', assessmentId] });
      const previous = queryClient.getQueryData<AssessmentCommentResponse[]>([
        'assessment-comments',
        assessmentId,
      ]);

      const optimistic: AssessmentCommentResponse = {
        id: `optimistic-${Date.now()}`,
        userId: 'current-user',
        userEmail: 'you@example.com',
        content,
        createdAt: new Date().toISOString(),
      };

      queryClient.setQueryData<AssessmentCommentResponse[]>(
        ['assessment-comments', assessmentId],
        (old) => [...(old ?? []), optimistic],
      );

      return { previous };
    },
    onError: (_err, _content, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['assessment-comments', assessmentId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['assessment-comments', assessmentId] });
    },
  });
}
