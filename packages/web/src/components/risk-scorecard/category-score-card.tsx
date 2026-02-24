'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RiskLevel } from '@alliance-risk/shared';
import type { RiskScoreResponse, SubcategoryScore } from '@alliance-risk/shared';
import { LEVEL_CONFIG } from './risk-score-overview';

// ─── Subcategory Row ──────────────────────────────────────────────────────────

function SubcategoryRow({ sub }: { sub: SubcategoryScore }) {
  const config = LEVEL_CONFIG[sub.level];
  return (
    <tr className="border-t border-border/50 hover:bg-muted/30">
      <td className="py-2 pr-4 text-sm text-foreground">{sub.name}</td>
      <td className="py-2 pr-4">
        <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border', config.color, config.bg)}>
          {config.label.split(' ')[0]}
        </span>
      </td>
      <td className="py-2 pr-4 text-xs text-muted-foreground max-w-[200px] truncate">{sub.indicator}</td>
      <td className="py-2 pr-4 text-xs text-muted-foreground">{sub.evidence ?? '—'}</td>
      <td className="py-2 text-xs text-muted-foreground">{sub.mitigation ?? '—'}</td>
    </tr>
  );
}

// ─── Category Score Card ──────────────────────────────────────────────────────

interface CategoryScoreCardProps {
  score: RiskScoreResponse;
}

export function CategoryScoreCard({ score }: CategoryScoreCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = LEVEL_CONFIG[score.level];

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
      {/* Card header */}
      <button
        type="button"
        onClick={() => setIsExpanded((e) => !e)}
        className="w-full flex items-start justify-between gap-4 p-5 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-sm font-bold text-foreground">{score.category}</p>
            <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0', config.color, config.bg)}>
              {config.label}
            </span>
          </div>

          {/* Score bar */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={cn('h-full rounded-full', config.barColor)}
                style={{ width: `${score.score}%` }}
              />
            </div>
            <span className="text-sm font-bold text-foreground w-8 text-right">{score.score}</span>
          </div>

          {score.narrative && (
            <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{score.narrative}</p>
          )}
        </div>

        <ChevronDown
          className={cn('h-4 w-4 text-muted-foreground shrink-0 mt-0.5 transition-transform', isExpanded && 'rotate-180')}
        />
      </button>

      {/* Subcategory table */}
      {isExpanded && score.subcategories.length > 0 && (
        <div className="px-5 pb-5 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr>
                {['Subcategory', 'Level', 'Indicator', 'Evidence', 'Mitigation'].map((h) => (
                  <th key={h} className="pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground pr-4 last:pr-0">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {score.subcategories.map((sub, i) => (
                <SubcategoryRow key={i} sub={sub} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
