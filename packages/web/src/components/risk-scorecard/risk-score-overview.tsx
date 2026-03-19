'use client';

import { cn } from '@/lib/utils';
import { RiskLevel } from '@alliance-risk/shared';

interface RiskScoreOverviewProps {
  overallScore: number;
  overallLevel: RiskLevel;
}

const LEVEL_CONFIG: Record<RiskLevel, { label: string; color: string; bg: string; barColor: string }> = {
  [RiskLevel.LOW]: { label: 'Low Risk', color: 'text-green-700', bg: 'bg-green-50 border-green-200', barColor: 'bg-green-500' },
  [RiskLevel.MODERATE]: { label: 'Moderate Risk', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200', barColor: 'bg-yellow-400' },
  [RiskLevel.HIGH]: { label: 'High Risk', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', barColor: 'bg-[#EA580C]' },
  [RiskLevel.CRITICAL]: { label: 'Critical Risk', color: 'text-destructive', bg: 'bg-destructive/10 border-destructive/30', barColor: 'bg-destructive' },
};

export function RiskScoreOverview({ overallScore, overallLevel }: RiskScoreOverviewProps) {
  const config = LEVEL_CONFIG[overallLevel];

  return (
    <div className="relative overflow-hidden rounded-xl border bg-card p-6 flex items-center gap-6 shadow-sm">
      <div className={cn('absolute left-0 top-0 bottom-0 w-1.5', config.barColor)} />

      {/* Score circle */}
      <div className={cn("flex flex-col items-center justify-center h-24 w-24 rounded-full border-[3px] shrink-0", config.color)}
        style={{ borderColor: 'currentColor' }}
      >
        <span className="text-4xl font-bold leading-none tracking-tight">{overallScore}</span>
        <span className="text-xs font-semibold mt-0.5 opacity-80">/ 100</span>
      </div>

      {/* Text + gauge */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          <p className="text-lg font-bold text-foreground tracking-tight">Overall Risk Score</p>
          <span className={cn('px-2.5 py-0.5 rounded-md text-xs font-semibold border', config.color, config.bg)}>
            {config.label}
          </span>
        </div>

        {/* Gauge bar */}
        <div className="mt-4 h-2 w-full rounded-full bg-muted/60 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-1000 ease-out', config.barColor)}
            style={{ width: `${overallScore}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
          <span>Min (0)</span>
          <span>Low (25)</span>
          <span>Moderate (50)</span>
          <span>High (75)</span>
          <span>Critical (100)</span>
        </div>
      </div>
    </div>
  );
}

export { LEVEL_CONFIG };
