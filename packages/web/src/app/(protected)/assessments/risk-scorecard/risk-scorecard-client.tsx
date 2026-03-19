'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import { MessageSquare, FileText, Loader2, Check, Database, BarChart3, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PipelineStepper } from '@/components/shared/pipeline-stepper';
import { AssessmentPageShell } from '@/components/shared/assessment-page-shell';
import { RiskScoreOverview } from '@/components/risk-scorecard/risk-score-overview';
import { CategoryScoreCard } from '@/components/risk-scorecard/category-score-card';
import { RecommendationCategoryGroup } from '@/components/risk-scorecard/recommendation-category-group';
import { RecommendationFilterBar } from '@/components/risk-scorecard/recommendation-filter-bar';
import { getCategoryLabel } from '@/components/risk-scorecard/category-config';
import { CommentPanel } from '@/components/risk-scorecard/comment-panel';
import { RiskMatrixDialog } from '@/components/risk-scorecard/risk-matrix-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useAssessment } from '@/hooks/use-assessments';
import {
  useRiskScores,
  useEditRecommendation,
  useAssessmentComments,
  useAddComment,
} from '@/hooks/use-risk-scores';
import { AssessmentStatus, RiskLevel, RecommendationPriority } from '@alliance-risk/shared';
import apiClient from '@/lib/api-client';
import type { EnrichedRecommendation } from '@/components/risk-scorecard/recommendation-types';

const POLL_INTERVAL = 5000; // 5 seconds

// ─── Risk Analysis Steps ─────────────────────────────────────────────────────

const RISK_PIPELINE_STEPS: import('@/components/shared/pipeline-stepper').PipelineStep[] = [
  { label: 'Documents Parsed', description: 'Text extracted from uploads', icon: <Database className="h-4 w-4" /> },
  { label: 'Gap Detection', description: 'Business data fields identified', icon: <BarChart3 className="h-4 w-4" /> },
  { label: 'AI Risk Analysis', description: 'Scoring 7 categories with 35 indicators', icon: <Brain className="h-4 w-4" /> },
  { label: 'Scorecard Ready', description: 'Results available for review', icon: <Check className="h-4 w-4" /> },
];

const RISK_THRESHOLDS = [30, 50, 75, 90];

function getRiskActiveStep(progress: number): number {
  for (let i = RISK_THRESHOLDS.length - 1; i >= 0; i--) {
    if (progress >= RISK_THRESHOLDS[i]) return Math.min(i + 1, RISK_PIPELINE_STEPS.length - 1);
  }
  return 0;
}

