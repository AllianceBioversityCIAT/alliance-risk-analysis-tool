'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  PromptSummary,
  PromptDetail,
  AgentSection,
} from '@alliance-risk/shared';
import apiClient from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PromptFilters {
  section?: AgentSection;
  route?: string;
  tag?: string;
  search?: string;
  isActive?: boolean;
}

export interface PaginatedPromptsResponse {
  prompts: PromptSummary[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CreatePromptPayload {
  name: string;
  section: AgentSection;
  subSection?: string;
  route?: string;
  categories?: string[];
  tags?: string[];
  systemPrompt: string;
  userPromptTemplate: string;
  tone?: string;
  outputFormat?: string;
  fewShot?: Array<{ input: string; output: string }>;
  context?: {
    persona?: string;
    sources?: string[];
    constraints?: string;
    guardrails?: string;
  };
  isActive?: boolean;
}

export type UpdatePromptPayload = Partial<CreatePromptPayload>;

export interface ThreadedComment {
  id: string;
  promptId: string;
  parentId: string | null;
  content: string;
  authorId: string;
  author: { id: string; email: string };
  createdAt: string;
  updatedAt: string;
  replies: ThreadedComment[];
}

export interface PromptChange {
  id: string;
  promptId: string;
  version: number;
  changeType: string;
  changes: Record<string, unknown>;
  comment: string | null;
  author: { id: string; email: string };
  createdAt: string;
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

const PROMPTS_KEY = (filters: PromptFilters, page: number) =>
  ['prompts', filters, page] as const;

const PROMPT_KEY = (id: string, version?: number) =>
  ['prompt', id, version] as const;

const PROMPT_COMMENTS_KEY = (promptId: string) =>
  ['prompt-comments', promptId] as const;

const PROMPT_HISTORY_KEY = (promptId: string) =>
  ['prompt-history', promptId] as const;

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function usePrompts(filters: PromptFilters = {}, page = 1, limit = 20) {
  return useQuery<PaginatedPromptsResponse>({
    queryKey: PROMPTS_KEY(filters, page),
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (filters.section) params.set('section', filters.section);
      if (filters.route) params.set('route', filters.route);
      if (filters.tag) params.set('tag', filters.tag);
      if (filters.search) params.set('search', filters.search);
      if (filters.isActive !== undefined) params.set('isActive', String(filters.isActive));

      const res = await apiClient.get<{ data: PaginatedPromptsResponse }>(
        `/api/admin/prompts/list?${params}`,
      );
      return res.data.data;
    },
    staleTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  });
}

export function usePrompt(id: string, version?: number) {
  return useQuery<PromptDetail>({
    queryKey: PROMPT_KEY(id, version),
    queryFn: async () => {
      const params = version ? `?version=${version}` : '';
      const res = await apiClient.get<{ data: PromptDetail }>(
        `/api/admin/prompts/${id}${params}`,
      );
      return res.data.data;
    },
    enabled: !!id,
    staleTime: 2 * 60_000,
  });
}

export function useCreatePrompt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreatePromptPayload) => {
      const res = await apiClient.post<{ data: PromptDetail }>(
        '/api/admin/prompts/create',
        payload,
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
    },
  });
}

export function useUpdatePrompt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdatePromptPayload }) => {
      const res = await apiClient.put<{ data: PromptDetail }>(
        `/api/admin/prompts/${id}/update`,
        payload,
      );
      return res.data.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
      queryClient.invalidateQueries({ queryKey: ['prompt', id] });
    },
  });
}

export function useDeletePrompt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/admin/prompts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
    },
  });
}

export function useToggleActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post<{ data: PromptDetail }>(
        `/api/admin/prompts/${id}/toggle-active`,
        {},
      );
      return res.data.data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
      queryClient.invalidateQueries({ queryKey: ['prompt', id] });
    },
  });
}

export function usePromptComments(promptId: string) {
  return useQuery<ThreadedComment[]>({
    queryKey: PROMPT_COMMENTS_KEY(promptId),
    queryFn: async () => {
      const res = await apiClient.get<{ data: ThreadedComment[] }>(
        `/api/admin/prompts/${promptId}/comments`,
      );
      return res.data.data;
    },
    enabled: !!promptId,
    staleTime: 2 * 60_000,
  });
}

export function useAddComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      promptId,
      content,
      parentId,
    }: {
      promptId: string;
      content: string;
      parentId?: string;
    }) => {
      const res = await apiClient.post<{ data: ThreadedComment }>(
        `/api/admin/prompts/${promptId}/comments`,
        { content, parentId },
      );
      return res.data.data;
    },
    onSuccess: (_, { promptId }) => {
      queryClient.invalidateQueries({ queryKey: PROMPT_COMMENTS_KEY(promptId) });
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
    },
  });
}

export function usePromptHistory(promptId: string) {
  return useQuery<PromptChange[]>({
    queryKey: PROMPT_HISTORY_KEY(promptId),
    queryFn: async () => {
      const res = await apiClient.get<{ data: PromptChange[] }>(
        `/api/admin/prompts/${promptId}/history`,
      );
      return res.data.data;
    },
    enabled: !!promptId,
    staleTime: 60_000,
  });
}
