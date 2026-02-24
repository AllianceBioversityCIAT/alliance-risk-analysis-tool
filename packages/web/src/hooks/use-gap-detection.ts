import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { GapFieldStatus } from '@alliance-risk/shared';
import type { GapFieldResponse } from '@alliance-risk/shared';

interface GapFieldsResponse {
  data: GapFieldResponse[];
  total: number;
  missingCount: number;
  verifiedCount: number;
  allMandatoryComplete: boolean;
}

interface UpdateGapFieldPayload {
  id: string;
  correctedValue: string;
}

export function useGapFields(assessmentId: string) {
  return useQuery<GapFieldsResponse>({
    queryKey: ['gap-fields', assessmentId],
    queryFn: async () => {
      const response = await apiClient.get<GapFieldsResponse>(
        `/api/assessments/${assessmentId}/gap-fields`,
      );
      return response.data;
    },
    staleTime: 60 * 1000, // 1 minute
    enabled: !!assessmentId,
  });
}

export function useUpdateGapFields(assessmentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: UpdateGapFieldPayload[]) => {
      const response = await apiClient.put<GapFieldsResponse>(
        `/api/assessments/${assessmentId}/gap-fields`,
        { updates },
      );
      return response.data;
    },
    // Optimistic update
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: ['gap-fields', assessmentId] });
      const previous = queryClient.getQueryData<GapFieldsResponse>(['gap-fields', assessmentId]);

      if (previous) {
        queryClient.setQueryData<GapFieldsResponse>(['gap-fields', assessmentId], (old) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data.map((field) => {
              const update = updates.find((u) => u.id === field.id);
              if (update) {
                  return {
                  ...field,
                  correctedValue: update.correctedValue,
                  status: GapFieldStatus.VERIFIED,
                };
              }
              return field;
            }),
          };
        });
      }

      return { previous };
    },
    onError: (_err, _updates, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['gap-fields', assessmentId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['gap-fields', assessmentId] });
    },
  });
}
