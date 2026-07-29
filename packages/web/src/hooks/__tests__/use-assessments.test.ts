import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import apiClient from '@/lib/api-client';
import { useAssessmentStats, useAssessments } from '../use-assessments';

jest.mock('@/lib/api-client', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockedGet = apiClient.get as jest.Mock;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useAssessments country filter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGet.mockResolvedValue({ data: { data: [], nextCursor: null, total: 0 } });
  });

  it('includes country in list API params', async () => {
    const { result } = renderHook(
      () => useAssessments({ country: 'Nigeria', limit: 10 }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedGet).toHaveBeenCalledWith('/api/assessments', {
      params: { country: 'Nigeria', limit: 10 },
    });
  });
});

describe('useAssessmentStats country filter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGet.mockResolvedValue({
      data: { active: 0, drafts: 0, completed: 0, total: 0 },
    });
  });

  it('uses country in queryKey and API params', async () => {
    const { result } = renderHook(() => useAssessmentStats('Ethiopia'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedGet).toHaveBeenCalledWith('/api/assessments/stats', {
      params: { country: 'Ethiopia' },
    });
  });
});
