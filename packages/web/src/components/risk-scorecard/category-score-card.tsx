'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, RefreshCw, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RiskLevel, JobStatus } from '@alliance-risk/shared';
import type { RiskScoreResponse, SubcategoryScore } from '@alliance-risk/shared';
import { LEVEL_CONFIG } from './risk-score-overview';
import { getCategoryConfig } from './category-config';
import { useUpdateAnalystComment, useResyncCategory } from '@/hooks/use-risk-scores';
import { useJobPolling } from '@/hooks/use-job-polling';
import { useQueryClient } from '@tanstack/react-query';
import { sileo } from 'sileo';

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
  assessmentId: string;
  onResyncStateChange?: (category: string, isResyncing: boolean) => void;
}

export function CategoryScoreCard({ score, assessmentId, onResyncStateChange }: Readonly<CategoryScoreCardProps>) {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = LEVEL_CONFIG[score.level];
  const catConfig = getCategoryConfig(score.category);
  const CategoryIcon = catConfig.icon;
  const label = catConfig.label;

  // Analyst comment state
  const [commentText, setCommentText] = useState(score.analystComment ?? '');
  const commentRef = useRef(commentText);
  commentRef.current = commentText;
  const { mutateAsync: updateComment } = useUpdateAnalystComment(assessmentId);

  // Keep local state in sync with server data
  useEffect(() => {
    setCommentText(score.analystComment ?? '');
  }, [score.analystComment]);

  const handleCommentBlur = useCallback(async () => {
    const trimmed = commentRef.current.trim();
    const original = score.analystComment ?? '';
    if (trimmed === original) return;
    try {
      await updateComment({ scoreId: score.id, comment: trimmed });
      sileo.success({ title: 'Commentary saved' });
    } catch {
      sileo.error({ title: 'Failed to save commentary' });
    }
  }, [score.id, score.analystComment, updateComment]);

  // Resync state
  const queryClient = useQueryClient();
  const { mutateAsync: resync } = useResyncCategory(assessmentId);
  const { status: jobStatus, error: jobError, isProcessing, startPolling, reset } = useJobPolling();

  const handleResync = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { jobId } = await resync(score.category);
      startPolling(jobId);
      onResyncStateChange?.(score.category, true);
    } catch {
      sileo.error({ title: 'Failed to start resync' });
    }
  }, [resync, score.category, startPolling, onResyncStateChange]);

  // Handle job completion/failure
  useEffect(() => {
    if (jobStatus === JobStatus.COMPLETED) {
      queryClient.invalidateQueries({ queryKey: ['risk-scores', assessmentId] });
      sileo.success({ title: 'Category resynced', description: `${label} has been recalculated.` });
      onResyncStateChange?.(score.category, false);
      reset();
    } else if (jobStatus === JobStatus.FAILED) {
      sileo.error({ title: 'Resync failed', description: jobError ?? 'Unknown error' });
      onResyncStateChange?.(score.category, false);
      reset();
    }
  }, [jobStatus, jobError, queryClient, assessmentId, label, reset, score.category, onResyncStateChange]);

  const isHighRisk = score.level === RiskLevel.HIGH;
  const isCritical = score.level === RiskLevel.CRITICAL;

  const handleHeaderKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsExpanded((prev) => !prev);
    }
  }, []);

  return (
    <div
      className={cn(
        'bg-card border rounded-xl overflow-hidden shadow-sm transition-all',
        isExpanded ? 'col-span-full' : '',
        isCritical
          ? 'border-destructive border-2 ring-2 ring-destructive/20'
          : isHighRisk
            ? 'border-orange-400 border-2'
            : 'border-border',
      )}
    >
      {/* Card header — a clickable container, not a <button>, because it holds the
          real "Resync" <button> below it and HTML forbids nesting interactive
          controls (button-in-button breaks hydration). role="button" + key
          handling preserve the same keyboard/screen-reader behavior a real
          button would have. */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsExpanded((e) => !e)}
        onKeyDown={handleHeaderKeyDown}
        aria-expanded={isExpanded}
        className="w-full flex items-start justify-between gap-4 p-5 hover:bg-muted/30 transition-colors text-left cursor-pointer"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <CategoryIcon className={cn('h-4 w-4 shrink-0', config.color)} />
              <p className="text-sm font-bold text-foreground truncate">{label}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleResync}
                onKeyDown={(e) => e.stopPropagation()}
                disabled={isProcessing}
                className={cn(
                  'p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors border border-transparent hover:border-primary/20',
                  isProcessing && 'cursor-not-allowed opacity-50',
                )}
                title="Resync this category"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', isProcessing && 'animate-spin')} />
              </button>
              {(isHighRisk || isCritical) && (
                <AlertTriangle className={cn('h-3.5 w-3.5', isCritical ? 'text-destructive' : 'text-orange-500')} />
              )}
              <span className={cn(
                'text-xs font-semibold px-2 py-0.5 rounded-md border shadow-sm',
                config.color, config.bg,
                isCritical && 'animate-pulse',
              )}>
                {config.label}
              </span>
            </div>
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
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-5 pb-5 pt-2 space-y-5 border-t border-border/50 mt-1">
          {/* Evidence summary */}
          {score.evidence && (
            <div className="rounded-lg bg-muted/30 p-4 border border-border/40 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-primary/60"></span>
                Evidence Summary
              </p>
              <p className="text-sm text-foreground/90 leading-relaxed">{score.evidence}</p>
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

          {/* Analyst Commentary */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Analyst Commentary
            </p>
            <textarea
              className="w-full rounded-lg border border-border bg-muted/20 p-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-y min-h-[80px]"
              placeholder="Add expert commentary for this category..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onBlur={handleCommentBlur}
              rows={3}
            />
          </div>
        </div>
      )}
    </div>
  );
}
