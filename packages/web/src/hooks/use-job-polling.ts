'use client';

import { useState, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { JobStatus } from '@alliance-risk/shared';
import apiClient from '@/lib/api-client';
import type { JobResponse } from '@alliance-risk/shared';

export interface UseJobPollingOptions {
  /** Polling interval in ms (default: 3000) */
  pollingInterval?: number;
  /** Max attempts before timeout (default: 100, ~5 min at 3s intervals) */
  maxAttempts?: number;
}

export interface JobProgress {
  stage: string;
  stageLabel: string;
  stageIndex: number;
  stageTotal: number;
}

export interface UseJobPollingResult<T> {
  status: JobStatus | null;
  result: T | null;
  progress: JobProgress | null;
  error: string | null;
  isProcessing: boolean;
  attemptCount: number;
  startPolling: (jobId: string) => void;
  reset: () => void;
}

const TERMINAL_STATUSES: JobStatus[] = [JobStatus.COMPLETED, JobStatus.FAILED];

export function useJobPolling<T = unknown>(
  options: UseJobPollingOptions = {},
): UseJobPollingResult<T> {
  const { pollingInterval = 3000, maxAttempts = 100 } = options;

  const [jobId, setJobId] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const attemptCountRef = useRef(0);

  const { data: job, error: queryError } = useQuery<JobResponse>({
    queryKey: ['job', jobId],
    queryFn: async () => {
      attemptCountRef.current += 1;

      if (attemptCountRef.current > maxAttempts) {
        setTimedOut(true);
        throw new Error('Job polling timed out after maximum attempts');
      }

      const res = await apiClient.get<JobResponse>(`/api/jobs/${jobId}`);
      return res.data;
    },
    enabled: jobId !== null && !timedOut,
    refetchInterval: (query) => {
      const currentStatus = query.state.data?.status as JobStatus | undefined;
      if (!currentStatus) return pollingInterval;
      if (TERMINAL_STATUSES.includes(currentStatus)) return false;
      return pollingInterval;
    },
    retry: false,
    staleTime: 0,
  });

  const startPolling = useCallback((newJobId: string) => {
    attemptCountRef.current = 0;
    setTimedOut(false);
    setJobId(newJobId);
  }, []);

  const reset = useCallback(() => {
    setJobId(null);
    setTimedOut(false);
    attemptCountRef.current = 0;
  }, []);

  const status = timedOut
    ? JobStatus.FAILED
    : job
      ? (job.status as JobStatus)
      : null;

  const result = job?.status === JobStatus.COMPLETED ? (job.result as T) : null;

  const progress = readProgress(job);

  const error = timedOut
    ? 'Polling timed out. Please try again.'
    : job?.status === JobStatus.FAILED
      ? (job.error ?? 'Job failed')
      : queryError
        ? (queryError as Error).message
        : null;

  const isProcessing =
    jobId !== null &&
    !timedOut &&
    status !== null &&
    !TERMINAL_STATUSES.includes(status);

  return {
    status,
    result,
    progress,
    error,
    isProcessing,
    attemptCount: attemptCountRef.current,
    startPolling,
    reset,
  };
}

function readProgress(job: JobResponse | undefined): JobProgress | null {
  if (!job || job.status !== JobStatus.PROCESSING) return null;
  const payload = job.result as
    | {
        stage?: unknown;
        stageLabel?: unknown;
        stageIndex?: unknown;
        stageTotal?: unknown;
      }
    | null
    | undefined;
  if (!payload || typeof payload !== 'object') return null;
  if (
    typeof payload.stage !== 'string' ||
    typeof payload.stageLabel !== 'string' ||
    typeof payload.stageIndex !== 'number' ||
    typeof payload.stageTotal !== 'number'
  ) {
    return null;
  }
  return {
    stage: payload.stage,
    stageLabel: payload.stageLabel,
    stageIndex: payload.stageIndex,
    stageTotal: payload.stageTotal,
  };
}
