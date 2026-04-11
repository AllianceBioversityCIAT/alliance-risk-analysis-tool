'use client';

import { useEffect, useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import type { JobProgress } from '@/hooks/use-job-polling';

interface PdfGenerationProgressProps {
  isVisible: boolean;
  progress: JobProgress | null;
}

const FALLBACK_LABEL = 'Preparing your report';

export function PdfGenerationProgress({ isVisible, progress }: PdfGenerationProgressProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isVisible) {
      setElapsed(0);
      return;
    }
    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isVisible]);

  if (!isVisible) return null;

  const label = progress?.stageLabel ?? FALLBACK_LABEL;
  const index = progress?.stageIndex ?? 0;
  const total = progress?.stageTotal ?? 0;
  const percent = total > 0 ? Math.min(100, Math.round((index / total) * 100)) : 8;
  const elapsedLabel = formatElapsed(elapsed);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="pdf-generation-progress"
      className="fixed bottom-6 right-6 z-50 w-80 max-w-[calc(100vw-3rem)] rounded-2xl border border-border/70 bg-background/95 p-4 shadow-xl backdrop-blur"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <FileText className="h-4 w-4" />
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">Generating PDF report</p>
            <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground tabular-nums">
              <Loader2 className="h-3 w-3 animate-spin" />
              {elapsedLabel}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <p className="flex-1 truncate text-xs text-muted-foreground" data-testid="pdf-generation-stage-label">
              {label}
              {total > 0 ? <span className="ml-1 text-muted-foreground/70">· Step {index} of {total}</span> : null}
            </p>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            This typically takes 30–90 seconds. You can keep working — we&apos;ll ping you when the PDF is ready.
          </p>
        </div>
      </div>
    </div>
  );
}

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes === 0) return `${secs}s`;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}