function RiskSkeletonGrid() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-32 w-full rounded-xl" />
      <div>
        <Skeleton className="h-5 w-36 mb-3 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={`cat-skeleton-${i}`} className="rounded-xl border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-32 rounded" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
              <Skeleton className="h-3 w-24 rounded" />
            </div>
          ))}
        </div>
      </div>
      <div>
        <Skeleton className="h-5 w-40 mb-3 rounded" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={`rec-skeleton-${i}`} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function RiskScorecardClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get('id');
  const [commentPanelOpen, setCommentPanelOpen] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | RecommendationPriority>('ALL');
  const resyncingCategoriesRef = useRef(new Set<string>());
  const [hasActiveResync, setHasActiveResync] = useState(false);

  const handleResyncStateChange = useCallback((category: string, isResyncing: boolean) => {
    if (isResyncing) {
      resyncingCategoriesRef.current.add(category);
    } else {
      resyncingCategoriesRef.current.delete(category);
    }
    setHasActiveResync(resyncingCategoriesRef.current.size > 0);
  }, []);

  useEffect(() => {
    if (!id) {
      router.replace('/dashboard');
    }
  }, [id, router]);

  // Start as false — only poll once we confirm status is ANALYZING with no scores
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const { data: assessment, isLoading: assessmentLoading } = useAssessment(id ?? '', {
    refetchInterval: isAnalyzing ? POLL_INTERVAL : false,
  });

  const { data: riskData, isLoading: riskLoading } = useRiskScores(id ?? '', {
    refetchInterval: isAnalyzing ? POLL_INTERVAL : false,
  });

  useEffect(() => {
    if (!assessment) return;
    const scoresPresent = (riskData?.length ?? 0) > 0;
    const statusDone =
      assessment.status === AssessmentStatus.COMPLETE ||
      assessment.status === AssessmentStatus.ACTION_REQUIRED;
    setIsAnalyzing(!statusDone || !scoresPresent);
  }, [assessment, riskData]);

  const { mutateAsync: editRec } = useEditRecommendation(id ?? '');
  const { data: comments = [], isLoading: commentsLoading } = useAssessmentComments(id ?? '');
  const { mutateAsync: addComment, isPending: addingComment } = useAddComment(id ?? '');

  const handleEditRecommendation = useCallback(
    async (recId: string, text: string) => {
      await editRec({ recId, text });
    },
    [editRec],
  );

  const handleGenerateReport = useCallback(async () => {
    if (!id) return;
    setIsGeneratingReport(true);
    try {
      await apiClient.post(`/api/assessments/${id}/report/pdf`);
      router.push(`/assessments/report?id=${id}`);
    } catch {
      setIsGeneratingReport(false);
    }
  }, [id, router]);

  if (!id) return null;

  void commentsLoading;

  const isLoading = assessmentLoading || riskLoading;
  const scores = riskData ?? [];
  const allRecommendations: EnrichedRecommendation[] = scores.flatMap((s) =>
    s.recommendations.map((rec) => ({
      ...rec,
      category: s.category,
      categoryLabel: getCategoryLabel(s.category),
      categoryScore: s.score,
      categoryLevel: s.level as RiskLevel,
    })),
  );

  const filteredRecommendations =
    priorityFilter === 'ALL'
      ? allRecommendations
      : allRecommendations.filter((r) => r.priority === priorityFilter);

  const filterCounts: Record<'ALL' | RecommendationPriority, number> = {
    ALL: allRecommendations.length,
    [RecommendationPriority.HIGH]: allRecommendations.filter((r) => r.priority === RecommendationPriority.HIGH).length,
    [RecommendationPriority.MEDIUM]: allRecommendations.filter((r) => r.priority === RecommendationPriority.MEDIUM).length,
    [RecommendationPriority.LOW]: allRecommendations.filter((r) => r.priority === RecommendationPriority.LOW).length,
  };

  // Group filtered recommendations by category (preserving scores order)
  const groupedByCategory = scores
    .map((s) => ({
      category: s.category,
      categoryLabel: getCategoryLabel(s.category),
      score: s.score,
      level: s.level as RiskLevel,
      recommendations: filteredRecommendations.filter((r) => r.category === s.category),
    }))
    .filter((g) => g.recommendations.length > 0);

  const overallScore = assessment?.overallRiskScore ?? 0;
  const overallLevel = (assessment?.overallRiskLevel as RiskLevel) ?? RiskLevel.LOW;

  const analysisRunning =
    scores.length === 0 &&
    assessment?.status === AssessmentStatus.ANALYZING;

  const reportDisabled = isGeneratingReport || isAnalyzing || hasActiveResync;

  const actionButtons = !isLoading && scores.length > 0 ? (
    <>
      <RiskMatrixDialog />
      <Button
        variant="outline"
        onClick={() => setCommentPanelOpen(true)}
        className="gap-1.5"
      >
        <MessageSquare className="h-4 w-4" />
        Comments {comments.length > 0 && `(${comments.length})`}
      </Button>
      <Button onClick={handleGenerateReport} disabled={reportDisabled} className="gap-1.5">
        {isGeneratingReport ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileText className="h-4 w-4" />
        )}
        Generate Report
      </Button>
    </>
  ) : undefined;

  return (
      <AssessmentPageShell
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Gap Detector', href: `/assessments/gap-detector?id=${id}` },
          { label: 'Risk Scorecard' },
        ]}
        assessment={assessment}
        title="Risk Scorecard"
        description="AI-generated risk scores across 7 categories with evidence-based recommendations."
        actions={actionButtons}
      >
        <div className="flex-1 px-6 pb-6 space-y-6 max-w-6xl mx-auto w-full">
          {isLoading && <RiskSkeletonGrid />}

          {!isLoading && analysisRunning && (
            <PipelineStepper
              title="Risk Analysis in Progress"
              subtitle="This typically takes 3-5 minutes"
              steps={RISK_PIPELINE_STEPS}
              activeStepIndex={getRiskActiveStep(assessment?.progress ?? 50)}
              progress={assessment?.progress ?? 50}
            />
          )}

          {!isLoading && !analysisRunning && (
            <>
              {scores.length > 0 && (
                <RiskScoreOverview overallScore={overallScore} overallLevel={overallLevel} />
              )}

              {scores.length > 0 && (
                <div>
                  <h2 className="text-base font-semibold text-foreground mb-3">Risk Categories</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {scores.map((score) => (
                      <CategoryScoreCard
                        key={score.id}
                        score={score}
                        assessmentId={id}
                        onResyncStateChange={handleResyncStateChange}
                      />
                    ))}
                  </div>
                </div>
              )}

              {allRecommendations.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <h2 className="text-base font-semibold text-foreground">
                      Key Recommendations ({filteredRecommendations.length})
                    </h2>
                    <RecommendationFilterBar
                      counts={filterCounts}
                      active={priorityFilter}
                      onChange={setPriorityFilter}
                    />
                  </div>
                  <div className="space-y-6">
                    {groupedByCategory.map((group) => (
                      <RecommendationCategoryGroup
                        key={group.category}
                        category={group.category}
                        categoryLabel={group.categoryLabel}
                        score={group.score}
                        level={group.level}
                        recommendations={group.recommendations}
                        onSave={handleEditRecommendation}
                      />
                    ))}
                  </div>
                </div>
              )}

              {scores.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
                  <p className="text-sm font-medium">No risk scores available yet.</p>
                  <p className="text-xs mt-1">
                    Return to the Gap Detector and run the analysis to generate scores.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Comment panel */}
        <CommentPanel
          comments={comments}
          isOpen={commentPanelOpen}
          onClose={() => setCommentPanelOpen(false)}
          onSubmit={async (content) => { await addComment(content); }}
          isSubmitting={addingComment}
        />

        {commentPanelOpen && (
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setCommentPanelOpen(false)}
          />
        )}
      </AssessmentPageShell>
  );
}
