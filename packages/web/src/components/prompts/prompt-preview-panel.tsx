'use client';

import { Loader2, Zap, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { JobStatus } from '@alliance-risk/shared';
import type { PromptPreviewRequest, PromptPreviewResponse, JobSubmitResponse } from '@alliance-risk/shared';
import apiClient from '@/lib/api-client';
import { useJobPolling } from '@/hooks/use-job-polling';

interface PromptPreviewPanelProps {
  systemPrompt: string;
  userPromptTemplate: string;
}

export function PromptPreviewPanel({ systemPrompt, userPromptTemplate }: PromptPreviewPanelProps) {
  const isEmpty = !systemPrompt && !userPromptTemplate;

  const { status, result, error, isProcessing, startPolling, reset } =
    useJobPolling<PromptPreviewResponse>();

  const handlePreview = async () => {
    reset();
    try {
      const payload: PromptPreviewRequest = { systemPrompt, userPromptTemplate };
      const res = await apiClient.post<{ data: JobSubmitResponse }>(
        '/api/admin/prompts/preview',
        payload,
      );
      startPolling(res.data.data.jobId);
    } catch (err: unknown) {
      console.error('Failed to submit preview job', err);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Zap className="h-4 w-4" />
        AI Preview
      </div>

      {isEmpty ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          Fill in the prompt fields to preview the output.
        </p>
      ) : (
        <div className="space-y-3">
          {/* Prompt previews */}
          <div className="rounded-lg border bg-muted/20 px-3 py-2.5 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">System Prompt</p>
            <p className="text-xs line-clamp-3">{systemPrompt}</p>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2.5 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">User Prompt Template</p>
            <p className="text-xs line-clamp-3">{userPromptTemplate}</p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              onClick={handlePreview}
              disabled={isProcessing}
              aria-label="Send to Bedrock"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Processing…
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-3.5 w-3.5" />
                  Send to Bedrock
                </>
              )}
            </Button>
            {(result || error) && (
              <Button
                size="sm"
                variant="outline"
                onClick={reset}
                aria-label="Reset preview"
                title="Reset"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          {/* Result display */}
          {status === JobStatus.COMPLETED && result && (
            <div className="rounded-lg border bg-background space-y-2 p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-green-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Preview complete
              </div>
              <div className="text-xs text-muted-foreground flex gap-4">
                <span>Tokens: {result.tokensUsed}</span>
                <span>Time: {(result.processingTime / 1000).toFixed(1)}s</span>
              </div>
              <div className="mt-2 rounded border bg-muted/30 px-3 py-2 text-xs whitespace-pre-wrap max-h-48 overflow-y-auto">
                {result.output}
              </div>
            </div>
          )}

          {error && status !== JobStatus.COMPLETED && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 flex items-start gap-2"
            >
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}

          {isProcessing && (
            <div className="rounded-lg border-2 border-dashed border-border py-6 text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
              <p className="text-xs text-muted-foreground mt-2">
                Waiting for Bedrock response…
              </p>
            </div>
          )}

          {!status && !isProcessing && !error && !result && (
            <div className="rounded-lg border-2 border-dashed border-border py-6 text-center">
              <p className="text-xs text-muted-foreground">
                AI output will appear here after processing.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
