'use client';

import { Loader2 } from 'lucide-react';
import { AssessmentStatus } from '@alliance-risk/shared';

function statusLabel(status: string | undefined): string {
  switch (status) {
    case AssessmentStatus.ANALYZING: return 'Analyzing...';
    case AssessmentStatus.COMPLETE: return 'Risk Analysis Complete';
    case AssessmentStatus.ACTION_REQUIRED: return 'Action Required';
    case AssessmentStatus.DRAFT: return 'Draft';
    default: return 'Processing...';
  }
}

export interface AssessmentTopBarProps {
  name: string;
  shortId: string;
  progress: number;
  status: string;
}

export function AssessmentTopBar({ name, shortId, progress, status }: Readonly<AssessmentTopBarProps>) {
  const isAnalyzing = status === AssessmentStatus.ANALYZING;

  return (
    <div className="text-white px-6 py-3" style={{ backgroundColor: '#1A3C40' }}>
      <div className="flex items-center justify-between gap-4">
        {/* Left: name + ID */}
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-sm font-bold text-white truncate">{name}</h1>
          <span className="text-[10px] text-white/50 font-mono shrink-0">
            {shortId}
          </span>
        </div>

        {/* Right: progress + status */}
        <div className="flex items-center gap-3 shrink-0">
          {isAnalyzing && (
            <Loader2 className="h-3.5 w-3.5 text-white/60 animate-spin" />
          )}
          <span className="text-xs text-white/70">{statusLabel(status)}</span>
          <span className="text-sm font-bold text-white">{progress}%</span>
          <div className="h-1.5 w-20 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-400 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
