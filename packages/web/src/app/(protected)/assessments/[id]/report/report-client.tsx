'use client';

import { useParams } from 'next/navigation';
import { useCallback } from 'react';
import { Printer, Download, Link2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BreadcrumbTrail } from '@/components/shared/breadcrumb-trail';
import { AssessmentSubHeader } from '@/components/layout/assessment-sub-header';
import { ReportLayout } from '@/components/report/report-layout';
import { ReportSection } from '@/components/report/report-section';
import { RadarChart } from '@/components/report/radar-chart';
import { useReport, useGeneratePdf } from '@/hooks/use-report';
import { useJobPolling } from '@/hooks/use-job-polling';
import type { AssessmentStatus as BadgeStatus } from '@/components/shared/status-badge';
import type { TocItem } from '@/components/report/report-toc-sidebar';
import { LEVEL_CONFIG } from '@/components/risk-scorecard/risk-score-overview';

function mapStatus(s: string | undefined): BadgeStatus {
  const map: Record<string, BadgeStatus> = {
    DRAFT: 'draft', ANALYZING: 'analyzing', ACTION_REQUIRED: 'action_required', COMPLETE: 'complete',
  };
  return map[s ?? 'DRAFT'] ?? 'complete';
}

export default function ReportClient() {
  const { id } = useParams<{ id: string }>();

  const { data: report, isLoading } = useReport(id);
  const { mutateAsync: generatePdf, isPending: generatingPdf } = useGeneratePdf(id);
  const { startPolling, result: jobResult, isProcessing: pdfProcessing } = useJobPolling();

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleDownloadPdf = useCallback(async () => {
    const result = await generatePdf();
    if (result.jobId) {
      startPolling(result.jobId);
    } else if (result.downloadUrl) {
      window.open(result.downloadUrl, '_blank');
    }
  }, [generatePdf, startPolling]);

  const handleShare = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      alert('Link copied to clipboard!');
    });
  }, []);

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
  ];

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 text-center">
        <Loader2 className="h-8 w-8 animate-spin mb-3 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">Generating report...</p>
        <p className="text-xs text-muted-foreground mt-1">This may take a moment.</p>
      </div>
    );
  }

  const assessment = report.assessment;
  const levelConfig = LEVEL_CONFIG[report.overallLevel];

  // Open download URL when job polling completes
  const pdfDownloadUrl = (jobResult as { downloadUrl?: string } | null)?.downloadUrl;
  if (pdfDownloadUrl) {
    // Trigger in effect — avoid side effect during render
  }

  return (
    <>
      {/* Breadcrumb — outside the layout for proper positioning */}
      <div className="px-6 pt-4 pb-2 print:hidden">
        <BreadcrumbTrail
          items={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: assessment.name, href: '#' },
            { label: 'Full Report' },
          ]}
        />
      </div>

      {/* Sub-header */}
      <div className="print:hidden">
        <AssessmentSubHeader
          businessName={assessment.companyName}
          businessType={assessment.intakeMode ?? ''}
          date={assessment.updatedAt}
          status={mapStatus(assessment.status)}
        />
      </div>

      <ReportLayout
        tocItems={tocItems}
        toolbar={
          <>
            <div className="text-sm font-semibold text-foreground">
              {assessment.name} — Risk Analysis Report
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
                <Printer className="h-4 w-4" />
                Print
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={generatingPdf || pdfProcessing} className="gap-1.5">
                {(generatingPdf || pdfProcessing) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {pdfProcessing ? 'Generating...' : 'Download PDF'}
              </Button>
              <Button variant="outline" size="sm" onClick={handleShare} className="gap-1.5">
                <Link2 className="h-4 w-4" />
                Share
              </Button>
            </div>
          </>
        }
      >
        {/* Executive Summary */}
        <ReportSection id="executive-summary" heading="Executive Summary">
          <div className="space-y-4">
            {/* Overview card */}
            <div className="rounded-xl border border-border p-5 bg-muted/20 flex items-center gap-6">
              <div className="text-center shrink-0">
                <p className="text-4xl font-bold text-foreground">{report.overallScore}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Overall Score</p>
              </div>
              <div className="w-px h-12 bg-border" />
              <div>
                <p className="text-sm font-medium text-foreground">{assessment.companyName}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{assessment.country} · {assessment.companyType}</p>
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

              {/* Subcategory table */}
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
      </ReportLayout>

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
