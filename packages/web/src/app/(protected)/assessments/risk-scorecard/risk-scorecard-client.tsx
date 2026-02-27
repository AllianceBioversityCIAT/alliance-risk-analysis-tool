'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { MessageSquare, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BreadcrumbTrail } from '@/components/shared/breadcrumb-trail';
import { AssessmentSubHeader } from '@/components/layout/assessment-sub-header';
import { RiskScoreOverview } from '@/components/risk-scorecard/risk-score-overview';
import { CategoryScoreCard } from '@/components/risk-scorecard/category-score-card';
import { RecommendationRow } from '@/components/risk-scorecard/recommendation-row';
import { CommentPanel } from '@/components/risk-scorecard/comment-panel';
import { Skeleton } from '@/components/ui/skeleton';
import { useAssessment } from '@/hooks/use-assessments';
import {
  useRiskScores,
  useEditRecommendation,
  useAssessmentComments,
  useAddComment,
} from '@/hooks/use-risk-scores';
import { RiskLevel } from '@alliance-risk/shared';
import type { AssessmentStatus as BadgeStatus } from '@/components/shared/status-badge';
import apiClient from '@/lib/api-client';

function mapStatus(s: string | undefined): BadgeStatus {
  const map: Record<string, BadgeStatus> = {
    DRAFT: 'draft', ANALYZING: 'analyzing', ACTION_REQUIRED: 'action_required', COMPLETE: 'complete',
  };
  return map[s ?? 'DRAFT'] ?? 'draft';
}

export default function RiskScorecardClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get('id');
  const [commentPanelOpen, setCommentPanelOpen] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  useEffect(() => {
    if (!id) {
      router.replace('/dashboard');
    }
  }, [id, router]);

  const { data: assessment, isLoading: assessmentLoading } = useAssessment(id ?? '');
  const { data: riskData, isLoading: riskLoading } = useRiskScores(id ?? '');
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

  const isLoading = assessmentLoading || riskLoading;
  const scores = riskData?.data ?? [];
  const allRecommendations = scores.flatMap((s) => s.recommendations);

  // Derive overall score/level
  const overallScore = riskData?.overallScore ?? 0;
  const overallLevel = (riskData?.overallLevel as RiskLevel) ?? RiskLevel.LOW;

  // Suppress unused variable warning for commentsLoading
  void commentsLoading;

  return (
    <div className="flex flex-col min-h-full">
      {/* Breadcrumb */}
      <div className="px-6 pt-4 pb-2">
        <BreadcrumbTrail
          items={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: assessment?.name ?? 'Assessment', href: '#' },
            { label: 'Risk Scorecard' },
          ]}
        />
      </div>

      {/* Sub-header */}
      {assessment && (
        <AssessmentSubHeader
          businessName={assessment.companyName}
          businessType={assessment.intakeMode}
          date={assessment.updatedAt}
          status={mapStatus(assessment.status)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 p-6 space-y-6 max-w-5xl mx-auto w-full">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full rounded-xl" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <>
            {/* Action bar */}
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setCommentPanelOpen(true)}
                className="gap-1.5"
              >
                <MessageSquare className="h-4 w-4" />
                Comments {comments.length > 0 && `(${comments.length})`}
              </Button>
              <Button onClick={handleGenerateReport} disabled={isGeneratingReport} className="gap-1.5">
                {isGeneratingReport ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                Generate Report
              </Button>
            </div>

            {/* Overall score overview */}
            <RiskScoreOverview overallScore={overallScore} overallLevel={overallLevel} />

            {/* 7 Category cards */}
            <div>
              <h2 className="text-base font-semibold text-foreground mb-3">Risk Categories</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {scores.map((score) => (
                  <CategoryScoreCard key={score.id} score={score} />
                ))}
              </div>
            </div>

            {/* Recommendations */}
            {allRecommendations.length > 0 && (
              <div>
                <h2 className="text-base font-semibold text-foreground mb-3">
                  Recommendations ({allRecommendations.length})
                </h2>
                <div className="space-y-2">
                  {allRecommendations.map((rec) => (
                    <RecommendationRow
                      key={rec.id}
                      recommendation={rec}
                      onSave={handleEditRecommendation}
                    />
                  ))}
                </div>
              </div>
            )}

            {scores.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mb-3" />
                <p className="text-sm font-medium">Running risk analysis...</p>
                <p className="text-xs mt-1">Scores will appear here once analysis completes.</p>
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

      {/* Backdrop for comment panel */}
      {commentPanelOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40"
          onClick={() => setCommentPanelOpen(false)}
        />
      )}
    </div>
  );
}
