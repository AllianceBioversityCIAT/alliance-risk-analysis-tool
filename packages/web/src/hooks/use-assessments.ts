import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type {
  AssessmentSummary,
  AssessmentDetail,
  AssessmentStats,
  PaginatedResponse,
} from '@alliance-risk/shared';
import { AssessmentStatus, IntakeMode } from '@alliance-risk/shared';

export { AssessmentStatus, IntakeMode };

export interface AssessmentFilters {
  status?: AssessmentStatus;
  search?: string;
  cursor?: string;
  limit?: number;
}

export interface CreateAssessmentData {
  name: string;
  companyName: string;
  companyType?: string;
  country?: string;
  intakeMode: IntakeMode;
}

export interface UpdateAssessmentData {
  name?: string;
  companyName?: string;
  companyType?: string;
  status?: AssessmentStatus;
  progress?: number;
}

export interface AssessmentListResponse {
  data: AssessmentSummary[];
  nextCursor: string | null;
  total: number;
}

export function useAssessments(filters: AssessmentFilters = {}) {
  return useQuery<AssessmentListResponse>({
    queryKey: ['assessments', filters],
    queryFn: async () => {
      const response = await apiClient.get<AssessmentListResponse>('/api/assessments', {
        params: filters,
      });
      return response.data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    placeholderData: keepPreviousData,
  });
}

export function useAssessment(id: string | null) {
  return useQuery<AssessmentDetail>({
    queryKey: ['assessment', id],
    queryFn: async () => {
      const response = await apiClient.get<AssessmentDetail>(`/api/assessments/${id}`);
      return response.data;
    },
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  });
}

export function useAssessmentStats() {
  return useQuery<AssessmentStats>({
    queryKey: ['assessment-stats'],
    queryFn: async () => {
      const response = await apiClient.get<AssessmentStats>('/api/assessments/stats');
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useCreateAssessment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateAssessmentData) => {
      const response = await apiClient.post<AssessmentDetail>('/api/assessments', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      queryClient.invalidateQueries({ queryKey: ['assessment-stats'] });
    },
  });
}

export function useUpdateAssessment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateAssessmentData }) => {
      const response = await apiClient.put<AssessmentDetail>(`/api/assessments/${id}`, data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      queryClient.invalidateQueries({ queryKey: ['assessment', variables.id] });
    },
  });
}

export function useDeleteAssessment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/assessments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      queryClient.invalidateQueries({ queryKey: ['assessment-stats'] });
    },
  });
}

export function useRequestUploadUrl() {
  return useMutation({
    mutationFn: async ({
      assessmentId,
      fileName,
      mimeType,
      fileSize,
    }: {
      assessmentId: string;
      fileName: string;
      mimeType: string;
      fileSize: number;
    }) => {
      const response = await apiClient.post<{ presignedUrl: string; documentId: string }>(
        `/api/assessments/${assessmentId}/documents`,
        { fileName, mimeType, fileSize },
      );
      return response.data;
    },
  });
}

export function useTriggerParseDocument() {
  return useMutation({
    mutationFn: async ({
      assessmentId,
      documentId,
    }: {
      assessmentId: string;
      documentId: string;
    }) => {
      const response = await apiClient.post<string>(
        `/api/assessments/${assessmentId}/documents/${documentId}/parse`,
      );
      return response.data;
    },
  });
}
