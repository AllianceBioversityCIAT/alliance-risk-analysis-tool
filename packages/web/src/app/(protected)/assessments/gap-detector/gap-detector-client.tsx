'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useCallback, useState, useRef, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Loader2,
  FileText,
  FileSpreadsheet,
  File,
  BarChart3,
  Pencil,
  Save,
  Check,
  X,
  CheckCircle2,
  Circle,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  Upload,
  Brain,
} from 'lucide-react';
import { sileo } from 'sileo';
import { Button } from '@/components/ui/button';
import { PipelineStepper } from '@/components/shared/pipeline-stepper';
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
import { useGapFields, useUpdateGapFields, useReAnalyzeGaps } from '@/hooks/use-gap-detection';
import { useJobPolling } from '@/hooks/use-job-polling';
import { useAssessment, useUpdateAssessment } from '@/hooks/use-assessments';
import { useMergedContent } from '@/hooks/use-merged-content';
import { useMultiDocumentStatus } from '@/hooks/use-multi-document-status';
import { AssessmentStatus, GapFieldStatus, JobStatus } from '@alliance-risk/shared';
import type { GapFieldResponse, InvalidField } from '@alliance-risk/shared';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import apiClient from '@/lib/api-client';
import { AxiosError } from 'axios';

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

// File icon by MIME type
function FileIcon({ mimeType, className }: { mimeType: string; className?: string }) {
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) {
    return <FileSpreadsheet className={className} />;
  }
  if (mimeType.includes('pdf')) {
    return <FileText className={className} />;
  }
  if (mimeType.includes('word') || mimeType.includes('document')) {
    return <FileText className={className} />;
  }
  return <File className={className} />;
}

// ─── Gap Analysis Steps ─────────────────────────────────────────────────────

const GAP_PIPELINE_STEPS: import('@/components/shared/pipeline-stepper').PipelineStep[] = [
  { label: 'Documents Uploaded', description: 'Files received and queued', icon: <Upload className="h-4 w-4" /> },
  { label: 'Text Extraction', description: 'Parsing content from all documents', icon: <FileText className="h-4 w-4" /> },
  { label: 'AI Gap Analysis', description: 'Identifying business data fields', icon: <Brain className="h-4 w-4" /> },
  { label: 'Fields Ready', description: 'Gap fields available for review', icon: <Check className="h-4 w-4" /> },
];

function getGapActiveStep(
  docsProcessing: boolean,
  documents: Array<{ status: string }>,
): number {
  const allParsed = documents.length > 0 && documents.every((d) => d.status === 'PARSED');
  if (documents.length === 0) return 0;
  if (docsProcessing) return 1;
  if (allParsed) return 2;
  return 1;
}

