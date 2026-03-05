'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useCallback, useState, useRef } from 'react';
import {
  Loader2,
  FileText,
  BarChart3,
  Pencil,
  Save,
  Check,
  X,
} from 'lucide-react';
import { sileo } from 'sileo';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { BreadcrumbTrail } from '@/components/shared/breadcrumb-trail';
import { SidebarTrigger } from '@/components/ui/sidebar';
import dynamic from 'next/dynamic';
import { GapLayout } from '@/components/gap-detector/gap-layout';
import { GapCategoryGroup } from '@/components/gap-detector/gap-field-card';

const DocumentViewer = dynamic(
  () =>
    import('@/components/gap-detector/document-viewer').then(
      (mod) => mod.DocumentViewer,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    ),
  },
);
import { useGapFields, useUpdateGapFields } from '@/hooks/use-gap-detection';
import { useAssessment, useUpdateAssessment } from '@/hooks/use-assessments';
import { useMergedContent } from '@/hooks/use-merged-content';
import { GapFieldStatus } from '@alliance-risk/shared';
import type { GapFieldResponse } from '@alliance-risk/shared';
import { Skeleton } from '@/components/ui/skeleton';
import apiClient from '@/lib/api-client';

// Group gap fields by category preserving insertion order
function groupByCategory(fields: GapFieldResponse[]) {
  const map = new Map<string, GapFieldResponse[]>();
  for (const field of fields) {
    if (!map.has(field.category)) map.set(field.category, []);
    map.get(field.category)!.push(field);
  }
  return Array.from(map.entries()).map(([category, catFields]) => ({
    category,
    fields: catFields,
  }));
}

