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
    <div className={cn('rounded-xl border p-6 flex items-center gap-6', config.bg)}>
      {/* Score circle */}
      <div className="flex flex-col items-center justify-center h-24 w-24 rounded-full border-4 border-current shrink-0"
        style={{ borderColor: 'currentColor' }}
      >
        <span className={cn('text-4xl font-bold leading-none', config.color)}>{overallScore}</span>
        <span className={cn('text-xs font-medium mt-0.5', config.color)}>/ 100</span>
      </div>

      {/* Text + gauge */}
      <div className="flex-1 min-w-0">
        <p className="text-lg font-bold text-foreground">Overall Risk Score</p>
        <span className={cn('inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border', config.color, config.bg)}>
          {config.label}
        </span>

        {/* Gauge bar */}
        <div className="mt-3 h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', config.barColor)}
            style={{ width: `${overallScore}%` }}
          />
        </div>
        <div className="flex justify-between mt-1 text-xs text-muted-foreground">
          <span>0</span>
          <span>25</span>
          <span>50</span>
          <span>75</span>
          <span>100</span>
        </div>
      </div>
    </div>
  );
}

export { LEVEL_CONFIG };
