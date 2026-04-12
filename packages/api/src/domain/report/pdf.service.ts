import { Injectable, Logger } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');
import type { ReportResponse, SubcategoryScore, ReportConfig, FinancialMetrics, ActionPlanItem, ActionPlanTimeframe } from '@alliance-risk/shared';

export interface ReportExtras {
  strengths?: string[];
  weaknesses?: string[];
  keyFindings?: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 45;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_Y = PAGE_HEIGHT - 35;

const COLORS = {
  primary: '#0F766E',
  primaryDark: '#0A5E57',
  secondary: '#115E59',
  accent: '#14B8A6',
  accentLight: '#CCFBF1',
  text: '#1F2937',
  textLight: '#6B7280',
  textMuted: '#9CA3AF',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  bgLight: '#F9FAFB',
  bgTeal: '#F0FDFA',
  white: '#FFFFFF',
  low: '#16A34A',
  lowBg: '#F0FDF4',
  moderate: '#D97706',
  moderateBg: '#FFFBEB',
  high: '#EA580C',
  highBg: '#FFF7ED',
  critical: '#DC2626',
  criticalBg: '#FEF2F2',
} as const;

interface PdfGenerationMetrics {
  bufferedPageCount: number;
  contentPageIndexes: number[];
  footerPageIndexes: number[];
  postFooterBufferedPageCount: number;
}

interface TitlePageLayoutMetrics {
  companyNameBottom: number;
  detailsBottom: number;
  gaugeTop: number;
  gaugeCenterY: number;
  badgeBottom: number;
}

interface ExecutiveSummaryLayoutMetrics {
  summaryTextHeight: number;
  summaryBoxHeight: number;
  summaryBoxBottom: number;
  keyFindingsStartY: number | null;
  paddingTop: number;
  paddingBottom: number;
}

interface MethodologyLayoutMetrics {
  introX: number;
  introWidth: number;
  scaleDescriptionX: number;
  scaleDescriptionWidth: number;
  paragraphX: number;
  paragraphWidth: number;
  finalCursorX: number;
}

interface TocEntry {
  title: string;
  pageIndex: number;
  level: number;
}

interface TocLayoutMetrics {
  tocPageIndex: number;
  entries: Array<{
    title: string;
    pageIndex: number;
    pageNumber: number;
    level: number;
  }>;
}

interface HeaderFooterLayoutMetrics {
  contentPageTotal: number;
  pages: Array<{
    pageIndex: number;
    headerRendered: boolean;
    footerLabel: string;
    footerText: string;
  }>;
}

interface CategoryRecommendationLayoutMetrics {
  recommendationRailWidth: number;
  recommendationPadding: number;
  radarBottomY: number;
  overviewRowHeight: number;
  subcategoryRowHeight: number;
}

interface CompanyProfileLayoutMetrics {
  rowCount: number;
  sectorIndustryValue: string;
  companyTypeValue: string;
  startPageIndex: number;
}

interface RiskHeatmapLayoutMetrics {
  zoneLabels: string[];
  points: Array<{
    category: string;
    shortLabel: string;
    score: number;
    x: number;
    y: number;
  }>;
  gridStartX: number;
  gridWidth: number;
}

interface FinancialOverviewLayoutMetrics {
  startPageIndex: number;
  renderedRevenueChart: boolean;
  renderedCostChart: boolean;
  renderedMarginsSummary: boolean;
  revenuePointCount: number;
  costBarCount: number;
  grossMarginLabel: string;
  operatingMarginLabel: string;
}

interface ActionPlanLayoutMetrics {
  startPageIndex: number;
  timeframeGroups: Array<{
    timeframe: ActionPlanTimeframe;
    count: number;
  }>;
}

interface AppendixLayoutMetrics {
  startPageIndex: number;
  documentSourceCount: number;
  gapSummaryCount: number;
  evidenceCategoryCount: number;
}

interface DisclaimerLayoutMetrics {
  startPageIndex: number;
  sectionCount: number;
  copyrightYear: number;
}

type TypographyStyle = {
  size: number;
  font: string;
  color: string;
  lineGap?: number;
};

export const TYPOGRAPHY = {
  sectionTitle: { size: 22, font: 'Helvetica-Bold', color: COLORS.primary },
  subsectionTitle: { size: 16, font: 'Helvetica-Bold', color: COLORS.primary },
  heading3: { size: 13, font: 'Helvetica-Bold', color: COLORS.text },
  body: { size: 10, font: 'Helvetica', color: COLORS.text, lineGap: 4 },
  bodyStrong: { size: 10, font: 'Helvetica-Bold', color: COLORS.text, lineGap: 4 },
  bodySmall: { size: 9, font: 'Helvetica', color: COLORS.text, lineGap: 3 },
  bodySmallMuted: { size: 9, font: 'Helvetica', color: COLORS.textLight, lineGap: 3 },
  caption: { size: 8, font: 'Helvetica', color: COLORS.textLight },
  footer: { size: 7, font: 'Helvetica', color: COLORS.textMuted },
  tocEntry: { size: 11, font: 'Helvetica', color: COLORS.text },
  tocSection: { size: 12, font: 'Helvetica-Bold', color: COLORS.text },
  titleEyebrow: { size: 11, font: 'Helvetica', color: COLORS.textLight },
  titleBannerLabel: { size: 10, font: 'Helvetica', color: COLORS.accentLight },
  titleBannerTitle: { size: 16, font: 'Helvetica', color: COLORS.white },
  titleCompany: { size: 28, font: 'Helvetica', color: COLORS.text },
  titleMeta: { size: 13, font: 'Helvetica', color: COLORS.textLight },
  gaugeScore: { size: 42, font: 'Helvetica', color: COLORS.text },
  gaugeLabel: { size: 11, font: 'Helvetica', color: COLORS.textLight },
  label: { size: 10, font: 'Helvetica', color: COLORS.textLight },
  badge: { size: 10, font: 'Helvetica', color: COLORS.white },
  badgeSmall: { size: 9, font: 'Helvetica', color: COLORS.white },
  captionSmall: { size: 7, font: 'Helvetica', color: COLORS.textMuted },
  micro: { size: 6, font: 'Helvetica', color: COLORS.textLight },
  tableHeader: { size: 8, font: 'Helvetica-Bold', color: COLORS.white },
  tableCell: { size: 9, font: 'Helvetica', color: COLORS.text },
  tableBadge: { size: 7, font: 'Helvetica-Bold', color: COLORS.white },
  chartValue: { size: 8, font: 'Helvetica', color: COLORS.text },
  analystHeading: { size: 9, font: 'Helvetica-Bold', color: COLORS.secondary },
  analystBody: { size: 9, font: 'Helvetica-Oblique', color: '#15803D', lineGap: 3 },
} as const satisfies Record<string, TypographyStyle>;

export const SPACING = {
  sectionGap: 24,
  subsectionGap: 16,
  paragraphGap: 12,
  itemGap: 8,
  cardPadding: 12,
  headerHeight: 3,
  footerHeight: 35,
  titleBannerGap: 2,
  titleEyebrowGap: 1.5,
  titleMetaGap: 0.4,
  titleGaugeGap: 3,
  titleMiniScoresGap: 2,
  scoreGaugeOffset: 10,
  scoreLabelOffsetTop: 28,
  scoreLabelOffsetBottom: 22,
  badgeTextOffset: 7,
  badgeAfterGap: 55,
  bulletOffsetX: 8,
  bulletOffsetY: 5,
  bulletRadius: 2.5,
  bulletTextOffset: 18,
  keyFindingGap: 15,
  compactItemGap: 0.3,
  chartGap: 1,
  tableTopGap: 5,
  tableRowGap: 4,
  tableRowInset: 2,
  bodyBlockGap: 0.8,
  subsectionBlockGap: 0.5,
  textBlockGap: 4,
  smallTextOffset: 5,
  cardAfterGap: 4,
  priorityHeaderGap: 30,
  analystHeaderGap: 4,
  strengthsGap: 1,
  methodologyScaleGap: 1,
  methodologyParagraphGap: 0.6,
  pageHeaderGap: 12,
  sectionHeadingGap: 0.3,
  ensureSpaceBottom: 50,
  footerSeparatorOffset: 8,
  footerWidth: 120,
  footerPageWidth: 50,
  scoreBarLabelOffset: 13,
} as const;

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);
  private contentPages = new Set<number>();
  private trackContentWrites = false;
  private lastGenerationMetrics: PdfGenerationMetrics | null = null;
  private lastTitlePageLayoutMetrics: TitlePageLayoutMetrics | null = null;
  private lastExecutiveSummaryLayoutMetrics: ExecutiveSummaryLayoutMetrics | null = null;
  private lastMethodologyLayoutMetrics: MethodologyLayoutMetrics | null = null;
  private tocEntries: TocEntry[] = [];
  private tocPageIndex = 1;
  private lastTocLayoutMetrics: TocLayoutMetrics | null = null;
  private lastHeaderFooterLayoutMetrics: HeaderFooterLayoutMetrics | null = null;
  private lastCategoryRecommendationLayoutMetrics: CategoryRecommendationLayoutMetrics | null = null;
  private lastCompanyProfileLayoutMetrics: CompanyProfileLayoutMetrics | null = null;
  private lastRiskHeatmapLayoutMetrics: RiskHeatmapLayoutMetrics | null = null;
  private lastFinancialOverviewLayoutMetrics: FinancialOverviewLayoutMetrics | null = null;
  private lastActionPlanLayoutMetrics: ActionPlanLayoutMetrics | null = null;
  private lastAppendixLayoutMetrics: AppendixLayoutMetrics | null = null;
  private lastDisclaimerLayoutMetrics: DisclaimerLayoutMetrics | null = null;

  // ─── Main Entry ─────────────────────────────────────────────────────────────

  async generate(
    report: ReportResponse,
    extras?: ReportExtras,
    reportConfig?: ReportConfig,
  ): Promise<Buffer> {
    this.logger.log(`Generating PDF for assessment: ${report.assessment.id}`);

    return new Promise((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const doc: any = new PDFDocument({
        size: 'A4',
        margin: MARGIN,
        bufferPages: true,
        info: {
          Title: `Risk Intelligence Report — ${report.assessment.companyName}`,
          Author: 'CGIAR Agricultural Risk Intelligence Tool',
          Subject: 'Risk Assessment Report',
        },
      });

      this.contentPages = new Set<number>();
      this.lastGenerationMetrics = null;
      this.lastTitlePageLayoutMetrics = null;
      this.lastExecutiveSummaryLayoutMetrics = null;
      this.lastMethodologyLayoutMetrics = null;
      this.tocEntries = [];
      this.tocPageIndex = 1;
      this.lastTocLayoutMetrics = null;
      this.lastHeaderFooterLayoutMetrics = null;
      this.lastCategoryRecommendationLayoutMetrics = null;
      this.lastCompanyProfileLayoutMetrics = null;
      this.lastRiskHeatmapLayoutMetrics = null;
      this.lastFinancialOverviewLayoutMetrics = null;
      this.lastActionPlanLayoutMetrics = null;
      this.lastAppendixLayoutMetrics = null;
      this.lastDisclaimerLayoutMetrics = null;
      this.installContentTracking(doc);
      this.trackContentWrites = true;

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const cfg = reportConfig;

      // ── Page 1: Title Page ──
      this.renderTitlePage(doc, report);

      // ── Page 2: TOC placeholder ──
      doc.addPage();
      this.tocPageIndex = this.getCurrentPageIndex(doc);

      // ── Page 3+: Company Profile (Phase 2) ──
      if (!cfg || cfg.includeCompanyProfile !== false) {
        doc.addPage();
        this.renderCompanyProfile(doc, report);
      }

      // ── Executive Summary ──
      doc.addPage();
      this.renderExecutiveSummary(doc, report, extras);

      // ── Page 4: Risk Overview (Radar + Table) ──
      doc.addPage();
      this.renderRiskOverview(doc, report, cfg);

      // ── Category Detail Pages ──
      if (!cfg || cfg.includeCategoryDetails) {
        for (const category of report.categories) {
          doc.addPage();
          this.renderCategoryPage(doc, category, cfg);
        }
      }

      // ── All Recommendations ──
      const hasRecommendations = report.categories.some((category) => category.recommendations.length > 0);
      if ((!cfg || cfg.includeRecommendations) && hasRecommendations) {
        doc.addPage();
        this.renderAllRecommendations(doc, report);
      }

      // ── Action Plan ──
      if (cfg?.includeActionPlan && report.actionPlanItems?.length) {
        doc.addPage();
        this.renderActionPlan(doc, report.actionPlanItems);
      }

      // ── Strengths & Weaknesses ──
      if (extras?.strengths?.length || extras?.weaknesses?.length) {
        doc.addPage();
        this.renderStrengthsWeaknesses(doc, extras);
      }

      // ── Financial Overview ──
      if (cfg?.includeFinancialCharts && report.financialMetrics && this.hasFinancialData(report.financialMetrics)) {
        doc.addPage();
        this.renderFinancialOverview(doc, report.financialMetrics);
      }

      // ── Methodology ──
      if (!cfg || cfg.includeMethodology) {
        doc.addPage();
        this.renderMethodology(doc);
      }

      // ── Appendix ──
      if (cfg?.includeAppendix && (report.documentSources?.length || report.gapSummary?.length)) {
        doc.addPage();
        this.renderAppendix(doc, report, cfg);
      }

      // ── Disclaimer (always included) ──
      doc.addPage();
      this.renderDisclaimer(doc);

      // Fill TOC after all content pages are known
      doc.switchToPage(this.tocPageIndex);
      this.renderTableOfContents(doc);

      // Render headers and footers on all content pages (using buffered pages to avoid recursion)
      this.trackContentWrites = false;
      this.renderAllHeadersAndFooters(doc);

      doc.end();
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private installContentTracking(doc: any): void {
    const originalText = doc.text.bind(doc);

    doc.text = (...args: any[]) => {
      if (this.trackContentWrites) {
        this.markCurrentPage(doc);
      }

      const result = originalText(...args);

      if (this.trackContentWrites) {
        this.markCurrentPage(doc);
      }

      return result;
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private markCurrentPage(doc: any): void {
    this.contentPages.add(this.getCurrentPageIndex(doc));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getCurrentPageIndex(doc: any): number {
    if (Array.isArray(doc._pageBuffer)) {
      const pageIndex = doc._pageBuffer.indexOf(doc.page);
      if (pageIndex >= 0) {
        return pageIndex;
      }
    }

    const range = doc.bufferedPageRange();
    return Math.max(range.start + range.count - 1, 0);
  }

  private collectTocEntry(title: string, pageIndex: number, level: number): void {
    this.tocEntries.push({ title, pageIndex, level });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private renderTableOfContents(doc: any): void {
    doc.x = MARGIN;
    doc.y = MARGIN;
    this.markCurrentPage(doc);
    this.renderPageHeader(doc, 'Contents');

    const titleWidth = CONTENT_WIDTH - 70;
    const pageNumberWidth = 30;
    const pageNumberX = PAGE_WIDTH - MARGIN - pageNumberWidth;
    const leaderGap = 8;
    const tocEntriesWithNumbers = this.tocEntries.map((entry) => ({
      ...entry,
      pageNumber: Math.max(entry.pageIndex, 1),
    }));

    for (const entry of tocEntriesWithNumbers) {
      if (doc.y + 24 > PAGE_HEIGHT - SPACING.ensureSpaceBottom) {
        doc.addPage();
        this.markCurrentPage(doc);
        this.renderPageHeader(doc, 'Contents');
      }

      const entryX = MARGIN + (entry.level > 0 ? 20 : 0);
      const entryY = doc.y;
      const entryStyle: TypographyStyle = entry.level === 0 ? TYPOGRAPHY.tocSection : TYPOGRAPHY.tocEntry;
      const pageLabel = `${entry.pageNumber}`;
      const pageLabelWidth = doc.widthOfString(pageLabel, { font: entryStyle.font, size: entryStyle.size });
      const titleMaxWidth = Math.max(titleWidth - (entry.level > 0 ? 20 : 0), 120);
      const titleHeight = doc.heightOfString(entry.title, {
        width: titleMaxWidth,
        lineGap: entryStyle.lineGap ?? 0,
      });

      this.applyTextStyle(doc, entryStyle)
        .text(entry.title, entryX, entryY, {
          width: titleMaxWidth,
          lineGap: entryStyle.lineGap,
        });

      const leaderStartX = Math.min(entryX + titleMaxWidth + leaderGap, pageNumberX - 40);
      const leaderEndX = pageNumberX - pageLabelWidth - leaderGap;
      const leaderY = entryY + Math.min(titleHeight / 2, 8);
      if (leaderEndX > leaderStartX) {
        doc.save();
        doc.moveTo(leaderStartX, leaderY)
          .lineTo(leaderEndX, leaderY)
          .dash(1, { space: 3 })
          .strokeColor(COLORS.textMuted)
          .lineWidth(0.8)
          .stroke()
          .undash();
        doc.restore();
      }

      this.applyTextStyle(doc, entryStyle)
        .text(pageLabel, pageNumberX, entryY, {
          width: pageNumberWidth,
          align: 'right',
        });

      doc.x = MARGIN;
      doc.y = entryY + Math.max(titleHeight, 18) + SPACING.itemGap;
    }

    this.lastTocLayoutMetrics = {
      tocPageIndex: this.tocPageIndex,
      entries: tocEntriesWithNumbers,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private applyTextStyle(doc: any, style: TypographyStyle, color?: string): any {
    doc.font(style.font);
    doc.fontSize(style.size);
    doc.fillColor(color ?? style.color);
    return doc;
  }

  // ─── Page Footer ────────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private renderPageFooter(doc: any, pageNum: number): void {
    // IMPORTANT: Do NOT use doc.text() here — it can trigger page overflow
    // which fires pageAdded again, causing infinite recursion.
    // Use doc.page.write() with low-level PDF operators instead, or
    // simply defer footer rendering to doc.end() using bufferPages.
    // We'll render footers at the end using buffered pages.
    // Store page number for later rendering.
    if (!doc._footerPages) doc._footerPages = [];
    doc._footerPages.push(pageNum);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private renderAllHeadersAndFooters(doc: any): void {
    const pages = doc.bufferedPageRange();
    const contentPageIndexes = [...this.contentPages]
      .filter((pageIndex) => pageIndex >= 0 && pageIndex < pages.count)
      .sort((left, right) => left - right);
    const footerPageIndexes = contentPageIndexes.filter((pageIndex) => pageIndex > 0);
    const contentPageTotal = footerPageIndexes.length;
    const headerFooterPages: HeaderFooterLayoutMetrics['pages'] = [];

    this.lastGenerationMetrics = {
      bufferedPageCount: pages.count,
      contentPageIndexes,
      footerPageIndexes,
      postFooterBufferedPageCount: pages.count,
    };

    footerPageIndexes.forEach((pageIndex, index) => {
      doc.switchToPage(pageIndex);

      // Header accent line
      doc.save();
      doc.moveTo(MARGIN, 20);
      doc.lineTo(PAGE_WIDTH - MARGIN, 20);
      doc.strokeColor(COLORS.primary);
      doc.lineWidth(1.5);
      doc.stroke();
      doc.restore();

      // Footer separator line
      doc.save();
      doc.moveTo(MARGIN, FOOTER_Y - SPACING.footerSeparatorOffset);
      doc.lineTo(PAGE_WIDTH - MARGIN, FOOTER_Y - SPACING.footerSeparatorOffset);
      doc.strokeColor(COLORS.border);
      doc.lineWidth(0.5);
      doc.stroke();
      doc.restore();

      // FOOTER_Y sits below the page bottom margin; writing text there would
      // trigger PDFKit's overflow check and auto-create phantom pages. Temporarily
      // zero out the bottom margin so the text lands on this page instead.
      const savedX = doc.x;
      const savedY = doc.y;
      const savedBottomMargin = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      const pageNumber = index + 1;
      const footerLabel = `Page ${pageNumber} of ${contentPageTotal}`;
      const footerText = 'CONFIDENTIAL — CGIAR Agricultural Risk Intelligence';
      this.applyTextStyle(doc, TYPOGRAPHY.footer);
      doc.text(footerText, MARGIN, FOOTER_Y, { width: 300, lineBreak: false });
      doc.text(footerLabel, PAGE_WIDTH - MARGIN - 80, FOOTER_Y, {
        width: 80,
        align: 'right',
        lineBreak: false,
      });
      doc.page.margins.bottom = savedBottomMargin;
      doc.x = savedX;
      doc.y = savedY;

      headerFooterPages.push({
        pageIndex,
        headerRendered: true,
        footerLabel,
        footerText,
      });
    });

    this.lastHeaderFooterLayoutMetrics = {
      contentPageTotal,
      pages: headerFooterPages,
    };

    // Re-read buffer after footer rendering so tests can assert that no phantom
    // pages were created by overflow during footer text() calls.
    if (this.lastGenerationMetrics) {
      this.lastGenerationMetrics.postFooterBufferedPageCount = doc.bufferedPageRange().count;
    }
  }

  // ─── Title Page ─────────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private renderTitlePage(doc: any, report: ReportResponse): void {
    doc.x = MARGIN;
    this.markCurrentPage(doc);
    const titleBlockWidth = CONTENT_WIDTH - 60;
    const titleBlockX = MARGIN + (CONTENT_WIDTH - titleBlockWidth) / 2;
    const titleTopY = 180;
    const detailsGap = 14;
    const metadataToGaugeGap = 28;
    const gaugeR = 70;
    const gaugeStrokeWidth = 10;
    const minGaugeCenterY = 360;

    // Top banner
    doc.rect(0, 0, PAGE_WIDTH, 100).fill(COLORS.primary);

    // Banner text
    this.applyTextStyle(doc, TYPOGRAPHY.titleBannerLabel)
      .text('CGIAR', MARGIN, 30, { width: CONTENT_WIDTH, align: 'center' });
    this.applyTextStyle(doc, TYPOGRAPHY.titleBannerTitle)
      .text('Agricultural Risk Intelligence Tool', MARGIN, 48, { width: CONTENT_WIDTH, align: 'center' });

    // Accent line under banner
    doc.rect(0, 100, PAGE_WIDTH, SPACING.headerHeight).fill(COLORS.accent);

    // Title
    doc.moveDown(SPACING.titleBannerGap);
    doc.y = 140;
    this.applyTextStyle(doc, TYPOGRAPHY.titleEyebrow)
      .text('RISK INTELLIGENCE REPORT', MARGIN, 140, { width: CONTENT_WIDTH, align: 'center', characterSpacing: 4 });

    doc.moveDown(SPACING.titleEyebrowGap);

    // Company name
    const companyNameHeight = doc.heightOfString(report.assessment.companyName, {
      width: titleBlockWidth,
      align: 'center',
    });
    this.applyTextStyle(doc, TYPOGRAPHY.titleCompany)
      .text(report.assessment.companyName, titleBlockX, titleTopY, { width: titleBlockWidth, align: 'center' });

    // Company details
    const details = [report.assessment.companyType, report.assessment.country].filter(Boolean).join(' · ');
    const detailsY = titleTopY + companyNameHeight + detailsGap;
    const detailsHeight = details
      ? doc.heightOfString(details, {
          width: titleBlockWidth,
          align: 'center',
        })
      : 0;
    this.applyTextStyle(doc, TYPOGRAPHY.titleMeta)
      .text(details, titleBlockX, detailsY, { width: titleBlockWidth, align: 'center' });

    // ── Score Gauge ──
    const metadataBottom = details ? detailsY + detailsHeight : titleTopY + companyNameHeight;
    const gaugeY = Math.max(minGaugeCenterY, metadataBottom + metadataToGaugeGap + gaugeR);
    const gaugeCx = PAGE_WIDTH / 2;
    const score = report.overallScore;
    const levelColor = this.getLevelColor(report.overallLevel);

    // Draw background circle arc (270 degrees)
    this.drawArc(doc, gaugeCx, gaugeY, gaugeR, 135, 405, COLORS.borderLight, 10);
    // Draw filled arc proportional to score
    const scoreAngle = 135 + (score / 100) * 270;
    if (score > 0) {
      this.drawArc(doc, gaugeCx, gaugeY, gaugeR, 135, scoreAngle, levelColor, 10);
    }

    // Score text in center
    this.applyTextStyle(doc, TYPOGRAPHY.gaugeScore, levelColor);
    doc.text(`${score}`, gaugeCx - 50, gaugeY - SPACING.scoreLabelOffsetTop, { width: 100, align: 'center' });
    this.applyTextStyle(doc, TYPOGRAPHY.gaugeLabel);
    doc.text('out of 100', gaugeCx - 50, gaugeY + SPACING.scoreLabelOffsetBottom, { width: 100, align: 'center' });

    // Level badge
    const badgeWidth = 90;
    const badgeX = gaugeCx - badgeWidth / 2;
    const badgeY = gaugeY + 50;
    doc.roundedRect(badgeX, badgeY, badgeWidth, 24, 12).fill(this.getLevelBg(report.overallLevel));
    doc.roundedRect(badgeX, badgeY, badgeWidth, 24, 12).strokeColor(levelColor).lineWidth(1).stroke();
    this.applyTextStyle(doc, TYPOGRAPHY.badge, levelColor);
    doc.text(report.overallLevel, badgeX, badgeY + SPACING.badgeTextOffset, { width: badgeWidth, align: 'center' });

    this.lastTitlePageLayoutMetrics = {
      companyNameBottom: titleTopY + companyNameHeight,
      detailsBottom: metadataBottom,
      gaugeTop: gaugeY - gaugeR - gaugeStrokeWidth / 2,
      gaugeCenterY: gaugeY,
      badgeBottom: badgeY + 24,
    };

    doc.y = badgeY + SPACING.badgeAfterGap;

    // ── Mini category scores row ──
    doc.moveDown(SPACING.titleMiniScoresGap);
    const miniY = doc.y;
    const numCats = report.categories.length;
    const spacing = CONTENT_WIDTH / numCats;
    const startX = MARGIN + spacing / 2;

    for (let i = 0; i < numCats; i++) {
      const cat = report.categories[i];
      const cx = startX + i * spacing;
      const catColor = this.getLevelColor(cat.level);
      const catBg = this.getLevelBg(cat.level);

      // Circle
      doc.circle(cx, miniY, 18).fill(catBg);
      doc.circle(cx, miniY, 18).strokeColor(catColor).lineWidth(1.5).stroke();

      // Score
      this.applyTextStyle(doc, TYPOGRAPHY.bodySmall, catColor)
        .text(`${cat.score}`, cx - 15, miniY - 5, { width: 30, align: 'center' });

      // Label
      const shortLabel = this.shortCategoryName(cat.category);
      this.applyTextStyle(doc, TYPOGRAPHY.micro)
        .text(shortLabel, cx - 30, miniY + 23, { width: 60, align: 'center' });
    }

    // ── Date and metadata ──
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    this.applyTextStyle(doc, TYPOGRAPHY.captionSmall)
      .text(`Generated: ${dateStr}`, MARGIN, PAGE_HEIGHT - 100, { width: CONTENT_WIDTH, align: 'center' });

    // Bottom accent bar
    doc.rect(0, PAGE_HEIGHT - 6, PAGE_WIDTH, 6).fill(COLORS.primary);
  }

  // ─── Executive Summary ──────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private renderExecutiveSummary(doc: any, report: ReportResponse, extras?: ReportExtras): void {
    doc.x = MARGIN;
    this.markCurrentPage(doc);
    this.collectTocEntry('Executive Summary', this.getCurrentPageIndex(doc), 0);
    this.renderPageHeader(doc, 'Executive Summary');

    // Summary text in a tinted box
    const summaryPadding = SPACING.cardPadding;
    const summaryTextWidth = CONTENT_WIDTH - summaryPadding * 2;
    const summaryTextHeight = doc.heightOfString(report.executiveSummary, {
      width: summaryTextWidth, lineGap: TYPOGRAPHY.body.lineGap,
    });
    const summaryHeight = summaryTextHeight + summaryPadding * 2;

    const boxY = doc.y;
    doc.roundedRect(MARGIN, boxY, CONTENT_WIDTH, summaryHeight, 6).fill(COLORS.bgTeal);
    doc.roundedRect(MARGIN, boxY, 3, summaryHeight, 2).fill(COLORS.primary);

    this.applyTextStyle(doc, TYPOGRAPHY.body)
      .text(report.executiveSummary, MARGIN + summaryPadding, boxY + summaryPadding, {
        width: summaryTextWidth, align: 'justify', lineGap: TYPOGRAPHY.body.lineGap,
      });

    doc.y = boxY + summaryHeight + SPACING.keyFindingGap;
    let keyFindingsStartY: number | null = null;

    // Key Findings
    if (extras?.keyFindings?.length) {
      keyFindingsStartY = doc.y;
      this.renderSectionHeading(doc, 'Key Findings');
      for (const finding of extras.keyFindings) {
        this.ensureSpace(doc, 40);
        // Bullet with accent color
        const bulletY = doc.y;
        doc.circle(MARGIN + SPACING.bulletOffsetX, bulletY + SPACING.bulletOffsetY, SPACING.bulletRadius).fill(COLORS.accent);
        this.applyTextStyle(doc, TYPOGRAPHY.bodySmall)
          .text(finding, MARGIN + SPACING.bulletTextOffset, bulletY, {
            width: CONTENT_WIDTH - SPACING.bulletTextOffset,
            lineGap: TYPOGRAPHY.bodySmall.lineGap,
          });
        doc.moveDown(SPACING.sectionHeadingGap);
      }
    }

    this.lastExecutiveSummaryLayoutMetrics = {
      summaryTextHeight,
      summaryBoxHeight: summaryHeight,
      summaryBoxBottom: boxY + summaryHeight,
      keyFindingsStartY,
      paddingTop: summaryPadding,
      paddingBottom: summaryPadding,
    };
  }

  // ─── Company Profile ────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private renderCompanyProfile(doc: any, report: ReportResponse): void {
    doc.x = MARGIN;
    this.markCurrentPage(doc);
    const pageIndex = this.getCurrentPageIndex(doc);
    this.collectTocEntry('Company Profile', pageIndex, 0);
    this.renderPageHeader(doc, 'Company Profile');

    const assessmentDate = new Date(report.assessment.updatedAt || report.assessment.createdAt)
      .toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const assessmentId = report.assessment.id.substring(0, 8).toUpperCase();
    const companyTypeValue = report.assessment.companyType ?? 'Not specified';
    const sectorIndustryValue = report.assessment.companyType ?? 'Not specified';
    const rows = [
      ['Company Name', report.assessment.companyName],
      ['Sector / Industry', sectorIndustryValue],
      ['Country', report.assessment.country],
      ['Company Type', companyTypeValue],
      ['Assessment Date', assessmentDate],
      ['Assessment ID', assessmentId],
      ['Overall Risk Score', `${report.overallScore}/100 (${report.overallLevel})`],
    ] as const;

    const tableX = MARGIN;
    const tableY = doc.y + 8;
    const labelWidth = 170;
    const valueWidth = CONTENT_WIDTH - labelWidth;
    const rowHeight = 38;

    for (let index = 0; index < rows.length; index++) {
      const [label, value] = rows[index];
      const rowY = tableY + index * rowHeight;
      const background = index % 2 === 0 ? COLORS.white : COLORS.bgLight;

      doc.rect(tableX, rowY, CONTENT_WIDTH, rowHeight).fill(background);
      doc.save();
      doc.moveTo(tableX + labelWidth, rowY)
        .lineTo(tableX + labelWidth, rowY + rowHeight)
        .strokeColor(COLORS.border)
        .lineWidth(1)
        .stroke();
      doc.restore();

      this.applyTextStyle(doc, TYPOGRAPHY.bodyStrong)
        .text(label, tableX + 12, rowY + 12, { width: labelWidth - 24 });
      this.applyTextStyle(doc, TYPOGRAPHY.body)
        .text(value, tableX + labelWidth + 12, rowY + 12, {
          width: valueWidth - 24,
          lineGap: TYPOGRAPHY.body.lineGap,
        });
    }

    doc.save();
    doc.roundedRect(tableX, tableY, CONTENT_WIDTH, rowHeight * rows.length, 4)
      .lineWidth(1)
      .strokeColor(COLORS.border)
      .stroke();
    doc.restore();

    doc.y = tableY + rowHeight * rows.length + SPACING.sectionGap;
    doc.x = MARGIN;

    this.lastCompanyProfileLayoutMetrics = {
      rowCount: rows.length,
      sectorIndustryValue,
      companyTypeValue,
      startPageIndex: pageIndex,
    };
  }

  // ─── Risk Overview (Radar + Table) ──────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private renderRiskOverview(doc: any, report: ReportResponse, cfg?: ReportConfig): void {
    doc.x = MARGIN;
    this.markCurrentPage(doc);
    this.collectTocEntry('Risk Overview', this.getCurrentPageIndex(doc), 0);
    this.renderPageHeader(doc, 'Risk Overview');

    // Radar chart
    if (!cfg || cfg.includeRadarChart) {
      this.renderRadarChart(doc, report.categories);
      doc.x = MARGIN;
      doc.moveDown(SPACING.chartGap);
    }

    // Category overview table
    this.renderOverviewTable(doc, report);
    doc.x = MARGIN;

    if (!cfg || cfg.includeRiskHeatmap !== false) {
      this.renderRiskHeatmap(doc, report);
      doc.x = MARGIN;
    }
  }

  // ─── Radar Chart ────────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private renderRadarChart(doc: any, categories: ReportResponse['categories']): void {
    const cx = PAGE_WIDTH / 2;
    const cy = doc.y + 124;
    const R = 104;
    const n = categories.length;

    const getPoint = (i: number, radius: number) => {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
    };

    // Helper to draw a closed polygon stroke
    const drawPolygonStroke = (pts: { x: number; y: number }[], strokeCol: string, lineW: number) => {
      doc.save();
      doc.strokeColor(strokeCol);
      doc.lineWidth(lineW);
      doc.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) doc.lineTo(pts[i].x, pts[i].y);
      doc.lineTo(pts[0].x, pts[0].y); // close
      doc.stroke();
      doc.restore();
    };

    // Draw concentric rings (25%, 50%, 75%, 100%)
    for (const pct of [0.25, 0.5, 0.75, 1.0]) {
      const pts = Array.from({ length: n }, (_, i) => getPoint(i, R * pct));
      drawPolygonStroke(pts, COLORS.border, 0.5);
    }

    // Draw axes
    for (let i = 0; i < n; i++) {
      const p = getPoint(i, R);
      doc.save();
      doc.moveTo(cx, cy);
      doc.lineTo(p.x, p.y);
      doc.strokeColor(COLORS.border);
      doc.lineWidth(0.5);
      doc.stroke();
      doc.restore();
    }

    // Data polygon
    const dp = categories.map((cat, i) => getPoint(i, (cat.score / 100) * R));

    // Filled polygon with transparency (use light teal fill instead of opacity for compatibility)
    doc.save();
    doc.moveTo(dp[0].x, dp[0].y);
    for (let i = 1; i < dp.length; i++) doc.lineTo(dp[i].x, dp[i].y);
    doc.lineTo(dp[0].x, dp[0].y);
    doc.fill(COLORS.accentLight);
    doc.restore();

    // Stroke polygon
    drawPolygonStroke(dp, COLORS.primary, 2);

    // Data points and labels
    for (let i = 0; i < n; i++) {
      const p = dp[i];
      const catColor = this.getLevelColor(categories[i].level);

      // Data dot
      doc.circle(p.x, p.y, 4).fill(catColor);
      doc.circle(p.x, p.y, 4).strokeColor(COLORS.white).lineWidth(1.5).stroke();

      // Axis label
      const lp = getPoint(i, R + 20);
      const label = this.shortCategoryName(categories[i].category);
      const scoreLabel = `${categories[i].score}`;

      let align: 'center' | 'left' | 'right' = 'center';
      const labelWidth = 70;
      const cosAngle = Math.cos((2 * Math.PI * i) / n - Math.PI / 2);
      const lx = lp.x - labelWidth / 2;
      if (cosAngle < -0.3) align = 'right';
      else if (cosAngle > 0.3) align = 'left';
      const ly = lp.y - 6;

      this.applyTextStyle(doc, TYPOGRAPHY.caption)
        .text(label, lx, ly, { width: labelWidth, align });
      this.applyTextStyle(doc, TYPOGRAPHY.captionSmall, catColor)
        .text(scoreLabel, lx, ly + 10, { width: labelWidth, align });
    }

    doc.y = cy + R + 34;
  }

  // ─── Overview Table ─────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private renderOverviewTable(doc: any, report: ReportResponse): void {
    this.ensureSpace(doc, 240);

    const startX = MARGIN;
    const colWidths = { category: 146, bar: 178, score: 48, level: 66, narrative: CONTENT_WIDTH - 438 };
    const rowHeight = 28;
    const headerHeight = 22;

    // Header
    const tableTop = doc.y + SPACING.tableTopGap;
    doc.roundedRect(startX, tableTop, CONTENT_WIDTH, headerHeight, 3).fill(COLORS.primary);
    this.applyTextStyle(doc, TYPOGRAPHY.tableHeader)
      .text('Category', startX + 10, tableTop + 6, { width: colWidths.category })
      .text('Risk Score', startX + colWidths.category + 10, tableTop + 6, { width: colWidths.bar })
      .text('Score', startX + colWidths.category + colWidths.bar + 5, tableTop + 6, { width: colWidths.score, align: 'center' })
      .text('Level', startX + colWidths.category + colWidths.bar + colWidths.score + 5, tableTop + 6, { width: colWidths.level, align: 'center' });

    let rowY = tableTop + headerHeight + SPACING.tableRowGap;
    for (let i = 0; i < report.categories.length; i++) {
      const cat = report.categories[i];
      const levelColor = this.getLevelColor(cat.level);

      // Alternate row bg
      if (i % 2 === 0) {
        doc.rect(startX, rowY - SPACING.tableRowInset, CONTENT_WIDTH, rowHeight).fill(COLORS.bgLight);
      }

      // Category name
      this.applyTextStyle(doc, TYPOGRAPHY.tableCell)
        .text(this.formatCategoryName(cat.category), startX + 10, rowY + 4, { width: colWidths.category });

      // Mini progress bar
      const barX = startX + colWidths.category + 10;
      const barY = rowY + 9;
      const barWidth = colWidths.bar - 20;
      const barHeight = 10;
      doc.roundedRect(barX, barY, barWidth, barHeight, 4).fill(COLORS.borderLight);
      const fillWidth = (cat.score / 100) * barWidth;
      if (fillWidth > 0) {
        doc.roundedRect(barX, barY, fillWidth, barHeight, 4).fill(levelColor);
      }

      // Score
      this.applyTextStyle(doc, TYPOGRAPHY.tableCell, levelColor)
        .text(`${cat.score}`, startX + colWidths.category + colWidths.bar + 5, rowY + 4, { width: colWidths.score, align: 'center' });

      // Level badge
      const levelX = startX + colWidths.category + colWidths.bar + colWidths.score + 5;
      const badgeW = 60;
      const badgePad = (colWidths.level - badgeW) / 2;
      doc.roundedRect(levelX + badgePad, rowY + 4, badgeW, 18, 9).fill(this.getLevelBg(cat.level));
      this.applyTextStyle(doc, TYPOGRAPHY.tableBadge, levelColor)
        .text(cat.level, levelX + badgePad, rowY + 8, { width: badgeW, align: 'center' });

      rowY += rowHeight;
    }

    doc.y = rowY + SPACING.smallTextOffset;
  }

  // ─── Risk Heatmap ───────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private renderRiskHeatmap(doc: any, report: ReportResponse): void {
    this.ensureSpace(doc, 280);
    this.renderSectionHeading(doc, 'Risk Heatmap');

    const zoneLabels = ['LOW (0-30)', 'MODERATE (31-60)', 'HIGH (61-80)', 'CRITICAL'];
    const zoneColors = [COLORS.lowBg, COLORS.moderateBg, COLORS.highBg, COLORS.criticalBg];
    const gridStartX = MARGIN + 58;
    const gridWidth = CONTENT_WIDTH - 58;
    const zoneWidth = gridWidth / 4;
    const headerY = doc.y;
    const headerHeight = 24;
    const rowStartY = headerY + headerHeight + 10;
    const rowGap = 26;
    const circleRadius = 8;

    for (let index = 0; index < zoneLabels.length; index++) {
      const x = gridStartX + index * zoneWidth;
      doc.rect(x, headerY, zoneWidth, headerHeight).fill(zoneColors[index]);
      doc.rect(x, headerY, zoneWidth, headerHeight).strokeColor(COLORS.border).lineWidth(0.5).stroke();
      this.applyTextStyle(doc, TYPOGRAPHY.captionSmall, COLORS.text)
        .text(zoneLabels[index], x, headerY + 8, { width: zoneWidth, align: 'center' });
    }

    for (let index = 0; index <= 4; index++) {
      const x = gridStartX + index * zoneWidth;
      doc.save();
      doc.moveTo(x, headerY)
        .lineTo(x, rowStartY + report.categories.length * rowGap - 8)
        .strokeColor(COLORS.border)
        .lineWidth(0.5)
        .stroke();
      doc.restore();
    }

    const points = report.categories.map((category, index) => {
      const y = rowStartY + index * rowGap;
      const shortLabel = this.heatmapCategoryLabel(category.category);
      const scoreX = gridStartX + (Math.max(0, Math.min(category.score, 100)) / 100) * gridWidth;
      const pointColor = this.getLevelColor(category.level);

      this.applyTextStyle(doc, TYPOGRAPHY.bodySmall)
        .text(shortLabel, MARGIN, y - 5, { width: 42, align: 'left' });

      doc.save();
      doc.moveTo(gridStartX, y)
        .lineTo(gridStartX + gridWidth, y)
        .strokeColor(COLORS.borderLight)
        .lineWidth(0.5)
        .stroke();
      doc.restore();

      doc.circle(scoreX, y, circleRadius).fill(pointColor);
      doc.circle(scoreX, y, circleRadius).strokeColor(COLORS.white).lineWidth(1.5).stroke();
      this.applyTextStyle(doc, TYPOGRAPHY.captionSmall, pointColor)
        .text(`${category.score}`, scoreX + 12, y - 4, { width: 28 });

      return {
        category: category.category,
        shortLabel,
        score: category.score,
        x: scoreX,
        y,
      };
    });

    doc.y = rowStartY + report.categories.length * rowGap + SPACING.paragraphGap;
    this.lastRiskHeatmapLayoutMetrics = {
      zoneLabels,
      points,
      gridStartX,
      gridWidth,
    };
  }

  // ─── Financial Overview ─────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private renderFinancialOverview(doc: any, metrics: FinancialMetrics): void {
    doc.x = MARGIN;
    this.markCurrentPage(doc);
    const pageIndex = this.getCurrentPageIndex(doc);
    this.collectTocEntry('Financial Overview', pageIndex, 0);
    this.renderPageHeader(doc, 'Financial Overview');

    const revenue = metrics.revenue
      .filter((entry) => Number.isFinite(entry.year) && Number.isFinite(entry.amount))
      .sort((left, right) => left.year - right.year);
    const costs = metrics.costs
      .filter((entry) => entry.category && Number.isFinite(entry.amount) && entry.amount > 0)
      .sort((left, right) => right.amount - left.amount);
    const hasMargins = metrics.margins.gross !== null || metrics.margins.operating !== null;

    // ─── Revenue Projection: vertical bar chart ────────────────────────────
    if (revenue.length > 0) {
      const chartHeight = 140;
      const valueLabelGap = 22;     // headroom above the tallest bar for value labels
      const yearLabelGap = 22;      // space below the baseline for year labels
      const blockHeight = chartHeight + valueLabelGap + yearLabelGap + 30; // + section heading
      this.ensureSpace(doc, blockHeight);
      this.renderSectionHeading(doc, 'Revenue Projection');

      const yLabelWidth = 64;
      const chartX = MARGIN + yLabelWidth;
      const chartTop = doc.y + valueLabelGap;
      const chartWidth = CONTENT_WIDTH - yLabelWidth;
      const baselineY = chartTop + chartHeight;
      const maxRevenue = Math.max(...revenue.map((entry) => entry.amount), 1);

      // Y-axis: baseline (0%) + gridlines at 25/50/75/100%
      [0, 0.25, 0.5, 0.75, 1].forEach((tick) => {
        const y = baselineY - tick * chartHeight;
        doc.save();
        doc.moveTo(chartX, y)
          .lineTo(chartX + chartWidth, y)
          .strokeColor(tick === 0 ? COLORS.text : COLORS.border)
          .lineWidth(tick === 0 ? 1 : 0.5)
          .stroke();
        doc.restore();
        this.applyTextStyle(doc, TYPOGRAPHY.captionSmall)
          .text(
            this.formatCurrencyCompact(maxRevenue * tick, revenue[0]?.currency),
            MARGIN,
            y - 4,
            { width: yLabelWidth - 6, align: 'right', lineBreak: false },
          );
      });

      // Vertical bars
      const barCount = revenue.length;
      const barGap = 14;
      const barWidth = Math.max(18, (chartWidth - barGap * (barCount + 1)) / barCount);
      revenue.forEach((entry, index) => {
        const x = chartX + barGap + index * (barWidth + barGap);
        const heightPx = (entry.amount / maxRevenue) * chartHeight;
        const y = baselineY - heightPx;

        // Filled bar
        doc.rect(x, y, barWidth, heightPx).fill(COLORS.primary);

        // Value label above the bar
        this.applyTextStyle(doc, TYPOGRAPHY.captionSmall, COLORS.primary)
          .text(
            this.formatCurrencyCompact(entry.amount, entry.currency),
            x - 16,
            y - 12,
            { width: barWidth + 32, align: 'center', lineBreak: false },
          );

        // Year label below the baseline
        this.applyTextStyle(doc, TYPOGRAPHY.bodySmall)
          .text(
            `${entry.year}`,
            x - 16,
            baselineY + 6,
            { width: barWidth + 32, align: 'center', lineBreak: false },
          );
      });

      doc.y = baselineY + yearLabelGap + SPACING.paragraphGap;
      doc.x = MARGIN;
    }

    // ─── Cost Breakdown: horizontal stacked bar + legend ───────────────────
    // NOTE: FinancialCostEntry has no `year` field, so a single horizontal
    // stacked bar (one segment per category) is the closest match to "stacked
    // bars" given the current data shape. Per-year stacking would require
    // extending FinancialCostEntry with `year` and updating the Bedrock
    // extraction prompt — flagged as a separate change.
    if (costs.length > 0) {
      const stackPalette = [
        COLORS.primary,
        COLORS.accent,
        COLORS.moderate,
        COLORS.high,
        COLORS.critical,
        COLORS.low,
        COLORS.secondary,
        COLORS.primaryDark,
      ];
      const stackHeight = 30;
      const legendRowHeight = 18;
      const legendRows = Math.ceil(costs.length / 2);
      const blockHeight = 30 + stackHeight + 14 + legendRows * legendRowHeight + SPACING.paragraphGap;
      this.ensureSpace(doc, blockHeight);
      this.renderSectionHeading(doc, 'Cost Breakdown');

      const totalCost = costs.reduce((sum, entry) => sum + entry.amount, 0);
      const stackY = doc.y + 6;

      // Rounded background track (so the outer corners look clean)
      doc.roundedRect(MARGIN, stackY, CONTENT_WIDTH, stackHeight, 4).fill(COLORS.borderLight);

      // Stacked segments
      let cursorX = MARGIN;
      costs.forEach((entry, index) => {
        const segmentWidth = (entry.amount / totalCost) * CONTENT_WIDTH;
        const color = stackPalette[index % stackPalette.length];
        doc.rect(cursorX, stackY, segmentWidth, stackHeight).fill(color);

        const pct = (entry.amount / totalCost) * 100;
        if (segmentWidth > 36) {
          this.applyTextStyle(doc, TYPOGRAPHY.captionSmall, COLORS.white)
            .text(`${pct.toFixed(0)}%`, cursorX, stackY + 11, {
              width: segmentWidth,
              align: 'center',
              lineBreak: false,
            });
        }
        cursorX += segmentWidth;
      });

      // Re-stroke the rounded outline on top so the inner segments don't poke
      // past the corners
      doc.save();
      doc.roundedRect(MARGIN, stackY, CONTENT_WIDTH, stackHeight, 4)
        .strokeColor(COLORS.border)
        .lineWidth(0.5)
        .stroke();
      doc.restore();

      // Legend (two columns)
      const legendStartY = stackY + stackHeight + 14;
      const legendColWidth = CONTENT_WIDTH / 2;
      const swatchSize = 10;
      const swatchGap = 6;
      costs.forEach((entry, index) => {
        const col = index % 2;
        const row = Math.floor(index / 2);
        const cellX = MARGIN + col * legendColWidth;
        const cellY = legendStartY + row * legendRowHeight;
        const color = stackPalette[index % stackPalette.length];

        doc.rect(cellX, cellY + 3, swatchSize, swatchSize).fill(color);

        const labelText = `${entry.category} — ${this.formatCurrencyCompact(entry.amount)}`;
        this.applyTextStyle(doc, TYPOGRAPHY.bodySmall)
          .text(labelText, cellX + swatchSize + swatchGap, cellY, {
            width: legendColWidth - swatchSize - swatchGap - 8,
            lineBreak: false,
          });
      });

      doc.y = legendStartY + legendRows * legendRowHeight + SPACING.paragraphGap;
      doc.x = MARGIN;
    }

    // ─── Margins Summary: pills with progress bars ─────────────────────────
    const grossMarginLabel = this.formatMargin(metrics.margins.gross);
    const operatingMarginLabel = this.formatMargin(metrics.margins.operating);

    const pillHeight = 56;
    const pillGap = 14;
    const pillWidth = (CONTENT_WIDTH - pillGap) / 2;
    const marginsBlockHeight = 30 + pillHeight + SPACING.paragraphGap;
    this.ensureSpace(doc, marginsBlockHeight);
    this.renderSectionHeading(doc, 'Margins Summary');

    const summaryY = doc.y + 6;

    const pills = [
      {
        x: MARGIN,
        title: 'GROSS MARGIN',
        label: grossMarginLabel,
        value: metrics.margins.gross,
        color: metrics.margins.gross === null ? COLORS.textMuted : this.getMarginColor(metrics.margins.gross),
      },
      {
        x: MARGIN + pillWidth + pillGap,
        title: 'OPERATING MARGIN',
        label: operatingMarginLabel,
        value: metrics.margins.operating,
        color: metrics.margins.operating === null ? COLORS.textMuted : this.getMarginColor(metrics.margins.operating),
      },
    ];

    pills.forEach((pill) => {
      // Background pill — light teal accent (per spec)
      doc.roundedRect(pill.x, summaryY, pillWidth, pillHeight, 10).fill(COLORS.accentLight);

      // Title (top-left, dark muted)
      this.applyTextStyle(doc, TYPOGRAPHY.captionSmall, COLORS.textLight)
        .text(pill.title, pill.x + 16, summaryY + 12, {
          width: pillWidth - 32,
          lineBreak: false,
        });

      // Value (top-right, large + colored by margin level)
      this.applyTextStyle(doc, TYPOGRAPHY.heading3, pill.color)
        .text(pill.label, pill.x + 16, summaryY + 9, {
          width: pillWidth - 32,
          align: 'right',
          lineBreak: false,
        });

      // Progress track (bottom of pill)
      const trackHeight = 6;
      const trackX = pill.x + 16;
      const trackY = summaryY + pillHeight - 16;
      const trackWidth = pillWidth - 32;
      doc.roundedRect(trackX, trackY, trackWidth, trackHeight, trackHeight / 2).fill(COLORS.borderLight);

      // Progress fill — width proportional to clamped margin value
      if (pill.value !== null) {
        const clamped = Math.max(0, Math.min(1, pill.value));
        const fillW = clamped > 0 ? Math.max(clamped * trackWidth, trackHeight) : 0;
        if (fillW > 0) {
          doc.roundedRect(trackX, trackY, fillW, trackHeight, trackHeight / 2).fill(pill.color);
        }
      }
    });

    doc.y = summaryY + pillHeight + SPACING.paragraphGap;
    doc.x = MARGIN;

    this.lastFinancialOverviewLayoutMetrics = {
      startPageIndex: pageIndex,
      renderedRevenueChart: revenue.length > 0,
      renderedCostChart: costs.length > 0,
      renderedMarginsSummary: hasMargins || true,
      revenuePointCount: revenue.length,
      costBarCount: costs.length,
      grossMarginLabel,
      operatingMarginLabel,
    };
  }

  // ─── Category Detail Page ───────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private renderCategoryPage(doc: any, category: ReportResponse['categories'][number], cfg?: ReportConfig): void {
    doc.x = MARGIN;
    this.markCurrentPage(doc);
    const categoryLabel = this.formatCategoryName(category.category);
    this.collectTocEntry(categoryLabel, this.getCurrentPageIndex(doc), 1);
    this.renderPageHeader(doc, categoryLabel);

    // Score banner
    this.renderScoreBanner(doc, category.score, category.level);
    // Reset x to margin after banner (banner text can shift it)
    doc.x = MARGIN;
    doc.moveDown(SPACING.subsectionBlockGap);

    // Narrative
    if (category.narrative) {
      this.applyTextStyle(doc, TYPOGRAPHY.body)
        .text(category.narrative, MARGIN, doc.y, { align: 'justify', lineGap: TYPOGRAPHY.body.lineGap, width: CONTENT_WIDTH });
      doc.moveDown(SPACING.bodyBlockGap);
    }

    // Evidence
    if ((!cfg || cfg.includeEvidenceTraces) && category.evidence) {
      this.renderSectionHeading(doc, 'Evidence');
      this.applyTextStyle(doc, TYPOGRAPHY.bodySmallMuted)
        .text(category.evidence, MARGIN, doc.y, { align: 'justify', lineGap: TYPOGRAPHY.bodySmallMuted.lineGap, width: CONTENT_WIDTH });
      doc.moveDown(SPACING.bodyBlockGap);
    }

    // Analyst Commentary
    if (category.analystComment) {
      this.renderAnalystCommentary(doc, category.analystComment);
      doc.moveDown(SPACING.bodyBlockGap);
    }

    // Subcategory bar chart
    if (category.subcategories.length > 0) {
      if (!cfg || cfg.includeSubcategoryCharts) {
        this.renderSubcategoryBars(doc, category.subcategories);
      } else {
        this.renderSubcategoryTable(doc, category.subcategories);
      }
      doc.x = MARGIN;
      doc.moveDown(SPACING.subsectionBlockGap);
    }

    // Category recommendations
    if (category.recommendations.length > 0 && (!cfg || cfg.includeRecommendations)) {
      this.ensureSpace(doc, 60);
      this.renderSectionHeading(doc, 'Recommendations');
      for (const rec of category.recommendations) {
        this.ensureSpace(doc, 35);
        this.renderRecommendationCard(doc, rec.priority as string, rec.isEdited && rec.editedText ? rec.editedText : rec.text);
      }
    }
  }

  // ─── Score Banner ───────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private renderScoreBanner(doc: any, score: number, level: string): void {
    const levelColor = this.getLevelColor(level);
    const levelBg = this.getLevelBg(level);
    const bannerHeight = 50;
    const bannerY = doc.y;

    doc.roundedRect(MARGIN, bannerY, CONTENT_WIDTH, bannerHeight, 6).fill(levelBg);

    // Score number — use separate text calls to avoid `continued` shifting doc.x
    this.applyTextStyle(doc, TYPOGRAPHY.titleCompany, levelColor)
      .text(`${score}`, MARGIN + 15, bannerY + 8, { width: 70, lineBreak: false });
    this.applyTextStyle(doc, TYPOGRAPHY.label)
      .text('/100', MARGIN + 75, bannerY + 18, { width: 30, lineBreak: false });

    // Level badge
    const badgeWidth = 80;
    const badgeX = MARGIN + 110;
    doc.roundedRect(badgeX, bannerY + 14, badgeWidth, 22, 11).fill(levelColor);
    this.applyTextStyle(doc, TYPOGRAPHY.badgeSmall)
      .text(level, badgeX, bannerY + 19, { width: badgeWidth, align: 'center' });

    // Progress bar
    const barX = MARGIN + 210;
    const barWidth = CONTENT_WIDTH - 225;
    const barY = bannerY + 20;
    const barHeight = 10;
    doc.roundedRect(barX, barY, barWidth, barHeight, 5).fill(COLORS.border);
    const fillW = Math.max((score / 100) * barWidth, 6);
    doc.roundedRect(barX, barY, fillW, barHeight, 5).fill(levelColor);

    // Tick marks
    const ticks = [0, 25, 50, 75, 100];
    for (const t of ticks) {
      const tx = barX + (t / 100) * barWidth;
      this.applyTextStyle(doc, TYPOGRAPHY.micro, COLORS.textMuted)
        .text(`${t}`, tx - 8, barY + SPACING.scoreBarLabelOffset, { width: 16, align: 'center' });
    }

    doc.x = MARGIN;
    doc.y = bannerY + bannerHeight + SPACING.itemGap;
  }

  // ─── Subcategory Bar Chart ──────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private renderSubcategoryBars(doc: any, subcategories: SubcategoryScore[]): void {
    this.ensureSpace(doc, subcategories.length * 30 + 25);
    this.renderSectionHeading(doc, 'Subcategory Scores');

    const labelWidth = 150;
    const levelWidth = 54;
    const barGap = 10;
    const barMaxWidth = CONTENT_WIDTH - labelWidth - levelWidth - barGap * 2;
    const rowHeight = 30;

    for (const sub of subcategories) {
      const rowY = doc.y;
      const levelColor = this.getLevelColor(sub.level);

      // Label
      this.applyTextStyle(doc, TYPOGRAPHY.bodySmall)
        .text(sub.name, MARGIN, rowY + 6, { width: labelWidth });

      // Bar background
      const barX = MARGIN + labelWidth + barGap;
      const barY = rowY + 8;
      const barHeight = 12;
      doc.roundedRect(barX, barY, barMaxWidth, barHeight, 4).fill(COLORS.borderLight);

      // Bar fill
      const fillW = Math.max((sub.score / 100) * barMaxWidth, 4);
      doc.roundedRect(barX, barY, fillW, barHeight, 4).fill(levelColor);

      // Score text inside bar (or outside if too small)
      const scoreText = `${sub.score}`;
      if (fillW > 30) {
        this.applyTextStyle(doc, TYPOGRAPHY.chartValue, COLORS.white)
          .text(scoreText, barX + fillW - 25, barY + 2, { width: 22, align: 'right' });
      } else {
        this.applyTextStyle(doc, TYPOGRAPHY.chartValue, levelColor)
          .text(scoreText, barX + fillW + 4, barY + 2, { width: 30 });
      }

      // Level badge
      const badgeX = MARGIN + CONTENT_WIDTH - levelWidth;
      this.applyTextStyle(doc, TYPOGRAPHY.captionSmall, levelColor)
        .text(sub.level, badgeX, rowY + 7, { width: levelWidth, align: 'right' });

      doc.y = rowY + rowHeight;
    }
  }

  // ─── Subcategory Table (fallback) ───────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private renderSubcategoryTable(doc: any, subcategories: SubcategoryScore[]): void {
    this.ensureSpace(doc, subcategories.length * 22 + 25);
    this.renderSectionHeading(doc, 'Subcategory Scores');

    const startX = MARGIN;
    const colWidths = { name: 130, score: 45, level: 65, evidence: CONTENT_WIDTH - 240 };

    // Header
    const tableTop = doc.y;
    doc.roundedRect(startX, tableTop, CONTENT_WIDTH, 18, 2).fill(COLORS.primary);
    this.applyTextStyle(doc, TYPOGRAPHY.tableBadge)
      .text('Subcategory', startX + 6, tableTop + 4, { width: colWidths.name })
      .text('Score', startX + colWidths.name + 6, tableTop + 4, { width: colWidths.score })
      .text('Level', startX + colWidths.name + colWidths.score + 6, tableTop + 4, { width: colWidths.level })
      .text('Evidence / Mitigation', startX + colWidths.name + colWidths.score + colWidths.level + 6, tableTop + 4, { width: colWidths.evidence });

    let rowY = tableTop + 20;
    for (let i = 0; i < subcategories.length; i++) {
      const sub = subcategories[i];
      if (i % 2 === 0) {
        doc.rect(startX, rowY - 1, CONTENT_WIDTH, 20).fill(COLORS.bgLight);
      }
      const levelColor = this.getLevelColor(sub.level);
      this.applyTextStyle(doc, TYPOGRAPHY.caption)
        .text(sub.name, startX + 6, rowY + 2, { width: colWidths.name });
      this.applyTextStyle(doc, TYPOGRAPHY.caption, levelColor)
        .text(`${sub.score}`, startX + colWidths.name + 6, rowY + 2, { width: colWidths.score });
      this.applyTextStyle(doc, TYPOGRAPHY.caption, levelColor)
        .text(sub.level, startX + colWidths.name + colWidths.score + 6, rowY + 2, { width: colWidths.level });

      const evidenceText = sub.evidence || sub.mitigation || '—';
      const short = evidenceText.substring(0, 80) + (evidenceText.length > 80 ? '...' : '');
      this.applyTextStyle(doc, TYPOGRAPHY.caption, COLORS.textLight)
        .text(short, startX + colWidths.name + colWidths.score + colWidths.level + 6, rowY + 2, { width: colWidths.evidence });

      rowY += 22;
    }
    doc.y = rowY + SPACING.tableTopGap;
  }

  // ─── Recommendation Card ────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private renderRecommendationCard(doc: any, priority: string, text: string): void {
    const priorityColor = this.getPriorityColor(priority);
    const cardPadding = SPACING.cardPadding;
    const railWidth = 4;
    const textWidth = CONTENT_WIDTH - railWidth - cardPadding * 2 - 10;
    const textHeight = doc.heightOfString(text, { width: textWidth, lineGap: TYPOGRAPHY.bodySmall.lineGap });
    const cardHeight = textHeight + cardPadding * 2 + 14; // extra for badge

    this.ensureSpace(doc, cardHeight + SPACING.cardAfterGap);

    const cardY = doc.y;

    // Card background
    doc.roundedRect(MARGIN, cardY, CONTENT_WIDTH, cardHeight, 4).fill(COLORS.bgLight);
    // Left accent border
    doc.roundedRect(MARGIN, cardY, railWidth, cardHeight, 2).fill(priorityColor);

    // Priority badge
    const badgeWidth = 52;
    const contentX = MARGIN + railWidth + 6;
    doc.roundedRect(contentX + cardPadding, cardY + cardPadding, badgeWidth, 14, 7).fill(priorityColor);
    this.applyTextStyle(doc, TYPOGRAPHY.tableBadge)
      .text(priority, contentX + cardPadding, cardY + cardPadding + 3, { width: badgeWidth, align: 'center' });

    // Recommendation text
    this.applyTextStyle(doc, TYPOGRAPHY.bodySmall)
      .text(text, contentX + cardPadding, cardY + cardPadding + 18, {
        width: textWidth,
        lineGap: TYPOGRAPHY.bodySmall.lineGap,
      });

    this.lastCategoryRecommendationLayoutMetrics = {
      recommendationRailWidth: railWidth,
      recommendationPadding: cardPadding,
      radarBottomY: 262,
      overviewRowHeight: 28,
      subcategoryRowHeight: 30,
    };

    doc.y = cardY + cardHeight + SPACING.cardAfterGap;
  }

  // ─── All Recommendations ────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private renderAllRecommendations(doc: any, report: ReportResponse): void {
    doc.x = MARGIN;
    this.markCurrentPage(doc);
    this.collectTocEntry('All Recommendations', this.getCurrentPageIndex(doc), 0);
    this.renderPageHeader(doc, 'All Recommendations');

    const allRecs = report.categories.flatMap((c) =>
      c.recommendations.map((r) => ({
        category: this.formatCategoryName(c.category),
        text: r.isEdited && r.editedText ? r.editedText : r.text,
        priority: r.priority as string,
      })),
    );

    const priorities = ['HIGH', 'MEDIUM', 'LOW'] as const;
    for (const priority of priorities) {
      const filtered = allRecs.filter((r) => r.priority === priority);
      if (filtered.length === 0) continue;

      this.ensureSpace(doc, 50);
      const priorityColor = this.getPriorityColor(priority);

      // Priority section header
      const headerY = doc.y;
      doc.roundedRect(MARGIN, headerY, CONTENT_WIDTH, 22, 3).fill(this.getPriorityBg(priority));
      doc.roundedRect(MARGIN, headerY, 3, 22, 2).fill(priorityColor);

      const badgeW = 52;
      doc.roundedRect(MARGIN + 10, headerY + 4, badgeW, 14, 7).fill(priorityColor);
      this.applyTextStyle(doc, TYPOGRAPHY.tableBadge)
        .text(priority, MARGIN + 10, headerY + 7, { width: badgeW, align: 'center' });

      this.applyTextStyle(doc, TYPOGRAPHY.bodySmall)
        .text(`${filtered.length} recommendation${filtered.length !== 1 ? 's' : ''}`, MARGIN + 70, headerY + 6);

      doc.y = headerY + SPACING.priorityHeaderGap;

      for (const rec of filtered) {
        this.ensureSpace(doc, 35);
        const recY = doc.y;

        // Category tag
        this.applyTextStyle(doc, TYPOGRAPHY.captionSmall)
          .text(rec.category, MARGIN + 5, recY);

        // Recommendation text
        this.applyTextStyle(doc, TYPOGRAPHY.bodySmall)
          .text(rec.text, MARGIN + 5, doc.y, {
            width: CONTENT_WIDTH - 10,
            lineGap: TYPOGRAPHY.bodySmall.lineGap,
          });

        // Separator
        doc.moveTo(MARGIN, doc.y + 4)
          .lineTo(PAGE_WIDTH - MARGIN, doc.y + 4)
          .strokeColor(COLORS.borderLight).lineWidth(0.5).stroke();

        doc.y += SPACING.itemGap;
      }
      doc.moveDown(SPACING.subsectionBlockGap);
    }
  }

  // ─── Action Plan ─────────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private renderActionPlan(doc: any, items: ActionPlanItem[]): void {
    doc.x = MARGIN;
    this.markCurrentPage(doc);
    const pageIndex = this.getCurrentPageIndex(doc);
    this.collectTocEntry('Action Plan', pageIndex, 0);
    this.renderPageHeader(doc, 'Action Plan');

    const timeframeOrder: ActionPlanTimeframe[] = ['IMMEDIATE', 'SHORT_TERM', 'MEDIUM_TERM'];
    const timeframeLabels: Record<ActionPlanTimeframe, string> = {
      IMMEDIATE: 'Immediate (0-3 months)',
      SHORT_TERM: 'Short-term (3-6 months)',
      MEDIUM_TERM: 'Medium-term (6-12 months)',
    };
    const timeframeBackgrounds: Record<ActionPlanTimeframe, string> = {
      IMMEDIATE: COLORS.criticalBg,
      SHORT_TERM: COLORS.moderateBg,
      MEDIUM_TERM: COLORS.lowBg,
    };
    const timeframeAccents: Record<ActionPlanTimeframe, string> = {
      IMMEDIATE: COLORS.critical,
      SHORT_TERM: COLORS.moderate,
      MEDIUM_TERM: COLORS.low,
    };

    const timeframeGroups = timeframeOrder
      .map((timeframe) => ({
        timeframe,
        items: items.filter((item) => item.timeframe === timeframe),
      }))
      .filter((group) => group.items.length > 0);

    timeframeGroups.forEach((group) => {
      this.ensureSpace(doc, 54);
      const headerY = doc.y;
      const accent = timeframeAccents[group.timeframe];
      const background = timeframeBackgrounds[group.timeframe];
      const countText = `${group.items.length} action${group.items.length === 1 ? '' : 's'}`;

      doc.roundedRect(MARGIN, headerY, CONTENT_WIDTH, 24, 4).fill(background);
      doc.roundedRect(MARGIN, headerY, 4, 24, 2).fill(accent);

      this.applyTextStyle(doc, TYPOGRAPHY.bodyStrong)
        .text(timeframeLabels[group.timeframe], MARGIN + 12, headerY + 7, { width: 220 });
      this.applyTextStyle(doc, TYPOGRAPHY.bodySmall, accent)
        .text(countText, PAGE_WIDTH - MARGIN - 90, headerY + 7, { width: 78, align: 'right' });

      doc.y = headerY + 32;

      group.items.forEach((item) => {
        const priorityColor = this.getPriorityColor(item.priority);
        const priorityBg = this.getPriorityBg(item.priority);
        const badgeHeight = 16;
        const badgeGap = 8;
        const textWidth = CONTENT_WIDTH - 24;
        const textHeight = doc.heightOfString(item.text, {
          width: textWidth,
          lineGap: TYPOGRAPHY.bodySmall.lineGap,
        });
        const cardHeight = 16 + badgeHeight + textHeight + 24;

        this.ensureSpace(doc, cardHeight + 8);
        const cardY = doc.y;

        doc.roundedRect(MARGIN, cardY, CONTENT_WIDTH, cardHeight, 5).fill(COLORS.bgLight);
        doc.roundedRect(MARGIN, cardY, 4, cardHeight, 2).fill(accent);

        const timeframeBadgeWidth = 100;
        const priorityBadgeWidth = 58;
        const categoryBadgeX = MARGIN + 12 + timeframeBadgeWidth + badgeGap + priorityBadgeWidth + badgeGap;
        const categoryBadgeWidth = Math.min(150, Math.max(70, doc.widthOfString(this.formatCategoryName(item.category)) + 18));

        doc.roundedRect(MARGIN + 12, cardY + 12, timeframeBadgeWidth, badgeHeight, 8).fill(accent);
        this.applyTextStyle(doc, TYPOGRAPHY.tableBadge)
          .text(this.formatFieldLabel(group.timeframe), MARGIN + 12, cardY + 16, { width: timeframeBadgeWidth, align: 'center' });

        doc.roundedRect(MARGIN + 12 + timeframeBadgeWidth + badgeGap, cardY + 12, priorityBadgeWidth, badgeHeight, 8).fill(priorityBg);
        this.applyTextStyle(doc, TYPOGRAPHY.captionSmall, priorityColor)
          .text(item.priority, MARGIN + 12 + timeframeBadgeWidth + badgeGap, cardY + 16, { width: priorityBadgeWidth, align: 'center' });

        doc.roundedRect(categoryBadgeX, cardY + 12, categoryBadgeWidth, badgeHeight, 8).fill(COLORS.accentLight);
        this.applyTextStyle(doc, TYPOGRAPHY.captionSmall, COLORS.secondary)
          .text(this.formatCategoryName(item.category), categoryBadgeX + 6, cardY + 16, {
            width: categoryBadgeWidth - 12,
            align: 'center',
          });

        this.applyTextStyle(doc, TYPOGRAPHY.bodySmall)
          .text(item.text, MARGIN + 12, cardY + 12 + badgeHeight + 10, {
            width: textWidth,
            lineGap: TYPOGRAPHY.bodySmall.lineGap,
          });

        doc.y = cardY + cardHeight + 8;
      });

      doc.moveDown(SPACING.subsectionBlockGap);
    });

    this.lastActionPlanLayoutMetrics = {
      startPageIndex: pageIndex,
      timeframeGroups: timeframeGroups.map((group) => ({
        timeframe: group.timeframe,
        count: group.items.length,
      })),
    };
  }

  // ─── Appendix ────────────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private renderAppendix(doc: any, report: ReportResponse, cfg?: ReportConfig): void {
    doc.x = MARGIN;
    this.markCurrentPage(doc);
    const pageIndex = this.getCurrentPageIndex(doc);
    this.collectTocEntry('Appendix', pageIndex, 0);
    this.renderPageHeader(doc, 'Appendix');

    const documentSources = report.documentSources ?? [];
    const gapSummary = report.gapSummary ?? [];
    const evidenceCategories = cfg?.includeEvidenceTraces
      ? report.categories.filter((category) => category.evidence)
      : [];

    if (documentSources.length > 0) {
      this.renderSectionHeading(doc, 'Document Sources');
      this.renderAppendixTable(doc, [
        { key: 'fileName', label: 'Filename', width: 230 },
        { key: 'fileType', label: 'Type', width: 150 },
        { key: 'extractedLength', label: 'Extracted Chars', width: 125, align: 'right' },
      ], documentSources.map((source) => ({
        fileName: source.fileName,
        fileType: this.formatFileType(source.fileType),
        extractedLength: `${source.extractedLength}`,
      })));
      doc.moveDown(SPACING.subsectionBlockGap);
    }

    if (gapSummary.length > 0) {
      this.renderSectionHeading(doc, 'Gap Detection Summary');
      this.renderAppendixTable(doc, [
        { key: 'fieldKey', label: 'Field', width: 120 },
        { key: 'status', label: 'Status', width: 70 },
        { key: 'detectedValue', label: 'Detected Value', width: 145 },
        { key: 'correctedValue', label: 'Corrected Value', width: 145 },
      ], gapSummary.map((gap) => ({
        fieldKey: this.formatFieldLabel(gap.fieldKey),
        status: this.formatFieldLabel(gap.status),
        detectedValue: gap.detectedValue ?? '—',
        correctedValue: gap.correctedValue ?? '—',
      })));
      doc.moveDown(SPACING.subsectionBlockGap);
    }

    if (evidenceCategories.length > 0) {
      this.renderSectionHeading(doc, 'Detailed Evidence');
      // Clamp any single evidence block to one full page so a multi-page
      // category narrative cannot infinitely overflow. 60 ≈ section heading
      // (~24) + block padding/title (~26) + page bottom safety (~10).
      const MAX_EVIDENCE_HEIGHT = PAGE_HEIGHT - MARGIN * 2 - 60;
      evidenceCategories.forEach((category) => {
        const evidenceText = category.evidence ?? '';
        const measuredHeight = doc.heightOfString(evidenceText, {
          width: CONTENT_WIDTH - 24,
          lineGap: TYPOGRAPHY.bodySmall.lineGap,
        });
        const evidenceHeight = Math.min(measuredHeight, MAX_EVIDENCE_HEIGHT);
        const blockHeight = evidenceHeight + 34;
        this.ensureSpace(doc, blockHeight + 8);

        const blockY = doc.y;
        doc.roundedRect(MARGIN, blockY, CONTENT_WIDTH, blockHeight, 5).fill(COLORS.bgLight);
        doc.roundedRect(MARGIN, blockY, 4, blockHeight, 2).fill(COLORS.primary);
        this.applyTextStyle(doc, TYPOGRAPHY.bodyStrong)
          .text(this.formatCategoryName(category.category), MARGIN + 12, blockY + 10, { width: CONTENT_WIDTH - 24 });
        this.applyTextStyle(doc, TYPOGRAPHY.bodySmall)
          .text(evidenceText, MARGIN + 12, blockY + 26, {
            width: CONTENT_WIDTH - 24,
            height: evidenceHeight,
            lineGap: TYPOGRAPHY.bodySmall.lineGap,
            ellipsis: true,
          });

        doc.y = blockY + blockHeight + 8;
      });
    }

    this.lastAppendixLayoutMetrics = {
      startPageIndex: pageIndex,
      documentSourceCount: documentSources.length,
      gapSummaryCount: gapSummary.length,
      evidenceCategoryCount: evidenceCategories.length,
    };
  }

  // ─── Disclaimer ──────────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private renderDisclaimer(doc: any): void {
    doc.x = MARGIN;
    this.markCurrentPage(doc);
    const pageIndex = this.getCurrentPageIndex(doc);
    const currentYear = new Date().getFullYear();
    this.collectTocEntry('Disclaimer', pageIndex, 0);
    this.renderPageHeader(doc, 'Disclaimer');

    const sections = [
      {
        title: 'DISCLAIMER',
        body: 'This risk assessment report was generated using the CGIAR Agricultural Risk Intelligence Tool, which employs artificial intelligence to analyze business documents and evaluate risk across seven standardized categories.',
      },
      {
        title: 'DATA LIMITATIONS',
        body: 'The analysis is based solely on documents and information provided by or about the assessed entity. The completeness and accuracy of the assessment depend on the quality and completeness of input data. Areas where documentation was insufficient are noted in the Gap Detection summary.',
      },
      {
        title: 'AI-GENERATED CONTENT',
        body: 'Portions of this report, including the executive summary, key findings, and recommendations, were generated by AI models. While the AI applies domain expertise in agricultural risk assessment, all findings should be validated by qualified professionals before making investment or operational decisions.',
      },
      {
        title: 'CONFIDENTIALITY',
        body: 'This report contains confidential information intended solely for authorized recipients. Unauthorized distribution, copying, or disclosure is prohibited.',
      },
    ];

    sections.forEach((section) => {
      this.ensureSpace(doc, 90);
      this.renderSectionHeading(doc, section.title);
      this.applyTextStyle(doc, TYPOGRAPHY.bodySmall)
        .text(section.body, MARGIN, doc.y, {
          width: CONTENT_WIDTH,
          align: 'justify',
          lineGap: TYPOGRAPHY.bodySmall.lineGap,
        });
      doc.moveDown(SPACING.paragraphGap / 8);
      doc.x = MARGIN;
    });

    this.ensureSpace(doc, 70);
    doc.moveDown(SPACING.subsectionBlockGap);
    this.applyTextStyle(doc, TYPOGRAPHY.bodySmall)
      .text(
        'This report is intended as a decision-support tool and should be complemented by domain expert review and independent due diligence before finalizing any investment or partnership assessment.',
        MARGIN,
        doc.y,
        {
          width: CONTENT_WIDTH,
          align: 'justify',
          lineGap: TYPOGRAPHY.bodySmall.lineGap,
        },
      );
    doc.moveDown(SPACING.paragraphGap / 6);
    this.applyTextStyle(doc, TYPOGRAPHY.caption)
      .text(`© ${currentYear} CGIAR / Alliance of Bioversity International and CIAT`, MARGIN, doc.y, {
        width: CONTENT_WIDTH,
      });

    this.lastDisclaimerLayoutMetrics = {
      startPageIndex: pageIndex,
      sectionCount: sections.length,
      copyrightYear: currentYear,
    };
  }

  // ─── Analyst Commentary ─────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private renderAnalystCommentary(doc: any, comment: string): void {
    const boxPadding = SPACING.cardPadding;
    const textWidth = CONTENT_WIDTH - boxPadding * 2 - 5;
    const textHeight = doc.heightOfString(comment, { width: textWidth, lineGap: TYPOGRAPHY.analystBody.lineGap });
    const boxHeight = textHeight + boxPadding * 2 + 14;

    this.ensureSpace(doc, boxHeight + SPACING.smallTextOffset);

    const boxY = doc.y;

    // Header
    this.applyTextStyle(doc, TYPOGRAPHY.analystHeading)
      .text('Analyst Commentary', MARGIN, boxY);

    const contentY = doc.y + SPACING.analystHeaderGap;
    doc.roundedRect(MARGIN, contentY, CONTENT_WIDTH, textHeight + boxPadding * 2, 4).fill('#F0FDF4');
    doc.roundedRect(MARGIN, contentY, 3, textHeight + boxPadding * 2, 2).fill('#16A34A');

    this.applyTextStyle(doc, TYPOGRAPHY.analystBody)
      .text(comment, MARGIN + boxPadding + 5, contentY + boxPadding, {
        width: textWidth,
        lineGap: TYPOGRAPHY.analystBody.lineGap,
      });

    doc.y = contentY + textHeight + boxPadding * 2 + SPACING.tableTopGap;
  }

  // ─── Strengths & Weaknesses ─────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private renderStrengthsWeaknesses(doc: any, extras: ReportExtras): void {
    doc.x = MARGIN;
    this.markCurrentPage(doc);
    this.collectTocEntry('Strengths & Weaknesses', this.getCurrentPageIndex(doc), 0);
    this.renderPageHeader(doc, 'Strengths & Weaknesses');

    if (extras.strengths?.length) {
      this.renderSectionHeading(doc, 'Strengths');
      for (const item of extras.strengths) {
        this.ensureSpace(doc, 35);
        const y = doc.y;
        doc.circle(MARGIN + SPACING.bulletOffsetX, y + SPACING.bulletOffsetY, 3).fill(COLORS.low);
        this.applyTextStyle(doc, TYPOGRAPHY.bodySmall)
          .text(item, MARGIN + SPACING.bulletTextOffset, y, { width: CONTENT_WIDTH - SPACING.bulletTextOffset, lineGap: TYPOGRAPHY.bodySmall.lineGap });
        doc.moveDown(SPACING.sectionHeadingGap);
      }
      doc.moveDown(SPACING.strengthsGap);
    }

    if (extras.weaknesses?.length) {
      this.renderSectionHeading(doc, 'Weaknesses');
      for (const item of extras.weaknesses) {
        this.ensureSpace(doc, 35);
        const y = doc.y;
        doc.circle(MARGIN + SPACING.bulletOffsetX, y + SPACING.bulletOffsetY, 3).fill(COLORS.critical);
        this.applyTextStyle(doc, TYPOGRAPHY.bodySmall)
          .text(item, MARGIN + SPACING.bulletTextOffset, y, { width: CONTENT_WIDTH - SPACING.bulletTextOffset, lineGap: TYPOGRAPHY.bodySmall.lineGap });
        doc.moveDown(SPACING.sectionHeadingGap);
      }
    }
  }

  // ─── Methodology ────────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private renderMethodology(doc: any): void {
    doc.x = MARGIN;
    this.markCurrentPage(doc);
    this.collectTocEntry('Methodology', this.getCurrentPageIndex(doc), 0);
    this.renderPageHeader(doc, 'Methodology');

    // Intro paragraph — measure first so we never split it across a page break.
    const intro = 'This risk assessment was generated using the CGIAR Agricultural Risk Intelligence Tool, which employs AI-powered analysis across seven standardized risk categories.';
    const introHeight = doc.heightOfString(intro, {
      width: CONTENT_WIDTH,
      lineGap: TYPOGRAPHY.body.lineGap,
    });
    this.ensureSpace(doc, introHeight + 8);
    this.applyTextStyle(doc, TYPOGRAPHY.body)
      .text(intro, MARGIN, doc.y, { align: 'justify', lineGap: TYPOGRAPHY.body.lineGap, width: CONTENT_WIDTH });
    const introX = doc.x;
    doc.moveDown(SPACING.methodologyScaleGap);

    // ── Risk scale visual ────────────────────────────────────────────────
    // Keep the heading attached to at least the first scale row so it doesn't
    // get orphaned at the bottom of a page.
    this.ensureSpace(doc, 24 + 32 + 8);
    this.renderSectionHeading(doc, 'Risk Scoring Scale');
    const scales = [
      { level: 'LOW', range: '0–30', desc: 'Minimal risk exposure with adequate controls in place', color: COLORS.low, bg: COLORS.lowBg },
      { level: 'MODERATE', range: '31–60', desc: 'Some risk exposure requiring monitoring and mitigation', color: COLORS.moderate, bg: COLORS.moderateBg },
      { level: 'HIGH', range: '61–80', desc: 'Significant risk exposure requiring immediate attention', color: COLORS.high, bg: COLORS.highBg },
      { level: 'CRITICAL', range: '81–100', desc: 'Severe risk exposure demanding urgent intervention', color: COLORS.critical, bg: COLORS.criticalBg },
    ];

    // Badge needs to fit the longest label "CRITICAL (81–100)" at 8pt Helvetica-Bold,
    // so we widen from 70pt → 100pt and shift the description column accordingly.
    const scaleBadgeX = MARGIN + 12;
    const scaleBadgeWidth = 100;
    const scaleDescX = scaleBadgeX + scaleBadgeWidth + 10;
    const scaleDescWidth = CONTENT_WIDTH - (scaleDescX - MARGIN) - 12;

    for (const scale of scales) {
      // Each scale row is a fixed 32pt block — guard against falling across a
      // page break, which previously caused the badge text to overlap the
      // page footer.
      this.ensureSpace(doc, 32);
      const rowY = doc.y;
      doc.roundedRect(MARGIN, rowY, CONTENT_WIDTH, 28, 4).fill(scale.bg);
      doc.roundedRect(MARGIN, rowY, 3, 28, 2).fill(scale.color);

      // Badge
      doc.roundedRect(scaleBadgeX, rowY + 6, scaleBadgeWidth, 16, 8).fill(scale.color);
      this.applyTextStyle(doc, TYPOGRAPHY.tableHeader)
        .text(`${scale.level} (${scale.range})`, scaleBadgeX, rowY + 9, { width: scaleBadgeWidth, align: 'center', lineBreak: false });

      // Description
      this.applyTextStyle(doc, TYPOGRAPHY.bodySmall)
        .text(scale.desc, scaleDescX, rowY + 8, { width: scaleDescWidth });

      doc.y = rowY + 32;
      doc.x = MARGIN;
    }

    doc.moveDown(SPACING.methodologyScaleGap);

    const methodology = [
      'Each category contains 5 subcategories scored independently. Category scores represent the weighted assessment of subcategory indicators. The overall score is the simple average of all 7 category scores.',
      'Recommendations are prioritized as HIGH, MEDIUM, or LOW based on risk severity, implementation feasibility, and potential impact on business resilience.',
      'Data sources analyzed include uploaded business documents, gap detection field data, interview responses, and manual data entries. The AI model applies domain expertise in agricultural risk assessment to evaluate each indicator.',
      'This report is intended as a decision-support tool and should be complemented by domain expert review and on-ground assessment.',
    ];

    for (const para of methodology) {
      // Per-paragraph guard so a long paragraph never overruns the bottom of
      // the page and lands on top of the footer or the next paragraph.
      const paraHeight = doc.heightOfString(para, {
        width: CONTENT_WIDTH,
        lineGap: TYPOGRAPHY.bodySmall.lineGap,
      });
      this.ensureSpace(doc, paraHeight + 6);
      this.applyTextStyle(doc, TYPOGRAPHY.bodySmall)
        .text(para, MARGIN, doc.y, { align: 'justify', lineGap: TYPOGRAPHY.bodySmall.lineGap, width: CONTENT_WIDTH });
      doc.moveDown(SPACING.methodologyParagraphGap);
      doc.x = MARGIN;
    }

    this.lastMethodologyLayoutMetrics = {
      introX,
      introWidth: CONTENT_WIDTH,
      scaleDescriptionX: scaleDescX,
      scaleDescriptionWidth: scaleDescWidth,
      paragraphX: MARGIN,
      paragraphWidth: CONTENT_WIDTH,
      finalCursorX: doc.x,
    };
  }

  // ─── Drawing Helpers ────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private drawArc(doc: any, cx: number, cy: number, r: number, startDeg: number, endDeg: number, color: string, lineW: number): void {
    // Draw arc as a series of small line segments
    const startRad = (startDeg * Math.PI) / 180;
    const endRad = (endDeg * Math.PI) / 180;
    const segments = 30;
    const step = (endRad - startRad) / segments;

    doc.save();
    doc.strokeColor(color);
    doc.lineWidth(lineW);
    doc.lineCap('round');

    // Draw in smaller batches to avoid stack overflow
    for (let i = 0; i < segments; i++) {
      const a1 = startRad + i * step;
      const a2 = startRad + (i + 1) * step;
      doc.moveTo(cx + r * Math.cos(a1), cy + r * Math.sin(a1));
      doc.lineTo(cx + r * Math.cos(a2), cy + r * Math.sin(a2));
    }
    doc.stroke();
    doc.restore();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private renderPageHeader(doc: any, title: string): void {
    // Top accent bar
    doc.rect(0, 0, PAGE_WIDTH, SPACING.headerHeight + 1).fill(COLORS.primary);

    this.applyTextStyle(doc, TYPOGRAPHY.sectionTitle)
      .text(title, MARGIN, 30);

    // Divider
    const lineY = doc.y + SPACING.textBlockGap;
    doc.moveTo(MARGIN, lineY)
      .lineTo(PAGE_WIDTH - MARGIN, lineY)
      .strokeColor(COLORS.border).lineWidth(1).stroke();

    doc.y = lineY + SPACING.paragraphGap;
    doc.x = MARGIN;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private renderSectionHeading(doc: any, title: string): void {
    this.applyTextStyle(doc, TYPOGRAPHY.subsectionTitle, COLORS.secondary)
      .text(title, MARGIN, doc.y, { width: CONTENT_WIDTH });
    doc.moveDown(SPACING.sectionHeadingGap);
    doc.x = MARGIN;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private renderAppendixTable(
    doc: any,
    columns: Array<{ key: string; label: string; width: number; align?: 'left' | 'right' | 'center' }>,
    rows: Array<Record<string, string>>,
  ): void {
    const headerHeight = 18;
    const rowPaddingY = 6;
    const tableX = MARGIN;

    // Local helper: draw the column header bar at the current cursor position
    // and advance doc.y to just below it. Used both for the initial header and
    // for repeating it on continuation pages when a long table breaks.
    const drawHeader = (): void => {
      const headerY = doc.y;
      doc.roundedRect(tableX, headerY, CONTENT_WIDTH, headerHeight, 3).fill(COLORS.primary);

      let columnX = tableX;
      columns.forEach((column) => {
        this.applyTextStyle(doc, TYPOGRAPHY.tableBadge)
          .text(column.label, columnX + 6, headerY + 4, {
            width: column.width - 12,
            align: column.align ?? 'left',
          });
        columnX += column.width;
      });

      // doc.text() above advances doc.y as a side effect. Reset it to a known
      // position just below the header bar so the next row starts cleanly.
      doc.y = headerY + headerHeight + 4;
    };

    this.ensureSpace(doc, 28);
    drawHeader();
    let rowY = doc.y;

    rows.forEach((row, rowIndex) => {
      // Clamp row height to one full page so a pathologically long appendix
      // value (e.g. a multi-paragraph extracted Gap Detection field) cannot
      // overflow even after the header is redrawn on a continuation page.
      // 28 ≈ headerHeight (18) + the 4pt gap below + a small safety pad.
      // The text is visually clipped in extreme cases, which is acceptable
      // here — the appendix is a reference surface and the full content is
      // always available in the original source document.
      const MAX_ROW_HEIGHT = PAGE_HEIGHT - MARGIN * 2 - 28;

      const rowHeight = Math.min(
        Math.max(
          ...columns.map((column) => doc.heightOfString(row[column.key] ?? '—', {
            width: column.width - 12,
          })),
        ) + rowPaddingY * 2,
        MAX_ROW_HEIGHT,
      );

      // Detect whether ensureSpace triggered a page break so we can repeat the
      // column header on the new page.
      const pageCountBefore = doc.bufferedPageRange().count;
      this.ensureSpace(doc, rowHeight + 4);
      if (doc.bufferedPageRange().count > pageCountBefore) {
        drawHeader();
      }
      // After ensureSpace (and any page break + header redraw) doc.y is the
      // only authoritative cursor position. Sync rowY to it before drawing so
      // the row doesn't land at a stale coordinate from the previous page.
      rowY = doc.y;

      if (rowIndex % 2 === 0) {
        doc.rect(tableX, rowY, CONTENT_WIDTH, rowHeight).fill(COLORS.bgLight);
      }

      // Constrain each cell's text() to the row's interior height. Without
      // this, a long Detected/Corrected value whose actual rendered height
      // exceeds the clamped MAX_ROW_HEIGHT (or that PDFKit measures slightly
      // taller than heightOfString predicted) spills below the row and
      // overlaps the next row's top edge.
      const cellInteriorHeight = Math.max(0, rowHeight - rowPaddingY * 2);
      let cellX = tableX;
      columns.forEach((column) => {
        this.applyTextStyle(doc, TYPOGRAPHY.caption)
          .text(row[column.key] ?? '—', cellX + 6, rowY + rowPaddingY, {
            width: column.width - 12,
            height: cellInteriorHeight,
            align: column.align ?? 'left',
            ellipsis: true,
          });
        cellX += column.width;
      });

      rowY += rowHeight;
      doc.y = rowY + 2;
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private ensureSpace(doc: any, needed: number): void {
    if (doc.y + needed > PAGE_HEIGHT - SPACING.ensureSpaceBottom) {
      doc.addPage();
    }
  }

  private hasFinancialData(metrics: FinancialMetrics): boolean {
    return metrics.revenue.length > 0
      || metrics.costs.length > 0
      || metrics.margins.gross !== null
      || metrics.margins.operating !== null;
  }

  // ─── Color Helpers ──────────────────────────────────────────────────────────

  private getLevelColor(level: string): string {
    switch (level) {
      case 'LOW': return COLORS.low;
      case 'MODERATE': return COLORS.moderate;
      case 'HIGH': return COLORS.high;
      case 'CRITICAL': return COLORS.critical;
      default: return COLORS.textLight;
    }
  }

  private getLevelBg(level: string): string {
    switch (level) {
      case 'LOW': return COLORS.lowBg;
      case 'MODERATE': return COLORS.moderateBg;
      case 'HIGH': return COLORS.highBg;
      case 'CRITICAL': return COLORS.criticalBg;
      default: return COLORS.bgLight;
    }
  }

  private getPriorityColor(priority: string): string {
    switch (priority) {
      case 'HIGH': return COLORS.critical;
      case 'MEDIUM': return COLORS.moderate;
      case 'LOW': return COLORS.low;
      default: return COLORS.textLight;
    }
  }

  private getPriorityBg(priority: string): string {
    switch (priority) {
      case 'HIGH': return COLORS.criticalBg;
      case 'MEDIUM': return COLORS.moderateBg;
      case 'LOW': return COLORS.lowBg;
      default: return COLORS.bgLight;
    }
  }

  private getMarginColor(value: number): string {
    if (value >= 0.3) return COLORS.low;
    if (value >= 0.15) return COLORS.moderate;
    return COLORS.high;
  }

  private getMarginBg(value: number): string {
    if (value >= 0.3) return COLORS.lowBg;
    if (value >= 0.15) return COLORS.moderateBg;
    return COLORS.highBg;
  }

  private formatCurrencyCompact(value: number, currency?: string): string {
    const compactValue = Math.abs(value) >= 1000000
      ? `${(value / 1000000).toFixed(value % 1000000 === 0 ? 0 : 1)}M`
      : Math.abs(value) >= 1000
        ? `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}K`
        : `${Math.round(value)}`;

    if (currency === 'USD') return `$${compactValue}`;
    if (currency === 'EUR') return `EUR ${compactValue}`;
    if (currency === 'KES') return `KES ${compactValue}`;
    return currency ? `${currency} ${compactValue}` : compactValue;
  }

  private formatMargin(value: number | null): string {
    if (value === null) {
      return 'N/A';
    }

    return `${Math.round(value * 100)}%`;
  }

  private formatCategoryName(category: string): string {
    return category
      .replace(/_/g, ' ')
      .split(' ')
      .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
      .join(' ')
      .replace('And', '&');
  }

  /**
   * Render an enum / snake_case identifier as a human-readable label.
   * - "workforce_summary" → "Workforce Summary"
   * - "supply_chain_overview" → "Supply Chain Overview"
   * - "VERIFIED" → "Verified"
   * - "MEDIUM_TERM" → "Medium-Term" (action plan timeframes use a hyphen)
   * - "SHORT_TERM" → "Short-Term"
   * - "IMMEDIATE" → "Immediate"
   *
   * Used wherever Gap Detection field names / statuses or Action Plan
   * timeframe enums would otherwise leak into the PDF as raw SCREAMING_SNAKE.
   */
  private formatFieldLabel(value: string | null | undefined): string {
    if (!value) return '';
    const specialCases: Record<string, string> = {
      MEDIUM_TERM: 'Medium-Term',
      SHORT_TERM: 'Short-Term',
      IMMEDIATE: 'Immediate',
    };
    if (Object.prototype.hasOwnProperty.call(specialCases, value)) {
      return specialCases[value];
    }
    return value
      .split('_')
      .map((word) => (word.length === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()))
      .join(' ');
  }

  /**
   * Map a MIME type to a short, human-friendly label that fits inside the
   * Document Sources table without truncation. Falls back to the raw value
   * for unknown types so we never silently drop information.
   */
  private formatFileType(mimeType: string | null | undefined): string {
    if (!mimeType) return '';
    const mimeLabels: Record<string, string> = {
      'application/pdf': 'PDF',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel (.xlsx)',
      'application/vnd.ms-excel': 'Excel (.xls)',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word (.docx)',
      'application/msword': 'Word (.doc)',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint (.pptx)',
      'application/vnd.ms-powerpoint': 'PowerPoint (.ppt)',
      'text/csv': 'CSV',
      'text/plain': 'Text',
      'text/markdown': 'Markdown',
      'image/png': 'PNG',
      'image/jpeg': 'JPEG',
      'image/jpg': 'JPEG',
      'image/gif': 'GIF',
      'image/webp': 'WebP',
    };
    return mimeLabels[mimeType] ?? mimeType;
  }

  private shortCategoryName(category: string): string {
    const full = this.formatCategoryName(category);
    // Abbreviate for chart labels
    return full
      .replace('Climate Environmental', 'Climate')
      .replace('Governance Legal', 'Governance')
      .replace('Technology Data', 'Technology');
  }

  private heatmapCategoryLabel(category: string): string {
    switch (category) {
      case 'FINANCIAL': return 'FIN';
      case 'CLIMATE_ENVIRONMENTAL': return 'CLI';
      case 'BEHAVIORAL': return 'BEH';
      case 'OPERATIONAL': return 'OPS';
      case 'MARKET': return 'MKT';
      case 'MARKET_COMMERCIAL': return 'MKT';
      case 'GOVERNANCE_LEGAL': return 'GOV';
      case 'TECHNOLOGY_DATA': return 'TEC';
      case 'BUSINESS_MODEL': return 'BUS';
      default: return category.slice(0, 3).toUpperCase();
    }
  }
}
