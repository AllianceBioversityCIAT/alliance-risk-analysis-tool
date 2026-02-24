'use client';

import { cn } from '@/lib/utils';
import { RiskLevel } from '@alliance-risk/shared';
import { LEVEL_CONFIG } from '@/components/risk-scorecard/risk-score-overview';

interface ReportSectionProps {
  id: string;
  heading: string;
  score?: number;
  level?: RiskLevel;
  children: React.ReactNode;
  className?: string;
}

export function ReportSection({
  id,
  heading,
  score,
  level,
  children,
  className,
}: ReportSectionProps) {
  const levelConfig = level ? LEVEL_CONFIG[level] : null;

  return (
    <section id={id} className={cn('py-8 border-b border-border last:border-0', className)}>
      {/* Section heading row */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-xl font-bold text-foreground">{heading}</h2>
        {score !== undefined && levelConfig && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-2xl font-bold text-foreground">{score}</span>
            <span
              className={cn(
                'px-2.5 py-0.5 rounded-full text-xs font-semibold border',
                levelConfig.color,
                levelConfig.bg,
              )}
            >
              {levelConfig.label}
            </span>
          </div>
        )}
      </div>
      {children}
    </section>
  );
}
