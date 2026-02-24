'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CognitoUser } from '@alliance-risk/shared';
import apiClient from '@/lib/api-client';

export interface CreateUserPayload {
  email: string;
  temporaryPassword: string;
  sendWelcomeEmail?: boolean;
}

export interface UpdateUserPayload {
  email?: string;
  name?: string;
}

export interface PaginatedUsersResponse {
  users: CognitoUser[];
  nextToken?: string;
  total?: number;
}

export interface GroupsResponse {
  groups: string[];
}

const USERS_QUERY_KEY = ['admin', 'users'] as const;
const GROUPS_QUERY_KEY = ['admin', 'groups'] as const;

export function useUsers(limit = 25, nextToken?: string) {
  return useQuery<PaginatedUsersResponse>({
    queryKey: [...USERS_QUERY_KEY, limit, nextToken],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(limit) });
      if (nextToken) params.set('nextToken', nextToken);
      const res = await apiClient.get<{ data: PaginatedUsersResponse }>(
        `/api/admin/users?${params}`,
      );
      return res.data.data;
    },
    staleTime: 60_000,
  });
}

export function useGroups() {
  return useQuery<GroupsResponse>({
    queryKey: GROUPS_QUERY_KEY,
    queryFn: async () => {
      const res = await apiClient.get<{ data: GroupsResponse }>('/api/admin/groups');
      return res.data.data;
    },
    staleTime: 5 * 60_000,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateUserPayload) => {
      const res = await apiClient.post<{ data: CognitoUser }>('/api/admin/users', payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      username,
      payload,
    }: {
      username: string;
      payload: UpdateUserPayload;
    }) => {
      const res = await apiClient.put<{ data: CognitoUser }>(
        `/api/admin/users/${encodeURIComponent(username)}`,
        payload,
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (username: string) => {
      await apiClient.delete(`/api/admin/users/${encodeURIComponent(username)}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    },
  });
}

export function useEnableUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (username: string) => {
      await apiClient.post(
        `/api/admin/users/${encodeURIComponent(username)}/enable`,
        {},
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    },
  });
}

export function useDisableUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (username: string) => {
      await apiClient.post(
        `/api/admin/users/${encodeURIComponent(username)}/disable`,
        {},
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    },
  });
}

export function useResetUserPassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (username: string) => {
      await apiClient.post(
        `/api/admin/users/${encodeURIComponent(username)}/reset-password`,
        {},
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    },
  });
}

export function useAddUserToGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      username,
      groupName,
    }: {
      username: string;
      groupName: string;
    }) => {
      await apiClient.post(
        `/api/admin/users/${encodeURIComponent(username)}/groups/${encodeURIComponent(groupName)}`,
        {},
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    },
  });
}

export function useRemoveUserFromGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      username,
      groupName,
    }: {
      username: string;
      groupName: string;
    }) => {
      await apiClient.delete(
        `/api/admin/users/${encodeURIComponent(username)}/groups/${encodeURIComponent(groupName)}`,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    },
  });
}
