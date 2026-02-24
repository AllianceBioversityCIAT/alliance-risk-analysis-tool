'use client';

import { use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { BreadcrumbTrail } from '@/components/shared/breadcrumb-trail';
import { AssessmentSubHeader } from '@/components/layout/assessment-sub-header';
import { GapLayout, GapSummaryBar } from '@/components/gap-detector/gap-layout';
import { GapCategoryGroup } from '@/components/gap-detector/gap-field-card';
import { PdfViewer } from '@/components/gap-detector/pdf-viewer';
import { useGapFields, useUpdateGapFields } from '@/hooks/use-gap-detection';
import { useAssessment } from '@/hooks/use-assessments';
import { GapFieldStatus } from '@alliance-risk/shared';
import type { GapFieldResponse } from '@alliance-risk/shared';
import type { AssessmentStatus as BadgeStatus } from '@/components/shared/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import apiClient from '@/lib/api-client';

interface GapDetectorPageProps {
  params: Promise<{ id: string }>;
}

// Group gap fields by category
function groupByCategory(fields: GapFieldResponse[]) {
  const map = new Map<string, GapFieldResponse[]>();
  for (const field of fields) {
    if (!map.has(field.category)) map.set(field.category, []);
    map.get(field.category)!.push(field);
  }
  return Array.from(map.entries()).map(([category, fields]) => ({ category, fields }));
}

export default function GapDetectorPage({ params }: GapDetectorPageProps) {
  const { id } = use(params);
  const router = useRouter();

  const { data: assessment, isLoading: assessmentLoading } = useAssessment(id);
  const { data: gapData, isLoading: gapLoading } = useGapFields(id);
  const { mutateAsync: updateFields } = useUpdateGapFields(id);

  const handleUpdateField = useCallback(
    async (fieldId: string, value: string) => {
      await updateFields([{ id: fieldId, correctedValue: value }]);
    },
    [updateFields],
  );

  const handleSubmitAll = useCallback(async () => {
    try {
      await apiClient.post(`/api/assessments/${id}/trigger-risk-analysis`);
      router.push(`/assessments/${id}/risk-scorecard`);
    } catch {
      // Error handling could be added here
    }
  }, [id, router]);

  const isLoading = assessmentLoading || gapLoading;
  const fields = gapData?.data ?? [];
  const total = gapData?.total ?? 0;
  const verified = gapData?.verifiedCount ?? 0;
  const missing = gapData?.missingCount ?? 0;
  const allMandatoryComplete = gapData?.allMandatoryComplete ?? false;
  const groups = groupByCategory(fields);

  // Check if assessment has a document (UPLOAD mode)
  const hasDocument = assessment?.intakeMode === 'UPLOAD';

  // Map shared enum status to local badge status
  const badgeStatus: BadgeStatus = (() => {
    const s = assessment?.status ?? 'DRAFT';
    const map: Record<string, BadgeStatus> = {
      DRAFT: 'draft',
      ANALYZING: 'analyzing',
      ACTION_REQUIRED: 'action_required',
      COMPLETE: 'complete',
    };
    return map[s] ?? 'draft';
  })();

  return (
    <div className="flex flex-col h-full">
      {/* Breadcrumb */}
      <div className="px-6 pt-4 pb-2">
        <BreadcrumbTrail
          items={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: assessment?.name ?? 'Assessment', href: '#' },
            { label: 'Gap Detector' },
          ]}
        />
      </div>

      {/* Sub-header */}
      {assessment && (
        <AssessmentSubHeader
          businessName={assessment.companyName}
          businessType={assessment.intakeMode}
          date={assessment.updatedAt}
          status={badgeStatus}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <GapLayout
            hasDocument={hasDocument}
            summaryBar={
              <GapSummaryBar total={total} verified={verified} missing={missing} />
            }
            leftPanel={
              <div className="space-y-3">
                {groups.map(({ category, fields }) => (
                  <GapCategoryGroup
                    key={category}
                    category={category}
                    fields={fields.map((f) => ({
                      id: f.id,
                      label: f.label,
                      currentValue: f.correctedValue ?? f.extractedValue,
                      status: f.status as GapFieldStatus,
                      isMandatory: f.isMandatory,
                      onUpdate: handleUpdateField,
                    }))}
                  />
                ))}

                {fields.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin mb-3" />
                    <p className="text-sm font-medium">Analyzing document...</p>
                    <p className="text-xs mt-1">Gap fields will appear here once extraction completes.</p>
                  </div>
                )}

                {/* Submit button */}
                {fields.length > 0 && (
                  <div className="pt-4 border-t border-border">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="block w-full">
                            <Button
                              className="w-full"
                              disabled={!allMandatoryComplete}
                              onClick={handleSubmitAll}
                            >
                              {!allMandatoryComplete && (
                                <AlertTriangle className="mr-2 h-4 w-4" />
                              )}
                              Submit &amp; Run Risk Analysis
                            </Button>
                          </span>
                        </TooltipTrigger>
                        {!allMandatoryComplete && (
                          <TooltipContent>
                            <p>Fill all mandatory (*) fields to submit.</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                )}
              </div>
            }
            rightPanel={<PdfViewer presignedUrl={null} />}
          />
        )}
      </div>
    </div>
  );
}
