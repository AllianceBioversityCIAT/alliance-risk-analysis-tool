'use client';

import { cn } from '@/lib/utils';
import { RiskLevel } from '@alliance-risk/shared';
import { RecommendationRow } from './recommendation-row';
import { LEVEL_CONFIG } from './risk-score-overview';
import { getCategoryIcon } from './category-config';
import type { EnrichedRecommendation } from './recommendation-types';

const PRIORITY_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;

interface RecommendationCategoryGroupProps {
  category: string;
  categoryLabel: string;
  score: number;
  level: RiskLevel;
  recommendations: EnrichedRecommendation[];
  onSave: (id: string, text: string) => Promise<void>;
}

export function RecommendationCategoryGroup({
  category,
  categoryLabel,
  score,
  level,
  recommendations,
  onSave,
}: RecommendationCategoryGroupProps) {
  const config = LEVEL_CONFIG[level];
  const CategoryIcon = getCategoryIcon(category);
  const sorted = [...recommendations].sort(
    (a, b) => (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2),
  );

  return (
    <div>
      {/* Category header */}
      <div className="flex items-center gap-2 mb-2 px-1">
        <CategoryIcon className={cn('h-4 w-4 shrink-0', config.color)} />
        <span className="text-sm font-semibold text-foreground">{categoryLabel}</span>
        <span className="text-xs text-muted-foreground">({recommendations.length})</span>
        <span className="text-xs text-muted-foreground mx-1">—</span>
        <span className="text-xs text-muted-foreground">Score: {score}</span>
        <span
          className={cn(
            'text-[10px] font-semibold px-1.5 py-0.5 rounded-full border',
            config.color,
            config.bg,
          )}
        >
          {config.label}
        </span>
      </div>

      {/* Recommendation rows */}
      <div className="space-y-2">
        {sorted.map((rec) => (
          <RecommendationRow key={rec.id} recommendation={rec} onSave={onSave} />
        ))}
      </div>
    </div>
  );
}
