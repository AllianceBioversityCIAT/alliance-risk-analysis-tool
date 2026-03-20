'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Printer, Download, Link2, Loader2, BarChart3 } from 'lucide-react';
import { sileo } from 'sileo';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AssessmentPageShell } from '@/components/shared/assessment-page-shell';
import { ReportLayout } from '@/components/report/report-layout';
import { ReportSection } from '@/components/report/report-section';
import { RadarChart } from '@/components/report/radar-chart';
import { SubcategoryBarChart } from '@/components/report/subcategory-bar-chart';
import { FinancialRevenueChart } from '@/components/report/financial-revenue-chart';
import { FinancialCostChart } from '@/components/report/financial-cost-chart';
import { ReportConfigurationDialog } from '@/components/risk-scorecard/report-configuration-dialog';
import { useReport, useGeneratePdf } from '@/hooks/use-report';
import { useAssessment } from '@/hooks/use-assessments';
import { useJobPolling } from '@/hooks/use-job-polling';
import { JobStatus } from '@alliance-risk/shared';
import type { ReportConfig } from '@alliance-risk/shared';
import type { TocItem } from '@/components/report/report-toc-sidebar';
import { LEVEL_CONFIG } from '@/components/risk-scorecard/risk-score-overview';

export default function ReportClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get('id');
  const [configDialogOpen, setConfigDialogOpen] = useState(false);

  useEffect(() => {
    if (!id) {
      router.replace('/dashboard');
    }
  }, [id, router]);

  const { data: report, isLoading } = useReport(id ?? '');
  const { mutateAsync: generatePdf, isPending: generatingPdf } = useGeneratePdf(id ?? '');
  const {
    startPolling,
    result: jobResult,
    status: jobStatus,
    error: jobError,
    isProcessing: pdfProcessing,
    reset: resetJob,
  } = useJobPolling();
  const { data: assessment } = useAssessment(id ?? '');

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleGenerateWithConfig = useCallback(async (config: ReportConfig) => {
    if (!id) return;
    setConfigDialogOpen(false);
    try {
      const response = await generatePdf(config);
      if (response.jobId) {
        startPolling(response.jobId);
        sileo.info({ title: 'PDF generation started', description: 'This typically takes 30-60 seconds.' });
      } else if (response.downloadUrl) {
        window.open(response.downloadUrl, '_blank');
      }
    } catch {
      sileo.error({ title: 'Failed to start PDF generation' });
    }
  }, [id, generatePdf, startPolling]);

  const handleShare = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      sileo.success({ title: 'Link copied to clipboard!' });
    });
  }, []);

  // Handle job completion/failure
  const pdfDownloadUrl = (jobResult as { downloadUrl?: string } | null)?.downloadUrl;
  useEffect(() => {
    if (jobStatus === JobStatus.COMPLETED && pdfDownloadUrl) {
      sileo.success({ title: 'PDF ready', description: 'Your download should start automatically.' });
      window.open(pdfDownloadUrl, '_blank');
      resetJob();
    } else if (jobStatus === JobStatus.FAILED) {
      sileo.error({ title: 'PDF generation failed', description: jobError ?? 'Please try again.' });
      resetJob();
    }
  }, [jobStatus, pdfDownloadUrl, jobError, resetJob]);

  if (!id) return null;

  // Use assessment from report when available, fallback to separate query
  const reportAssessment = report?.assessment ?? assessment;
  const isPdfBusy = generatingPdf || pdfProcessing;

  const breadcrumbs = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Risk Scorecard', href: `/assessments/risk-scorecard?id=${id}` },
    { label: 'Full Report' },
  ];

  if (isLoading) {
    return (
      <AssessmentPageShell
        breadcrumbs={breadcrumbs}
        assessment={reportAssessment}
        title="Full Report"
        description="Comprehensive risk assessment report with executive summary and recommendations."
        printHidden
      >
        <div className="max-w-4xl mx-auto w-full p-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </AssessmentPageShell>
    );
  }

  if (!report) {
    return (
      <AssessmentPageShell
        breadcrumbs={breadcrumbs}
        assessment={reportAssessment}
        title="Full Report"
        description="Comprehensive risk assessment report with executive summary and recommendations."
        printHidden
      >
        <div className="flex flex-col items-center justify-center py-32 text-center max-w-4xl mx-auto">
          <Loader2 className="h-8 w-8 animate-spin mb-3 text-muted-foreground" />
          <p className="text-base font-bold text-foreground tracking-tight">Generating report...</p>
          <p className="text-sm text-muted-foreground mt-1">This may take a moment.</p>
        </div>
      </AssessmentPageShell>
    );
  }

  const fullAssessment = report.assessment;
  const levelConfig = LEVEL_CONFIG[report.overallLevel];

  // Build TOC items
  const tocItems: TocItem[] = [
    { id: 'executive-summary', label: 'Executive Summary' },
    { id: 'risk-overview', label: 'Risk Overview' },
    ...(report?.categories ?? []).map((cat) => ({
      id: `category-${cat.category.toLowerCase().replace(/\s+/g, '-')}`,
      label: cat.category,
      subItems: cat.subcategories.map((sub) => ({
        id: `sub-${sub.name.toLowerCase().replace(/\s+/g, '-')}`,
        label: sub.name,
      })),
    })),
    ...(report?.financialMetrics
      ? [{ id: 'financial-overview', label: 'Financial Overview' }]
      : []),
  ];

  const actionButtons = (
    <>
      <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5 shadow-sm">
        <Printer className="h-4 w-4" />
        Print
      </Button>
      <Button
        size="sm"
        onClick={() => setConfigDialogOpen(true)}
        disabled={isPdfBusy}
        className="gap-1.5 shadow-sm"
      >
        {isPdfBusy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Download className="h-4 w-4" />
            Download PDF
          </>
        )}
      </Button>
      <Button variant="outline" size="sm" onClick={handleShare} className="gap-1.5 shadow-sm">
        <Link2 className="h-4 w-4" />
        Share
      </Button>
    </>
  );

  return (
    <>
      <AssessmentPageShell
        breadcrumbs={breadcrumbs}
        assessment={reportAssessment}
        title="Full Report"
        description="Comprehensive risk assessment report with executive summary and recommendations."
        actions={actionButtons}
        printHidden
        scrollable={false} // Disable inner scrolling so ReportLayout handles it
      >
        <ReportLayout tocItems={tocItems}>
          {/* Executive Summary */}
          <ReportSection id="executive-summary" heading="Executive Summary">
            <div className="space-y-4">
              {/* Overview card */}
              <div className="rounded-xl border border-border p-5 bg-muted/20 flex items-center gap-6">
                <div className="text-center shrink-0">
                  <p className="text-4xl font-bold text-foreground tracking-tight">{report.overallScore}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Overall Score</p>
                </div>
                <div className="w-px h-12 bg-border" />
                <div>
                  <p className="text-sm font-medium text-foreground">{fullAssessment.companyName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{fullAssessment.country} · {fullAssessment.companyType}</p>
                  <span className={`inline-block mt-2 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${levelConfig.color} ${levelConfig.bg}`}>
                    {levelConfig.label}
                  </span>
                </div>
              </div>

              <p className="text-sm text-foreground leading-relaxed">{report.executiveSummary}</p>
            </div>
          </ReportSection>

          {/* Risk Overview (Radar Chart) */}
          <ReportSection id="risk-overview" heading="Risk Overview">
            <div className="flex flex-col lg:flex-row items-start gap-8">
              <RadarChart data={report.radarData} />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-4">
                  The radar chart shows relative risk exposure across all 7 categories. Higher scores indicate greater risk.
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {report.categories.map((cat) => {
                    const catConfig = LEVEL_CONFIG[cat.level];
                    return (
                      <div key={cat.id} className="flex items-center justify-between gap-2">
                        <span className="text-sm text-foreground">{cat.category}</span>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                            <div className={`h-full rounded-full ${catConfig.barColor}`} style={{ width: `${cat.score}%` }} />
                          </div>
                          <span className="text-sm font-bold text-foreground w-8 text-right">{cat.score}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </ReportSection>

          {/* Category sections */}
          {report.categories.map((cat) => {
            const sectionId = `category-${cat.category.toLowerCase().replace(/\s+/g, '-')}`;
            return (
              <ReportSection
                key={cat.id}
                id={sectionId}
                heading={cat.category}
                score={cat.score}
                level={cat.level}
              >
                {cat.narrative && (
                  <p className="text-sm text-foreground leading-relaxed mb-4">{cat.narrative}</p>
                )}

                {/* Subcategory chart — always visible in web preview */}
                {cat.subcategories.length > 0 && (
                  <div className="mb-5 rounded-xl border border-border/60 bg-muted/10 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Subcategory Scores
                      </p>
                    </div>
                    <SubcategoryBarChart subcategories={cat.subcategories} />
                  </div>
                )}

                {/* Subcategory detail table */}
                {cat.subcategories.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead>
                        <tr className="border-b border-border">
                          {['Subcategory', 'Score', 'Indicator', 'Evidence', 'Mitigation'].map((h) => (
                            <th key={h} className="pb-2 pr-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {cat.subcategories.map((sub, i) => {
                          const subConfig = LEVEL_CONFIG[sub.level];
                          return (
                            <tr key={i} className="border-b border-border/40" id={`sub-${sub.name.toLowerCase().replace(/\s+/g, '-')}`}>
                              <td className="py-2 pr-4 font-medium">{sub.name}</td>
                              <td className="py-2 pr-4">
                                <span className={`text-xs px-2 py-0.5 rounded-full border ${subConfig.color} ${subConfig.bg}`}>
                                  {sub.score}
                                </span>
                              </td>
                              <td className="py-2 pr-4 text-muted-foreground max-w-[160px] truncate">{sub.indicator}</td>
                              <td className="py-2 pr-4 text-muted-foreground">{sub.evidence ?? '—'}</td>
                              <td className="py-2 text-muted-foreground">{sub.mitigation ?? '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Recommendations */}
                {cat.recommendations.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Recommendations</p>
                    <ul className="space-y-1">
                      {cat.recommendations.map((rec) => (
                        <li key={rec.id} className="flex items-start gap-2 text-sm text-foreground">
                          <span className="text-yellow-500 mt-0.5">•</span>
                          {rec.isEdited ? rec.editedText : rec.text}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </ReportSection>
            );
          })}

          {/* Financial Overview — when data exists */}
          {report.financialMetrics && (
            <ReportSection id="financial-overview" heading="Financial Overview">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {report.financialMetrics.revenue.length > 0 && (
                  <FinancialRevenueChart data={report.financialMetrics.revenue} />
                )}
                {report.financialMetrics.costs.length > 0 && (
                  <FinancialCostChart
                    data={report.financialMetrics.costs}
                    margins={report.financialMetrics.margins}
                  />
                )}
              </div>
            </ReportSection>
          )}
        </ReportLayout>
      </AssessmentPageShell>

      {/* PDF Configuration Dialog */}
      <ReportConfigurationDialog
        open={configDialogOpen}
        onOpenChange={setConfigDialogOpen}
        onGenerate={handleGenerateWithConfig}
        isGenerating={isPdfBusy}
      />

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          .print\\:hidden { display: none !important; }
          nav, aside { display: none !important; }
          body { background: white; }
        }
      `}</style>
    </>
  );
}