export default function GapDetectorClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = searchParams.get('id');

  useEffect(() => {
    if (!id) router.replace('/dashboard');
  }, [id, router]);

  const { data: assessment, isLoading: assessmentLoading } = useAssessment(id ?? '');
  const { data: gapData, isLoading: gapLoading } = useGapFields(id ?? '');
  const { mutateAsync: updateFields } = useUpdateGapFields(id ?? '');
  const { data: mergedContentData } = useMergedContent(id);
  const { mutateAsync: updateAssessment, isPending: isSavingDraft } = useUpdateAssessment();

  // Multi-document status — always poll when we have an upload-mode assessment
  const hasDocument = assessment?.intakeMode === 'UPLOAD';
  const {
    documents,
    allParsed,
    isProcessing: docsProcessing,
  } = useMultiDocumentStatus(id, hasDocument ?? false);

  // ─── Re-analyze on save ──────────────────────────────────────────────────────
  const { mutateAsync: reAnalyze } = useReAnalyzeGaps(id ?? '');
  const { startPolling, isProcessing: isReAnalyzing, status: jobStatus } = useJobPolling();
  const reAnalyzeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (reAnalyzeTimerRef.current) clearTimeout(reAnalyzeTimerRef.current);
    };
  }, []);

  // When re-analysis job completes, show toast
  useEffect(() => {
    if (jobStatus === JobStatus.COMPLETED) {
      sileo.success({ title: 'Re-analysis complete', description: 'Gap fields updated with new insights.' });
    } else if (jobStatus === JobStatus.FAILED) {
      sileo.error({ title: 'Re-analysis failed', description: 'Please try again.' });
    }
  }, [jobStatus]);

  const handleUpdateField = useCallback(
    async (fieldId: string, value: string, currentStatus?: GapFieldStatus) => {
      await updateFields([{ id: fieldId, correctedValue: value }]);

      // PARTIAL fields just need verification — no AI re-analysis needed
      if (currentStatus === GapFieldStatus.PARTIAL) return;

      // Debounce re-analysis: wait 2s after last save
      if (reAnalyzeTimerRef.current) clearTimeout(reAnalyzeTimerRef.current);
      reAnalyzeTimerRef.current = setTimeout(async () => {
        try {
          const { jobId } = await reAnalyze();
          startPolling(jobId);
        } catch {
          // Silent — re-analysis is best-effort
        }
      }, 2000);
    },
    [updateFields, reAnalyze, startPolling],
  );

  const handleSaveDraft = useCallback(async () => {
    if (!id) return;
    try {
      await updateAssessment({ id, data: { status: AssessmentStatus.DRAFT } });
      sileo.success({ title: 'Draft saved' });
    } catch (err) {
      sileo.error({
        title: 'Failed to save draft',
        description: err instanceof Error ? err.message : 'Please try again.',
      });
    }
  }, [id, updateAssessment]);

  const [isValidating, setIsValidating] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'attention' | 'verified'>('all');
  const [showValidationBanner, setShowValidationBanner] = useState(false);

  const handleAnalyzeRisks = useCallback(async () => {
    if (!id) return;
    setIsValidating(true);
    try {
      await apiClient.post(`/api/assessments/${id}/gap-fields/submit`);
      router.push(`/assessments/risk-scorecard?id=${id}`);
    } catch (err) {
      // Handle validation failure — fields rejected by AI
      const errData = err instanceof AxiosError ? err.response?.data : undefined;
      if (err instanceof AxiosError && err.response?.status === 400 && errData && typeof errData === 'object' && Array.isArray(errData.invalidFields)) {
        const invalidFields = errData.invalidFields as InvalidField[];
        if (invalidFields.length > 0) {
          const count = invalidFields.length;
          sileo.warning({
            title: `${count} field${count !== 1 ? 's' : ''} need${count === 1 ? 's' : ''} more detail`,
            description: 'Please review the highlighted fields and provide meaningful information.',
          });
          setShowValidationBanner(true);
          setActiveFilter('attention');
        } else {
          // Validation service unavailable — invalidFields is empty
          sileo.error({
            title: 'Validation temporarily unavailable',
            description: 'Please try again in a moment.',
          });
        }
        // Refetch gap fields to get updated statuses and feedback from server
        queryClient.invalidateQueries({ queryKey: ['gap-fields', id] });
      } else {
        sileo.error({
          title: 'Failed to start risk analysis',
          description: err instanceof Error ? err.message : 'Please try again.',
        });
      }
    } finally {
      setIsValidating(false);
    }
  }, [id, router, queryClient]);

  // ─── PDF highlight on field click ───────────────────────────────────────────
  const [highlightKeyword, setHighlightKeyword] = useState<string | null>(null);

  const handleFieldFocus = useCallback((value: string | null) => {
    setHighlightKeyword(value);
  }, []);

  // ─── Inline name editing ──────────────────────────────────────────────────────
  const [isEditingName, setIsEditingName] = useState(false);
  const [headerCollapsed, setHeaderCollapsed] = useState(true);
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

  // ─── Derived state ────────────────────────────────────────────────────────────
  const isLoading = assessmentLoading || gapLoading;
  const fields = useMemo(() => gapData?.data ?? [], [gapData?.data]);
  const total = gapData?.total ?? 0;
  const verified = gapData?.verifiedCount ?? 0;
  const allMandatoryComplete = gapData?.allMandatoryComplete ?? false;

  const mergedMarkdown = mergedContentData?.mergedMarkdown ?? null;

  // Filter counts
  const needsAttentionCount = fields.filter(
    (f) => f.status === GapFieldStatus.MISSING || f.status === GapFieldStatus.PARTIAL,
  ).length;
  const verifiedCount = verified;

  // Auto-clear banner when no issues remain
  const hasPendingIssues = needsAttentionCount > 0;
  useEffect(() => {
    if (!hasPendingIssues && showValidationBanner) {
      setShowValidationBanner(false);
      setActiveFilter('all');
    }
  }, [hasPendingIssues, showValidationBanner]);

  // Apply filter to fields before grouping (memoized to avoid re-renders)
  const filteredFields = useMemo(
    () => activeFilter === 'all'
      ? fields
      : activeFilter === 'attention'
        ? fields.filter((f) => f.status === GapFieldStatus.MISSING || f.status === GapFieldStatus.PARTIAL)
        : fields.filter((f) => f.status === GapFieldStatus.VERIFIED),
    [fields, activeFilter],
  );
  const groups = useMemo(() => groupByCategory(filteredFields), [filteredFields]);

  // Data completeness — only VERIFIED counts
  const completeness = total > 0 ? Math.round((verified / total) * 100) : 0;
  const requiredRemaining = total - verified;

  if (!id) return null;

  // Document count for header
  const docCount = documents.length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ─── Fixed Header Area ─────────────────────────────────────────────────── */}
      <div className="flex-none bg-background z-10 border-b pb-4">
        {/* ─── Breadcrumb ──────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-4 pt-3 pb-2">
          <SidebarTrigger className="shrink-0" />
          <BreadcrumbTrail
            items={[
              { label: 'Dashboard', href: '/dashboard' },
              {
                label: 'Manage Documents',
                href: `/assessments/upload?id=${id}`,
              },
              { label: 'Gap Detector' },
            ]}
          />
        </div>

        {/* ─── Teal Sub-Header (collapsible on small screens) ─────────────────────── */}
        {assessment && (
          <div className="text-white" style={{ backgroundColor: '#1A3C40' }}>
            {/* Collapsed summary bar — always visible, acts as toggle */}
            <button
              type="button"
              onClick={() => setHeaderCollapsed((prev) => !prev)}
              className="w-full flex items-center justify-between px-6 py-3 hover:bg-white/5 transition-colors"
              aria-expanded={!headerCollapsed}
              aria-label="Toggle project header"
            >
              <div className="flex items-center gap-3 min-w-0">
                <h1 className="text-sm font-bold text-white truncate">{assessment.name}</h1>
                <span className="text-[10px] text-white/50 font-mono shrink-0">
                  {assessment.id.substring(0, 8).toUpperCase()}
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-bold text-white">{completeness}%</span>
                <div className="h-1.5 w-16 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                    style={{ width: `${completeness}%` }}
                  />
                </div>
                <ChevronDown className={`h-4 w-4 text-white/60 transition-transform duration-200 ${headerCollapsed ? '' : 'rotate-180'}`} />
              </div>
            </button>

            {/* Full header content — always visible on md+, collapsible on small */}
            <div className={`px-6 py-5 ${headerCollapsed ? 'hidden' : 'block'}`}>
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

                  {/* Document info bar — shows document count + filenames */}
                  {hasDocument && docCount > 0 && (
                    <div className="inline-flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5 border border-white/10 w-fit max-w-full">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 text-white/60 shrink-0" />
                        <span className="text-sm font-medium text-white shrink-0">
                          {docCount} Document{docCount !== 1 ? 's' : ''}
                        </span>
                        <span className="h-3 w-px bg-white/20 mx-0.5" />
                        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                          {documents.slice(0, 3).map((doc) => (
                            <span
                              key={doc.id}
                              className="inline-flex items-center gap-1 text-xs text-white/70 truncate"
                              title={doc.fileName}
                            >
                              <FileIcon mimeType={doc.mimeType} className="h-3 w-3 shrink-0 text-white/50" />
                              <span className="truncate max-w-[140px]">{doc.fileName}</span>
                            </span>
                          ))}
                          {docCount > 3 && (
                            <span className="text-xs text-white/50 shrink-0">
                              +{docCount - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-white/10 text-white border-white/20 hover:bg-white/20 hover:text-white text-xs h-7 px-3 shrink-0 ml-2"
                        onClick={() => router.push(`/assessments/upload?id=${id}`)}
                      >
                        Manage Documents
                      </Button>
                    </div>
                  )}

                  {/* Fallback when no documents loaded yet */}
                  {hasDocument && docCount === 0 && (
                    <div className="inline-flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5 border border-white/10 w-fit">
                      <FileText className="h-4 w-4 text-white/60 shrink-0" />
                      <span className="text-sm font-medium text-white">Uploaded Documents</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-white/10 text-white border-white/20 hover:bg-white/20 hover:text-white text-xs h-7 px-3 shrink-0 ml-2"
                        onClick={() => router.push(`/assessments/upload?id=${id}`)}
                      >
                        Manage Documents
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
          </div>
        )}

        {/* ─── Page heading ─────────────────────────────────────────────────────────── */}
        <div className="px-6 pt-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Gap Detector</h1>
              <p className="text-sm text-muted-foreground mt-1.5">
                Please review detected gaps and complete missing information.
              </p>
              {isReAnalyzing && (
                <div className="flex items-center gap-2 mt-2 text-sm text-primary font-medium">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Re-analyzing with your corrections...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Main Content (Split Pane) ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {isLoading && (assessment?.status === AssessmentStatus.DRAFT || assessment?.status === AssessmentStatus.ANALYZING || !assessment) ? (
          /* ─── Analysis Loading State — only during actual processing ─────────── */
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="w-full max-w-md bg-card rounded-xl border border-border shadow-sm p-6">
              <div className="flex flex-col items-center text-center mb-5">
                <div className="relative mb-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
                <h3 className="text-base font-semibold text-foreground">
                  Analyzing your documents...
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Extracting text and detecting gaps
                </p>
              </div>

              {/* Per-document status list */}
              {documents.length > 0 && (
                <div className="space-y-2 mb-4">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-muted/50"
                    >
                      {doc.status === 'PARSED' ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      ) : doc.status === 'PARSING' ? (
                        <RefreshCw className="h-4 w-4 text-primary animate-spin shrink-0" />
                      ) : doc.status === 'FAILED' ? (
                        <X className="h-4 w-4 text-destructive shrink-0" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                      )}
                      <FileIcon mimeType={doc.mimeType} className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm text-foreground truncate flex-1">
                        {doc.fileName}
                      </span>
                      <span className={cn(
                        'text-[10px] font-medium shrink-0',
                        doc.status === 'PARSED' && 'text-emerald-600',
                        doc.status === 'PARSING' && 'text-primary',
                        doc.status === 'FAILED' && 'text-destructive',
                        doc.status === 'UPLOADED' && 'text-muted-foreground',
                      )}>
                        {doc.status === 'PARSED' ? 'Parsed' :
                         doc.status === 'PARSING' ? 'Parsing...' :
                         doc.status === 'FAILED' ? 'Failed' : 'Waiting'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Progress steps */}
              <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
                <span className={allParsed ? 'text-emerald-600' : docsProcessing ? 'text-primary font-medium' : ''}>
                  Extracting text
                </span>
                <span>{'>'}</span>
                <span className={allParsed && fields.length === 0 ? 'text-primary font-medium' : allParsed ? 'text-emerald-600' : ''}>
                  Detecting gaps
                </span>
                <span>{'>'}</span>
                <span className={fields.length > 0 ? 'text-emerald-600' : ''}>
                  Building fields
                </span>
              </div>
            </div>
          </div>
        ) : isLoading ? (
          /* ─── Simple skeleton — data is cached/loading for completed assessment ── */
          <div className="flex-1 p-6">
            <div className="space-y-4 max-w-2xl mx-auto">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-32 w-full rounded-lg" />
              <Skeleton className="h-32 w-full rounded-lg" />
              <Skeleton className="h-32 w-full rounded-lg" />
            </div>
          </div>
        ) : (
          <GapLayout
            hasDocument={hasDocument && !!mergedMarkdown}
            documentPanel={
              <DocumentViewer
                markdownContent={mergedMarkdown}
                highlightKeyword={highlightKeyword}
                documents={documents.map((d) => ({
                  id: d.id,
                  fileName: d.fileName,
                  mimeType: d.mimeType,
                }))}
              />
            }
            fieldsPanel={
              <div className="flex flex-col h-full bg-[#F8FAFC]">
                {/* Validation alert banner */}
                {showValidationBanner && needsAttentionCount > 0 && (
                  <div className="mx-5 mt-5 flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 shadow-sm">
                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-amber-900">
                        {needsAttentionCount} field{needsAttentionCount !== 1 ? 's' : ''} need{needsAttentionCount === 1 ? 's' : ''} more detail
                      </p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        Please review the highlighted fields and provide meaningful corrections before analyzing risks.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowValidationBanner(false)}
                      className="shrink-0 p-1 rounded hover:bg-amber-100 transition-colors"
                      aria-label="Dismiss"
                    >
                      <X className="h-4 w-4 text-amber-500" />
                    </button>
                  </div>
                )}

                {/* Sticky Action Bar */}
                {fields.length > 0 && (
                  <div className="sticky top-0 z-10 bg-[#F8FAFC]/95 backdrop-blur supports-[backdrop-filter]:bg-[#F8FAFC]/60 border-b border-border/50 px-5 py-4 mb-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      {/* Filter pill tabs */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveFilter('all')}
                          className={cn(
                            'px-3.5 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all shadow-sm ring-1',
                            activeFilter === 'all'
                              ? 'bg-foreground text-background ring-foreground/20'
                              : 'bg-card text-muted-foreground ring-border hover:bg-muted/80',
                          )}
                        >
                          All ({total})
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveFilter('attention')}
                          className={cn(
                            'px-3.5 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all shadow-sm ring-1',
                            activeFilter === 'attention'
                              ? 'bg-amber-500 text-white ring-amber-500/20'
                              : needsAttentionCount > 0
                                ? 'bg-amber-50 text-amber-800 ring-amber-200 hover:bg-amber-100'
                                : 'bg-card text-muted-foreground ring-border hover:bg-muted/80',
                          )}
                        >
                          Needs Attention ({needsAttentionCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveFilter('verified')}
                          className={cn(
                            'px-3.5 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all shadow-sm ring-1',
                            activeFilter === 'verified'
                              ? 'bg-emerald-500 text-white ring-emerald-500/20'
                              : 'bg-card text-muted-foreground ring-border hover:bg-muted/80',
                          )}
                        >
                          Verified ({verifiedCount})
                        </button>
                      </div>

                      {/* Analyze Risks button */}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button
                                className="shadow-sm"
                                disabled={!allMandatoryComplete || isReAnalyzing || isValidating}
                                onClick={handleAnalyzeRisks}
                              >
                                {isReAnalyzing ? (
                                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                ) : isValidating ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <BarChart3 className="mr-2 h-4 w-4" />
                                )}
                                {isReAnalyzing ? 'Re-analyzing...' : isValidating ? 'Validating fields...' : 'Analyze Risks'}
                              </Button>
                            </span>
                          </TooltipTrigger>
                          {!allMandatoryComplete && !isReAnalyzing && (
                            <TooltipContent>
                              <p>Fill all mandatory fields to continue.</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                )}

                <div className="px-5 pb-8">
                  {/* Category groups */}
                  <div className="space-y-4">
                    {groups.map(({ category, fields: catFields }) => (
                      <GapCategoryGroup
                        key={category}
                        category={category}
                        fields={catFields.map((f) => ({
                          id: f.id,
                          field: f.field,
                          label: f.label,
                          currentValue: f.correctedValue ?? f.extractedValue,
                          extractedValue: f.extractedValue,
                          status: f.status as GapFieldStatus,
                          isMandatory: f.isMandatory,
                          confidence: f.confidence,
                          aiReasoning: f.aiReasoning,
                          validationFeedback: f.validationFeedback,
                          onUpdate: handleUpdateField,
                          onFieldFocus: handleFieldFocus,
                        }))}
                      />
                    ))}
                  </div>

                  {/* Empty filter state */}
                  {fields.length > 0 && filteredFields.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-4" />
                      <p className="text-base font-bold text-foreground">
                        {activeFilter === 'attention' ? 'No fields need attention' : 'No verified fields yet'}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1.5">
                        {activeFilter === 'attention'
                          ? 'All fields are verified. You can proceed to analyze risks.'
                          : 'Complete the fields above to see them here.'}
                      </p>
                    </div>
                  )}

                  {/* Empty state — AI analysis in progress (pipeline stepper) */}
                  {fields.length === 0 && assessment?.status !== AssessmentStatus.ACTION_REQUIRED && assessment?.status !== AssessmentStatus.COMPLETE && (
                    <div className="mt-5">
                      <PipelineStepper
                        title="Gap Analysis in Progress"
                        subtitle="This typically takes 30–60 seconds"
                        steps={GAP_PIPELINE_STEPS}
                        activeStepIndex={getGapActiveStep(docsProcessing, documents)}
                        footer={documents.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-2">
                            {documents.map((doc) => (
                              <span
                                key={doc.id}
                                className={cn(
                                  'inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-md border shadow-sm',
                                  doc.status === 'PARSED'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : doc.status === 'PARSING'
                                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                                      : 'bg-card text-muted-foreground border-border',
                                )}
                              >
                                <FileIcon mimeType={doc.mimeType} className="h-3 w-3" />
                                {doc.fileName.length > 20 ? doc.fileName.substring(0, 17) + '...' : doc.fileName}
                              </span>
                            ))}
                          </div>
                        ) : undefined}
                      />
                    </div>
                  )}
                </div>
              </div>
            }
          />
        )}
      </div>
    </div>
  );
}