export default function GapDetectorClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get('id');

  useEffect(() => {
    if (!id) router.replace('/dashboard');
  }, [id, router]);

  const { data: assessment, isLoading: assessmentLoading } = useAssessment(id ?? '');
  const { data: gapData, isLoading: gapLoading } = useGapFields(id ?? '');
  const { mutateAsync: updateFields } = useUpdateGapFields(id ?? '');
  const { data: mergedContentData } = useMergedContent(id);
  const { mutateAsync: updateAssessment, isPending: isSavingDraft } = useUpdateAssessment();

  const handleUpdateField = useCallback(
    async (fieldId: string, value: string) => {
      await updateFields([{ id: fieldId, correctedValue: value }]);
    },
    [updateFields],
  );

  const handleSaveDraft = useCallback(async () => {
    if (!id) return;
    try {
      await updateAssessment({ id, data: { status: 'DRAFT' as never } });
      sileo.success({ title: 'Draft saved' });
    } catch (err) {
      sileo.error({
        title: 'Failed to save draft',
        description: err instanceof Error ? err.message : 'Please try again.',
      });
    }
  }, [id, updateAssessment]);

  const handleAnalyzeRisks = useCallback(async () => {
    if (!id) return;
    try {
      await apiClient.post(`/api/assessments/${id}/trigger-risk-analysis`);
      router.push(`/assessments/risk-scorecard?id=${id}`);
    } catch (err) {
      sileo.error({
        title: 'Failed to start risk analysis',
        description: err instanceof Error ? err.message : 'Please try again.',
      });
    }
  }, [id, router]);

  // ─── PDF highlight on field click ───────────────────────────────────────────
  const [highlightKeyword, setHighlightKeyword] = useState<string | null>(null);

  const handleFieldFocus = useCallback((value: string | null) => {
    setHighlightKeyword(value);
  }, []);

  // ─── Inline name editing ──────────────────────────────────────────────────────
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  const startEditingName = useCallback(() => {
    setEditName(assessment?.name ?? '');
    setIsEditingName(true);
    setTimeout(() => nameInputRef.current?.focus(), 0);
  }, [assessment?.name]);

  const cancelEditingName = useCallback(() => {
    setIsEditingName(false);
    setEditName('');
  }, []);

  const saveNameEdit = useCallback(async () => {
    if (!id || !editName.trim() || editName.trim() === assessment?.name) {
      cancelEditingName();
      return;
    }
    try {
      await updateAssessment({ id, data: { name: editName.trim() } });
      sileo.success({ title: 'Name updated' });
    } catch (err) {
      sileo.error({
        title: 'Failed to update name',
        description: err instanceof Error ? err.message : 'Please try again.',
      });
    }
    setIsEditingName(false);
  }, [id, editName, assessment?.name, updateAssessment, cancelEditingName]);

  if (!id) return null;

  // ─── Derived state ────────────────────────────────────────────────────────────
  const isLoading = assessmentLoading || gapLoading;
  const fields = gapData?.data ?? [];
  const total = gapData?.total ?? 0;
  const verified = gapData?.verifiedCount ?? 0;
  const allMandatoryComplete = gapData?.allMandatoryComplete ?? false;
  const groups = groupByCategory(fields);

  const hasDocument = assessment?.intakeMode === 'UPLOAD';
  const mergedMarkdown = mergedContentData?.mergedMarkdown ?? null;
  // Keep documentName for the document info bar
  const documentName = mergedMarkdown ? 'Uploaded Documents' : null;

  // Data completeness
  const completeness = total > 0 ? Math.round((verified / total) * 100) : 0;
  const requiredRemaining = total - verified;

  return (
    <div className="flex flex-col h-full">
      {/* ─── Breadcrumb ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <SidebarTrigger className="shrink-0" />
        <BreadcrumbTrail
          items={[
            { label: 'Dashboard', href: '/dashboard' },
            {
              label: hasDocument ? 'Upload Business Plan' : (assessment?.name ?? 'Assessment'),
            },
            { label: 'Gap Detector' },
          ]}
        />
      </div>

      {/* ─── Teal Sub-Header ─────────────────────────────────────────────────────── */}
      {assessment && (
        <div className="px-6 py-5 text-white" style={{ backgroundColor: '#1A3C40' }}>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            
            {/* Left Column: Assessment info & Document bar */}
            <div className="flex flex-col gap-4 min-w-0 flex-1">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {isEditingName ? (
                    <>
                      <input
                        ref={nameInputRef}
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveNameEdit();
                          if (e.key === 'Escape') cancelEditingName();
                        }}
                        className="text-base font-semibold text-white bg-white/15 border border-white/30 rounded px-2 py-0.5 outline-none focus:border-white/60 min-w-[200px]"
                        aria-label="Edit assessment name"
                      />
                      <button
                        onClick={saveNameEdit}
                        className="shrink-0 p-1 rounded hover:bg-white/20 transition-colors"
                        aria-label="Save name"
                      >
                        <Check className="h-3.5 w-3.5 text-emerald-300" />
                      </button>
                      <button
                        onClick={cancelEditingName}
                        className="shrink-0 p-1 rounded hover:bg-white/20 transition-colors"
                        aria-label="Cancel editing"
                      >
                        <X className="h-3.5 w-3.5 text-white/60" />
                      </button>
                    </>
                  ) : (
                    <>
                      <h1 className="text-xl font-bold text-white truncate">
                        {assessment.name}
                      </h1>
                      <button
                        onClick={startEditingName}
                        className="shrink-0 p-1 rounded hover:bg-white/20 transition-colors"
                        aria-label="Edit assessment name"
                      >
                        <Pencil className="h-3.5 w-3.5 text-white/60 hover:text-white/80" />
                      </button>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-white/70">
                  <span className="font-mono">ID: {assessment.id.substring(0, 12).toUpperCase()}</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  <span>Gap Review In Progress</span>
                </div>
              </div>

              {/* Document info bar — compact, integrated into left column */}
              {hasDocument && documentName && (
                <div className="inline-flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5 border border-white/10 w-fit">
                  <FileText className="h-4 w-4 text-white/60 shrink-0" />
                  <span className="text-sm font-medium text-white truncate max-w-[220px]">
                    {documentName}
                  </span>
                  {assessment.companyName && (
                    <>
                      <span className="h-3 w-px bg-white/20 mx-1" />
                      <span className="text-xs text-white/60">{assessment.companyName}</span>
                    </>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white/10 text-white border-white/20 hover:bg-white/20 hover:text-white text-xs h-7 px-3 shrink-0 ml-2"
                    onClick={() => router.push(`/assessments/upload?id=${id}`)}
                  >
                    Change Document
                  </Button>
                </div>
              )}
            </div>

            {/* Right Column: Actions & Progress */}
            <div className="flex flex-col items-end gap-5 shrink-0 min-w-[240px]">
              <Button
                variant="outline"
                size="sm"
                className="bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white shrink-0 shadow-sm"
                onClick={handleSaveDraft}
                disabled={isSavingDraft}
              >
                <Save className="h-3.5 w-3.5 mr-1.5" />
                {isSavingDraft ? 'Saving...' : 'Save Draft'}
              </Button>

              {/* Data Completeness Widget */}
              <div className="w-full bg-white/5 rounded-xl p-3.5 border border-white/10 shadow-sm">
                <div className="flex items-end justify-between gap-4 mb-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
                    Data Completeness
                  </p>
                  <p className="text-2xl font-bold text-white leading-none">{completeness}%</p>
                </div>
                <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                    style={{ width: `${completeness}%` }}
                  />
                </div>
                {requiredRemaining > 0 ? (
                  <p className="text-[10px] text-white/60 mt-2 text-right">
                    <span className="text-white font-medium">{requiredRemaining}</span> required field{requiredRemaining !== 1 ? 's' : ''} remaining
                  </p>
                ) : (
                  <p className="text-[10px] text-emerald-400 mt-2 text-right font-medium">
                    All required fields complete
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Main Content (Split Pane) ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <GapLayout
            hasDocument={hasDocument && !!mergedMarkdown}
            documentPanel={
              <DocumentViewer
                markdownContent={mergedMarkdown}
                highlightKeyword={highlightKeyword}
              />
            }
            fieldsPanel={
              <div className="p-5">
                {/* Panel heading */}
                <div className="mb-5">
                  <h2 className="text-xl font-bold text-foreground">Gap Detector</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Please review detected gaps and complete missing information.
                  </p>
                </div>

                {/* Category groups */}
                <div className="space-y-4">
                  {groups.map(({ category, fields: catFields }) => (
                    <GapCategoryGroup
                      key={category}
                      category={category}
                      fields={catFields.map((f) => ({
                        id: f.id,
                        label: f.label,
                        currentValue: f.correctedValue ?? f.extractedValue,
                        extractedValue: f.extractedValue,
                        status: f.status as GapFieldStatus,
                        isMandatory: f.isMandatory,
                        confidence: f.confidence,
                        aiReasoning: f.aiReasoning,
                        onUpdate: handleUpdateField,
                        onFieldFocus: handleFieldFocus,
                      }))}
                    />
                  ))}
                </div>

                {/* Empty state — polling for gap detection results */}
                {fields.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin mb-3" />
                    <p className="text-sm font-medium">Analyzing document...</p>
                    <p className="text-xs mt-1">
                      Gap fields will appear here once extraction completes.
                    </p>
                  </div>
                )}

                {/* Analyze Risks button */}
                {fields.length > 0 && (
                  <div className="mt-6 pt-4">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="block w-full">
                            <Button
                              className="w-full h-11"
                              disabled={!allMandatoryComplete}
                              onClick={handleAnalyzeRisks}
                            >
                              <BarChart3 className="mr-2 h-4 w-4" />
                              Analyze Risks
                            </Button>
                          </span>
                        </TooltipTrigger>
                        {!allMandatoryComplete && (
                          <TooltipContent>
                            <p>Fill all mandatory fields to continue.</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                )}
              </div>
            }
          />
        )}
      </div>
    </div>
  );
}
