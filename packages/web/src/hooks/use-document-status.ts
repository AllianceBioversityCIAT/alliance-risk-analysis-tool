'use client';

/**
 * useDocumentStatus — polls GET /api/jobs/:id every 3 seconds.
 * Stops automatically when the job reaches a terminal state (COMPLETED or FAILED).
 *
 * This is a thin semantic wrapper over useJobPolling tailored for the
 * upload → parse flow.
 */
import { useJobPolling, type UseJobPollingResult } from './use-job-polling';
import { JobStatus } from '@alliance-risk/shared';
import type { ExtractionResult } from '@alliance-risk/shared';

export type DocumentJobStatus = JobStatus | null;

export interface UseDocumentStatusResult {
  jobStatus: DocumentJobStatus;
  extractionResult: ExtractionResult | null;
  errorMessage: string | null;
  isProcessing: boolean;
  startPolling: (jobId: string) => void;
  reset: () => void;
}

export function useDocumentStatus(): UseDocumentStatusResult {
  const polling: UseJobPollingResult<ExtractionResult> = useJobPolling<ExtractionResult>({
    pollingInterval: 3000,
    maxAttempts: 200, // ~10 min at 3s — Textract can take several minutes for large PDFs
  });

  return {
    jobStatus: polling.status,
    extractionResult: polling.result,
    errorMessage: polling.error,
    isProcessing: polling.isProcessing,
    startPolling: polling.startPolling,
    reset: polling.reset,
  };
}
