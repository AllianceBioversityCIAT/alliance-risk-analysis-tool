'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2, Check, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PipelineStep {
  label: string;
  description: string;
  icon: React.ReactNode;
}

export interface PipelineStepperProps {
  /** Title shown in the header */
  title: string;
  /** Subtitle shown below the title */
  subtitle: string;
  /** Steps to display */
  steps: PipelineStep[];
  /** Index of the currently active step (0-based). Steps before this are complete. */
  activeStepIndex: number;
  /** Optional progress percentage (0-100). Shows a gradient progress bar when provided. */
  progress?: number;
  /** Optional footer content (e.g. document badges) */
  footer?: React.ReactNode;
}

// ─── Elapsed Timer Hook ──────────────────────────────────────────────────────

function useElapsedTimer() {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number>(Date.now());

  useEffect(() => {
    startRef.current = Date.now();
    setElapsed(0);
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ─── Pipeline Stepper Component ──────────────────────────────────────────────

export function PipelineStepper({
  title,
  subtitle,
  steps,
  activeStepIndex,
  progress,
  footer,
}: PipelineStepperProps) {
  const elapsedStr = useElapsedTimer();

  return (
    <div className="flex items-center justify-center py-8">
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden w-full max-w-lg">
        {/* Header */}
        <div className="px-5 py-4 border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full border-2 border-emerald-500/30 flex items-center justify-center">
                <Loader2 className="h-4 w-4 text-emerald-600 animate-spin" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{title}</p>
                <p className="text-xs text-muted-foreground">{subtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span className="text-xs font-mono tabular-nums">{elapsedStr}</span>
            </div>
          </div>
        </div>

        {/* Steps */}
        <div className="px-5 py-4">
          <div className="space-y-0">
            {steps.map((step, idx) => {
              const isComplete = idx < activeStepIndex;
              const isActive = idx === activeStepIndex;
              const isPending = idx > activeStepIndex;
              const isLast = idx === steps.length - 1;

              return (
                <div key={step.label} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      'flex items-center justify-center h-7 w-7 rounded-full shrink-0 transition-all duration-500',
                      isComplete && 'bg-emerald-100 text-emerald-600',
                      isActive && 'bg-blue-100 text-blue-600 ring-2 ring-blue-500/30',
                      isPending && 'bg-muted text-muted-foreground/40',
                    )}>
                      {isComplete ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : isActive ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        step.icon
                      )}
                    </div>
                    {!isLast && (
                      <div className={cn(
                        'w-0.5 h-5 transition-colors duration-500',
                        isComplete ? 'bg-emerald-300' : 'bg-border',
                      )} />
                    )}
                  </div>
                  <div className={cn('pt-1 pb-3', isPending && 'opacity-40')}>
                    <p className={cn(
                      'text-sm font-medium leading-tight',
                      isActive && 'text-blue-700',
                      isComplete && 'text-foreground',
                      isPending && 'text-muted-foreground',
                    )}>
                      {step.label}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Progress bar (optional) */}
        {progress != null && (
          <div className="px-5 pb-4">
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-blue-500 transition-all duration-1000 ease-out"
                style={{ width: `${Math.min(progress, 95)}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5 text-right">{progress}% complete</p>
          </div>
        )}

        {/* Footer (optional — e.g. document badges) */}
        {footer && (
          <div className="px-5 pb-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
