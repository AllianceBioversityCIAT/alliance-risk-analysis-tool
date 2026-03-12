'use client';

import { useState } from 'react';
import { ChevronDown, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RiskLevel } from '@alliance-risk/shared';
import type { RiskScoreResponse, SubcategoryScore } from '@alliance-risk/shared';
import { LEVEL_CONFIG } from './risk-score-overview';

// ─── Category label mapping ─────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  FINANCIAL: 'Financial',
  CLIMATE_ENVIRONMENTAL: 'Climate & Environmental',
  BEHAVIORAL: 'Behavioral',
  OPERATIONAL: 'Operational',
  MARKET: 'Market',
  GOVERNANCE_LEGAL: 'Governance & Legal',
  TECHNOLOGY_DATA: 'Technology & Data',
};

function categoryLabel(raw: string): string {
  return CATEGORY_LABELS[raw] ?? raw.replace(/_/g, ' ');
}

// ─── Subcategory Card ────────────────────────────────────────────────────────

function SubcategoryCard({ sub }: Readonly<{ sub: SubcategoryScore }>) {
  const config = LEVEL_CONFIG[sub.level];
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-sm font-medium text-foreground">{sub.name}</span>
          <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full border shrink-0', config.color, config.bg)}>
            {sub.score}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowDetails((d) => !d)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          {showDetails ? 'Less' : 'Details'}
        </button>
      </div>

      {/* Score bar */}
      <div className="mt-1.5 h-1 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', config.barColor)}
          style={{ width: `${sub.score}%` }}
        />
      </div>

      {/* Indicator always visible */}
      {sub.indicator && (
        <p className="mt-1.5 text-xs text-muted-foreground leading-snug">{sub.indicator}</p>
      )}

      {/* Evidence + Mitigation on expand */}
      {showDetails && (
        <div className="mt-2 space-y-2 pt-2 border-t border-border/40">
          {sub.evidence && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Evidence</p>
              <p className="text-xs text-foreground/80 leading-relaxed">{sub.evidence}</p>
            </div>
          )}
          {sub.mitigation && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Mitigation</p>
              <p className="text-xs text-foreground/80 leading-relaxed">{sub.mitigation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Category Score Card ─────────────────────────────────────────────────────

interface CategoryScoreCardProps {
  score: RiskScoreResponse;
}

export function CategoryScoreCard({ score }: Readonly<CategoryScoreCardProps>) {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = LEVEL_CONFIG[score.level];
  const label = categoryLabel(score.category);

  return (
    <div
      className={cn(
        'bg-card border rounded-xl overflow-hidden shadow-sm transition-all',
        isExpanded ? 'border-border col-span-full' : 'border-border',
      )}
    >
      {/* Card header */}
      <button
        type="button"
        onClick={() => setIsExpanded((e) => !e)}
        className="w-full flex items-start justify-between gap-4 p-5 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <Shield className={cn('h-4 w-4 shrink-0', config.color)} />
              <p className="text-sm font-bold text-foreground truncate">{label}</p>
            </div>
            <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0', config.color, config.bg)}>
              {config.label}
            </span>
          </div>

          {/* Score bar */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', config.barColor)}
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

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-5 pb-5 space-y-4">
          {/* Evidence summary */}
          {score.evidence && (
            <div className="rounded-lg bg-muted/30 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Evidence Summary</p>
              <p className="text-xs text-foreground/80 leading-relaxed">{score.evidence}</p>
            </div>
          )}

          {/* Subcategories */}
          {score.subcategories.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Subcategories ({score.subcategories.length})
              </p>
              <div className={cn(
                'grid gap-2',
                'grid-cols-1 lg:grid-cols-2',
              )}>
                {score.subcategories.map((sub) => (
                  <SubcategoryCard key={sub.name} sub={sub} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
