'use client';

import { FileText, X, RefreshCw, ListOrdered } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export type FileItemStatus =
  | 'idle'
  | 'uploading'
  | 'parsing'
  | 'complete'
  | 'failed';

export interface FileListItemProps {
  fileName: string;
  fileSize: number;
  status: FileItemStatus;
  /** Upload progress 0-100. Used only when status === 'uploading'. */
  uploadProgress?: number;
  errorMessage?: string;
  /** Called when user clicks the remove (×) button. Only shown before parsing starts. */
  onRemove?: () => void;
  /** Called when user clicks "Try Again" in failed state. */
  onRetry?: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_DOT: Record<FileItemStatus, string> = {
  idle: 'bg-muted-foreground',
  uploading: 'bg-[#E87722]',
  parsing: 'bg-[#E87722]',
  complete: 'bg-[#16A34A]',
  failed: 'bg-[#DC2626]',
};

const STATUS_LABEL: Record<FileItemStatus, string> = {
  idle: 'Ready',
  uploading: 'Uploading...',
  parsing: 'Scanning for data gaps...',
  complete: 'Complete',
  failed: 'Failed',
};

export function FileListItem({
  fileName,
  fileSize,
  status,
  uploadProgress,
  errorMessage,
  onRemove,
  onRetry,
}: FileListItemProps) {
  const canRemove = (status === 'idle' || status === 'uploading') && onRemove;
  const showProgress = status === 'uploading' || status === 'parsing';
  const isIndeterminate = status === 'parsing';

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-3">
      {/* File icon */}
      <div className="h-9 w-9 rounded-lg bg-[#F4F9F9] border border-[#E5E7EB] flex items-center justify-center shrink-0 mt-0.5">
        <FileText className="h-4 w-4 text-[#4CAF50]" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1.5">
        {/* File name + status dot */}
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground truncate flex-1">{fileName}</p>
          <span
            className={cn('h-2 w-2 rounded-full shrink-0', STATUS_DOT[status])}
            aria-hidden="true"
          />
        </div>

        {/* File size + status text */}
        <p className="text-xs text-muted-foreground">
          {formatBytes(fileSize)} &middot;{' '}
          <span
            className={cn(
              status === 'complete' && 'text-[#16A34A] font-medium',
              status === 'failed' && 'text-[#DC2626] font-medium',
            )}
          >
            {status === 'failed' && errorMessage
              ? `Failed: ${errorMessage}`
              : STATUS_LABEL[status]}
          </span>
          {status === 'uploading' && uploadProgress !== undefined && (
            <span className="ml-1">({uploadProgress}%)</span>
          )}
        </p>

        {/* Progress bar */}
        {showProgress && (
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            {isIndeterminate ? (
              <div className="h-full w-1/3 rounded-full bg-[#E87722] animate-[indeterminate_1.4s_ease-in-out_infinite]" />
            ) : (
              <div
                className="h-full rounded-full bg-[#E87722] transition-all duration-300"
                style={{ width: `${uploadProgress ?? 0}%` }}
              />
            )}
          </div>
        )}

        {/* Retry button in failed state */}
        {status === 'failed' && onRetry && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-1 h-7 text-xs gap-1.5 border-[#DC2626] text-[#DC2626] hover:bg-[#DC2626]/10"
            onClick={onRetry}
          >
            <RefreshCw className="h-3 w-3" />
            Try Again
          </Button>
        )}
      </div>

      {/* Remove button — only before parsing */}
      {canRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive mt-0.5"
          onClick={onRemove}
          aria-label="Remove file"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

// ─── ProcessingQueue wrapper ─────────────────────────────────────────────────

interface ProcessingQueueProps {
  children: React.ReactNode;
}

export function ProcessingQueue({ children }: ProcessingQueueProps) {
  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <ListOrdered className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Processing Queue
        </p>
      </div>
      {children}
    </div>
  );
}
