import { Injectable, Logger } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');
import type { ReportResponse, SubcategoryScore, ReportConfig } from '@alliance-risk/shared';

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

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

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

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const cfg = reportConfig;

      // ── Page 1: Title Page ──
      this.renderTitlePage(doc, report);

      // ── Page 2: Executive Summary ──
      doc.addPage();
      this.renderExecutiveSummary(doc, report, extras);

      // ── Page 3: Risk Overview (Radar + Table) ──
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
      if (!cfg || cfg.includeRecommendations) {
        doc.addPage();
        this.renderAllRecommendations(doc, report);
      }

      // ── Strengths & Weaknesses ──
      if (extras?.strengths?.length || extras?.weaknesses?.length) {
        doc.addPage();
        this.renderStrengthsWeaknesses(doc, extras);
      }

      // ── Methodology ──
      if (!cfg || cfg.includeMethodology) {
        doc.addPage();
        this.renderMethodology(doc);
      }

      // Render footers on all pages (using buffered pages to avoid recursion)
      this.renderAllFooters(doc);

      doc.end();
    });
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
  private renderAllFooters(doc: any): void {
    const pages = doc.bufferedPageRange();
    for (let i = 1; i < pages.count; i++) { // skip title page (index 0)
      doc.switchToPage(i);

      // Separator line only (no text to avoid triggering page overflow)
      doc.save();
      doc.moveTo(MARGIN, FOOTER_Y - 8);
      doc.lineTo(PAGE_WIDTH - MARGIN, FOOTER_Y - 8);
      doc.strokeColor(COLORS.border);
      doc.lineWidth(0.5);
      doc.stroke();
      doc.restore();

      // Use _fragment approach: position text precisely without triggering reflow
      const savedX = doc.x;
      const savedY = doc.y;
      doc.fontSize(7).fillColor(COLORS.textMuted);
      doc.text('CONFIDENTIAL', MARGIN, FOOTER_Y, { width: 120, lineBreak: false });
      doc.text(`Page ${i}`, PAGE_WIDTH - MARGIN - 50, FOOTER_Y, { width: 50, align: 'right', lineBreak: false });
      doc.x = savedX;
      doc.y = savedY;
    }
  }

  // ─── Title Page ─────────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private renderTitlePage(doc: any, report: ReportResponse): void {
    // Top banner
    doc.rect(0, 0, PAGE_WIDTH, 100).fill(COLORS.primary);

    // Banner text
    doc.fontSize(10).fillColor(COLORS.accentLight)
      .text('CGIAR', MARGIN, 30, { width: CONTENT_WIDTH, align: 'center' });
    doc.fontSize(16).fillColor(COLORS.white)
      .text('Agricultural Risk Intelligence Tool', MARGIN, 48, { width: CONTENT_WIDTH, align: 'center' });

    // Accent line under banner
    doc.rect(0, 100, PAGE_WIDTH, 3).fill(COLORS.accent);

    // Title
    doc.moveDown(2);
    doc.y = 140;
    doc.fontSize(11).fillColor(COLORS.textLight)
      .text('RISK INTELLIGENCE REPORT', MARGIN, 140, { width: CONTENT_WIDTH, align: 'center', characterSpacing: 4 });

    doc.moveDown(1.5);

    // Company name
    doc.fontSize(28).fillColor(COLORS.text)
      .text(report.assessment.companyName, MARGIN, doc.y, { width: CONTENT_WIDTH, align: 'center' });

    doc.moveDown(0.4);

    // Company details
    const details = [report.assessment.companyType, report.assessment.country].filter(Boolean).join(' · ');
    doc.fontSize(13).fillColor(COLORS.textLight)
      .text(details, MARGIN, doc.y, { width: CONTENT_WIDTH, align: 'center' });

    doc.moveDown(3);

    // ── Score Gauge ──
    const gaugeY = doc.y + 10;
    const gaugeCx = PAGE_WIDTH / 2;
    const gaugeR = 70;
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
    doc.fontSize(42).fillColor(levelColor)
      .text(`${score}`, gaugeCx - 50, gaugeY - 28, { width: 100, align: 'center' });
    doc.fontSize(11).fillColor(COLORS.textLight)
      .text('out of 100', gaugeCx - 50, gaugeY + 22, { width: 100, align: 'center' });

    // Level badge
    const badgeWidth = 90;
    const badgeX = gaugeCx - badgeWidth / 2;
    const badgeY = gaugeY + 50;
    doc.roundedRect(badgeX, badgeY, badgeWidth, 24, 12).fill(this.getLevelBg(report.overallLevel));
    doc.roundedRect(badgeX, badgeY, badgeWidth, 24, 12).strokeColor(levelColor).lineWidth(1).stroke();
    doc.fontSize(10).fillColor(levelColor)
      .text(report.overallLevel, badgeX, badgeY + 7, { width: badgeWidth, align: 'center' });

    doc.y = badgeY + 55;

    // ── Mini category scores row ──
    doc.moveDown(2);
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
      doc.fontSize(9).fillColor(catColor)
        .text(`${cat.score}`, cx - 15, miniY - 5, { width: 30, align: 'center' });

      // Label
      const shortLabel = this.shortCategoryName(cat.category);
      doc.fontSize(6).fillColor(COLORS.textLight)
        .text(shortLabel, cx - 30, miniY + 23, { width: 60, align: 'center' });
    }

    // ── Date and metadata ──
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    doc.fontSize(9).fillColor(COLORS.textMuted)
      .text(`Generated: ${dateStr}`, MARGIN, PAGE_HEIGHT - 100, { width: CONTENT_WIDTH, align: 'center' });

    // Bottom accent bar
    doc.rect(0, PAGE_HEIGHT - 6, PAGE_WIDTH, 6).fill(COLORS.primary);
  }

  // ─── Executive Summary ──────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private renderExecutiveSummary(doc: any, report: ReportResponse, extras?: ReportExtras): void {
    this.renderPageHeader(doc, 'Executive Summary');

    // Summary text in a tinted box
    const summaryPadding = 14;
    const summaryTextWidth = CONTENT_WIDTH - summaryPadding * 2;
    const summaryHeight = doc.heightOfString(report.executiveSummary, {
      width: summaryTextWidth, lineGap: 4,
    }) + summaryPadding * 2;

    const boxY = doc.y;
    doc.roundedRect(MARGIN, boxY, CONTENT_WIDTH, summaryHeight, 6).fill(COLORS.bgTeal);
    doc.roundedRect(MARGIN, boxY, 3, summaryHeight, 2).fill(COLORS.primary);

    doc.fontSize(10.5).fillColor(COLORS.text)
      .text(report.executiveSummary, MARGIN + summaryPadding, boxY + summaryPadding, {
        width: summaryTextWidth, align: 'justify', lineGap: 4,
      });

    doc.y = boxY + summaryHeight + 15;

    // Key Findings
    if (extras?.keyFindings?.length) {
      this.renderSectionHeading(doc, 'Key Findings');
      for (const finding of extras.keyFindings) {
        this.ensureSpace(doc, 40);
        // Bullet with accent color
        const bulletY = doc.y;
        doc.circle(MARGIN + 8, bulletY + 5, 2.5).fill(COLORS.accent);
        doc.fontSize(9.5).fillColor(COLORS.text)
          .text(finding, MARGIN + 18, bulletY, {
            width: CONTENT_WIDTH - 18, lineGap: 3,
          });
        doc.moveDown(0.3);
      }
    }
  }

  // ─── Risk Overview (Radar + Table) ──────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private renderRiskOverview(doc: any, report: ReportResponse, cfg?: ReportConfig): void {
    this.renderPageHeader(doc, 'Risk Overview');

    // Radar chart
    if (!cfg || cfg.includeRadarChart) {
      this.renderRadarChart(doc, report.categories);
      doc.moveDown(1);
    }

    // Category overview table
    this.renderOverviewTable(doc, report);
  }

  // ─── Radar Chart ────────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private renderRadarChart(doc: any, categories: ReportResponse['categories']): void {
    const cx = PAGE_WIDTH / 2;
    const cy = doc.y + 140;
    const R = 110;
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
      const lp = getPoint(i, R + 25);
      const label = this.shortCategoryName(categories[i].category);
      const scoreLabel = `${categories[i].score}`;

      let align: 'center' | 'left' | 'right' = 'center';
      const labelWidth = 70;
      const cosAngle = Math.cos((2 * Math.PI * i) / n - Math.PI / 2);
      let lx = lp.x - labelWidth / 2;
      if (cosAngle < -0.3) align = 'right';
      else if (cosAngle > 0.3) align = 'left';
      const ly = lp.y - 6;

      doc.fontSize(8).fillColor(COLORS.text)
        .text(label, lx, ly, { width: labelWidth, align });
      doc.fontSize(7).fillColor(catColor)
        .text(scoreLabel, lx, ly + 10, { width: labelWidth, align });
    }

    doc.y = cy + R + 50;
  }

  // ─── Overview Table ─────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private renderOverviewTable(doc: any, report: ReportResponse): void {
    this.ensureSpace(doc, 240);

    const startX = MARGIN;
    const colWidths = { category: 140, bar: 170, score: 50, level: 60, narrative: CONTENT_WIDTH - 420 };
    const rowHeight = 26;
    const headerHeight = 22;

    // Header
    const tableTop = doc.y + 5;
    doc.roundedRect(startX, tableTop, CONTENT_WIDTH, headerHeight, 3).fill(COLORS.primary);
    doc.fontSize(8).fillColor(COLORS.white)
      .text('Category', startX + 10, tableTop + 6, { width: colWidths.category })
      .text('Risk Score', startX + colWidths.category + 10, tableTop + 6, { width: colWidths.bar })
      .text('Score', startX + colWidths.category + colWidths.bar + 5, tableTop + 6, { width: colWidths.score, align: 'center' })
      .text('Level', startX + colWidths.category + colWidths.bar + colWidths.score + 5, tableTop + 6, { width: colWidths.level, align: 'center' });

    let rowY = tableTop + headerHeight + 4;
    for (let i = 0; i < report.categories.length; i++) {
      const cat = report.categories[i];
      const levelColor = this.getLevelColor(cat.level);

      // Alternate row bg
      if (i % 2 === 0) {
        doc.rect(startX, rowY - 2, CONTENT_WIDTH, rowHeight).fill(COLORS.bgLight);
      }

      // Category name
      doc.fontSize(9).fillColor(COLORS.text)
        .text(this.formatCategoryName(cat.category), startX + 10, rowY + 4, { width: colWidths.category });

      // Mini progress bar
      const barX = startX + colWidths.category + 10;
      const barY = rowY + 8;
      const barWidth = colWidths.bar - 20;
      const barHeight = 10;
      doc.roundedRect(barX, barY, barWidth, barHeight, 3).fill(COLORS.borderLight);
      const fillWidth = (cat.score / 100) * barWidth;
      if (fillWidth > 0) {
        doc.roundedRect(barX, barY, fillWidth, barHeight, 3).fill(levelColor);
      }

      // Score
      doc.fontSize(9).fillColor(levelColor)
        .text(`${cat.score}`, startX + colWidths.category + colWidths.bar + 5, rowY + 4, { width: colWidths.score, align: 'center' });

      // Level badge
      const levelX = startX + colWidths.category + colWidths.bar + colWidths.score + 5;
      const badgeW = 58;
      const badgePad = (colWidths.level - badgeW) / 2;
      doc.roundedRect(levelX + badgePad, rowY + 3, badgeW, 18, 9).fill(this.getLevelBg(cat.level));
      doc.fontSize(7).fillColor(levelColor)
        .text(cat.level, levelX + badgePad, rowY + 7, { width: badgeW, align: 'center' });

      rowY += rowHeight;
    }

    doc.y = rowY + 10;
  }

  // ─── Category Detail Page ───────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private renderCategoryPage(doc: any, category: ReportResponse['categories'][number], cfg?: ReportConfig): void {
    const categoryLabel = this.formatCategoryName(category.category);
    this.renderPageHeader(doc, categoryLabel);

    // Score banner
    this.renderScoreBanner(doc, category.score, category.level);
    // Reset x to margin after banner (banner text can shift it)
    doc.x = MARGIN;
    doc.moveDown(0.5);

    // Narrative
    if (category.narrative) {
      doc.fontSize(10).fillColor(COLORS.text)
        .text(category.narrative, MARGIN, doc.y, { align: 'justify', lineGap: 3, width: CONTENT_WIDTH });
      doc.moveDown(0.8);
    }

    // Evidence
    if ((!cfg || cfg.includeEvidenceTraces) && category.evidence) {
      this.renderSectionHeading(doc, 'Evidence');
      doc.fontSize(9).fillColor(COLORS.textLight)
        .text(category.evidence, MARGIN, doc.y, { align: 'justify', lineGap: 2, width: CONTENT_WIDTH });
      doc.moveDown(0.8);
    }

    // Analyst Commentary
    if (category.analystComment) {
      this.renderAnalystCommentary(doc, category.analystComment);
      doc.moveDown(0.8);
    }

    // Subcategory bar chart
    if (category.subcategories.length > 0) {
      if (!cfg || cfg.includeSubcategoryCharts) {
        this.renderSubcategoryBars(doc, category.subcategories);
      } else {
        this.renderSubcategoryTable(doc, category.subcategories);
      }
      doc.moveDown(0.5);
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
    doc.fontSize(26).fillColor(levelColor)
      .text(`${score}`, MARGIN + 15, bannerY + 8, { width: 70, lineBreak: false });
    doc.fontSize(11).fillColor(COLORS.textLight)
      .text('/100', MARGIN + 75, bannerY + 18, { width: 30, lineBreak: false });

    // Level badge
    const badgeWidth = 80;
    const badgeX = MARGIN + 110;
    doc.roundedRect(badgeX, bannerY + 14, badgeWidth, 22, 11).fill(levelColor);
    doc.fontSize(9).fillColor(COLORS.white)
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
      doc.fontSize(6).fillColor(COLORS.textMuted)
        .text(`${t}`, tx - 8, barY + 13, { width: 16, align: 'center' });
    }

    doc.x = MARGIN;
    doc.y = bannerY + bannerHeight + 8;
  }

  // ─── Subcategory Bar Chart ──────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private renderSubcategoryBars(doc: any, subcategories: SubcategoryScore[]): void {
    this.ensureSpace(doc, subcategories.length * 30 + 25);
    this.renderSectionHeading(doc, 'Subcategory Scores');

    const labelWidth = 140;
    const barMaxWidth = CONTENT_WIDTH - labelWidth - 60;
    const rowHeight = 28;

    for (const sub of subcategories) {
      const rowY = doc.y;
      const levelColor = this.getLevelColor(sub.level);

      // Label
      doc.fontSize(9).fillColor(COLORS.text)
        .text(sub.name, MARGIN, rowY + 4, { width: labelWidth });

      // Bar background
      const barX = MARGIN + labelWidth + 5;
      const barY = rowY + 6;
      const barHeight = 14;
      doc.roundedRect(barX, barY, barMaxWidth, barHeight, 4).fill(COLORS.borderLight);

      // Bar fill
      const fillW = Math.max((sub.score / 100) * barMaxWidth, 4);
      doc.roundedRect(barX, barY, fillW, barHeight, 4).fill(levelColor);

      // Score text inside bar (or outside if too small)
      const scoreText = `${sub.score}`;
      if (fillW > 30) {
        doc.fontSize(8).fillColor(COLORS.white)
          .text(scoreText, barX + fillW - 25, barY + 2, { width: 22, align: 'right' });
      } else {
        doc.fontSize(8).fillColor(levelColor)
          .text(scoreText, barX + fillW + 4, barY + 2, { width: 30 });
      }

      // Level badge
      const badgeX = MARGIN + CONTENT_WIDTH - 50;
      doc.fontSize(7).fillColor(levelColor)
        .text(sub.level, badgeX, rowY + 6, { width: 50 });

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
    doc.fontSize(7).fillColor(COLORS.white)
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
      doc.fontSize(8).fillColor(COLORS.text)
        .text(sub.name, startX + 6, rowY + 2, { width: colWidths.name });
      doc.fillColor(levelColor)
        .text(`${sub.score}`, startX + colWidths.name + 6, rowY + 2, { width: colWidths.score });
      doc.fillColor(levelColor)
        .text(sub.level, startX + colWidths.name + colWidths.score + 6, rowY + 2, { width: colWidths.level });

      const evidenceText = sub.evidence || sub.mitigation || '—';
      const short = evidenceText.substring(0, 80) + (evidenceText.length > 80 ? '...' : '');
      doc.fillColor(COLORS.textLight)
        .text(short, startX + colWidths.name + colWidths.score + colWidths.level + 6, rowY + 2, { width: colWidths.evidence });

      rowY += 22;
    }
    doc.y = rowY + 5;
  }

  // ─── Recommendation Card ────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private renderRecommendationCard(doc: any, priority: string, text: string): void {
    const priorityColor = this.getPriorityColor(priority);
    const cardPadding = 10;
    const textWidth = CONTENT_WIDTH - cardPadding * 2 - 8;
    const textHeight = doc.heightOfString(text, { width: textWidth, lineGap: 2 });
    const cardHeight = textHeight + cardPadding * 2 + 14; // extra for badge

    this.ensureSpace(doc, cardHeight + 4);

    const cardY = doc.y;

    // Card background
    doc.roundedRect(MARGIN, cardY, CONTENT_WIDTH, cardHeight, 4).fill(COLORS.bgLight);
    // Left accent border
    doc.roundedRect(MARGIN, cardY, 3, cardHeight, 2).fill(priorityColor);

    // Priority badge
    const badgeWidth = 52;
    doc.roundedRect(MARGIN + cardPadding + 5, cardY + cardPadding, badgeWidth, 14, 7).fill(priorityColor);
    doc.fontSize(7).fillColor(COLORS.white)
      .text(priority, MARGIN + cardPadding + 5, cardY + cardPadding + 3, { width: badgeWidth, align: 'center' });

    // Recommendation text
    doc.fontSize(9).fillColor(COLORS.text)
      .text(text, MARGIN + cardPadding + 5, cardY + cardPadding + 18, {
        width: textWidth, lineGap: 2,
      });

    doc.y = cardY + cardHeight + 4;
  }

  // ─── All Recommendations ────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private renderAllRecommendations(doc: any, report: ReportResponse): void {
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
      doc.fontSize(7).fillColor(COLORS.white)
        .text(priority, MARGIN + 10, headerY + 7, { width: badgeW, align: 'center' });

      doc.fontSize(9).fillColor(COLORS.text)
        .text(`${filtered.length} recommendation${filtered.length !== 1 ? 's' : ''}`, MARGIN + 70, headerY + 6);

      doc.y = headerY + 30;

      for (const rec of filtered) {
        this.ensureSpace(doc, 35);
        const recY = doc.y;

        // Category tag
        doc.fontSize(7).fillColor(COLORS.textMuted)
          .text(rec.category, MARGIN + 5, recY);

        // Recommendation text
        doc.fontSize(9).fillColor(COLORS.text)
          .text(rec.text, MARGIN + 5, doc.y, {
            width: CONTENT_WIDTH - 10, lineGap: 2,
          });

        // Separator
        doc.moveTo(MARGIN, doc.y + 4)
          .lineTo(PAGE_WIDTH - MARGIN, doc.y + 4)
          .strokeColor(COLORS.borderLight).lineWidth(0.5).stroke();

        doc.y += 8;
      }
      doc.moveDown(0.5);
    }
  }

  // ─── Analyst Commentary ─────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private renderAnalystCommentary(doc: any, comment: string): void {
    const boxPadding = 12;
    const textWidth = CONTENT_WIDTH - boxPadding * 2 - 5;
    const textHeight = doc.heightOfString(comment, { width: textWidth, lineGap: 3 });
    const boxHeight = textHeight + boxPadding * 2 + 14;

    this.ensureSpace(doc, boxHeight + 10);

    const boxY = doc.y;

    // Header
    doc.fontSize(9).fillColor(COLORS.secondary)
      .font('Helvetica-Bold')
      .text('Analyst Commentary', MARGIN, boxY);
    doc.font('Helvetica');

    const contentY = doc.y + 4;
    doc.roundedRect(MARGIN, contentY, CONTENT_WIDTH, textHeight + boxPadding * 2, 4).fill('#F0FDF4');
    doc.roundedRect(MARGIN, contentY, 3, textHeight + boxPadding * 2, 2).fill('#16A34A');

    doc.font('Helvetica-Oblique')
      .fontSize(9).fillColor('#15803D')
      .text(comment, MARGIN + boxPadding + 5, contentY + boxPadding, {
        width: textWidth, lineGap: 3,
      });

    doc.font('Helvetica');
    doc.y = contentY + textHeight + boxPadding * 2 + 5;
  }

  // ─── Strengths & Weaknesses ─────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private renderStrengthsWeaknesses(doc: any, extras: ReportExtras): void {
    this.renderPageHeader(doc, 'Strengths & Weaknesses');

    if (extras.strengths?.length) {
      this.renderSectionHeading(doc, 'Strengths');
      for (const item of extras.strengths) {
        this.ensureSpace(doc, 35);
        const y = doc.y;
        doc.circle(MARGIN + 8, y + 5, 3).fill(COLORS.low);
        doc.fontSize(9).fillColor(COLORS.text)
          .text(item, MARGIN + 18, y, { width: CONTENT_WIDTH - 18, lineGap: 2 });
        doc.moveDown(0.3);
      }
      doc.moveDown(1);
    }

    if (extras.weaknesses?.length) {
      this.renderSectionHeading(doc, 'Weaknesses');
      for (const item of extras.weaknesses) {
        this.ensureSpace(doc, 35);
        const y = doc.y;
        doc.circle(MARGIN + 8, y + 5, 3).fill(COLORS.critical);
        doc.fontSize(9).fillColor(COLORS.text)
          .text(item, MARGIN + 18, y, { width: CONTENT_WIDTH - 18, lineGap: 2 });
        doc.moveDown(0.3);
      }
    }
  }

  // ─── Methodology ────────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private renderMethodology(doc: any): void {
    this.renderPageHeader(doc, 'Methodology');

    const intro = 'This risk assessment was generated using the CGIAR Agricultural Risk Intelligence Tool, which employs AI-powered analysis across seven standardized risk categories.';
    doc.fontSize(10).fillColor(COLORS.text)
      .text(intro, { align: 'justify', lineGap: 3, width: CONTENT_WIDTH });
    doc.moveDown(1);

    // Risk scale visual
    this.renderSectionHeading(doc, 'Risk Scoring Scale');
    const scales = [
      { level: 'LOW', range: '0–30', desc: 'Minimal risk exposure with adequate controls in place', color: COLORS.low, bg: COLORS.lowBg },
      { level: 'MODERATE', range: '31–60', desc: 'Some risk exposure requiring monitoring and mitigation', color: COLORS.moderate, bg: COLORS.moderateBg },
      { level: 'HIGH', range: '61–80', desc: 'Significant risk exposure requiring immediate attention', color: COLORS.high, bg: COLORS.highBg },
      { level: 'CRITICAL', range: '81–100', desc: 'Severe risk exposure demanding urgent intervention', color: COLORS.critical, bg: COLORS.criticalBg },
    ];

    for (const scale of scales) {
      const rowY = doc.y;
      doc.roundedRect(MARGIN, rowY, CONTENT_WIDTH, 28, 4).fill(scale.bg);
      doc.roundedRect(MARGIN, rowY, 3, 28, 2).fill(scale.color);

      // Badge
      doc.roundedRect(MARGIN + 12, rowY + 6, 70, 16, 8).fill(scale.color);
      doc.fontSize(8).fillColor(COLORS.white)
        .text(`${scale.level} (${scale.range})`, MARGIN + 12, rowY + 9, { width: 70, align: 'center' });

      // Description
      doc.fontSize(9).fillColor(COLORS.text)
        .text(scale.desc, MARGIN + 92, rowY + 8, { width: CONTENT_WIDTH - 100 });

      doc.y = rowY + 32;
    }

    doc.moveDown(1);

    const methodology = [
      'Each category contains 5 subcategories scored independently. Category scores represent the weighted assessment of subcategory indicators. The overall score is the simple average of all 7 category scores.',
      'Recommendations are prioritized as HIGH, MEDIUM, or LOW based on risk severity, implementation feasibility, and potential impact on business resilience.',
      'Data sources analyzed include uploaded business documents, gap detection field data, interview responses, and manual data entries. The AI model applies domain expertise in agricultural risk assessment to evaluate each indicator.',
      'This report is intended as a decision-support tool and should be complemented by domain expert review and on-ground assessment.',
    ];

    for (const para of methodology) {
      doc.fontSize(9.5).fillColor(COLORS.text)
        .text(para, { align: 'justify', lineGap: 3, width: CONTENT_WIDTH });
      doc.moveDown(0.6);
    }
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
    doc.rect(0, 0, PAGE_WIDTH, 4).fill(COLORS.primary);

    doc.fontSize(18).fillColor(COLORS.primary)
      .text(title, MARGIN, 30);

    // Divider
    const lineY = doc.y + 4;
    doc.moveTo(MARGIN, lineY)
      .lineTo(PAGE_WIDTH - MARGIN, lineY)
      .strokeColor(COLORS.border).lineWidth(1).stroke();

    doc.y = lineY + 12;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private renderSectionHeading(doc: any, title: string): void {
    doc.fontSize(11).fillColor(COLORS.secondary)
      .font('Helvetica-Bold')
      .text(title, MARGIN, doc.y, { width: CONTENT_WIDTH });
    doc.font('Helvetica');
    doc.moveDown(0.3);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private ensureSpace(doc: any, needed: number): void {
    if (doc.y + needed > PAGE_HEIGHT - 50) {
      doc.addPage();
    }
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

  private formatCategoryName(category: string): string {
    return category
      .replace(/_/g, ' ')
      .split(' ')
      .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
      .join(' ')
      .replace('And', '&');
  }

  private shortCategoryName(category: string): string {
    const full = this.formatCategoryName(category);
    // Abbreviate for chart labels
    return full
      .replace('Climate Environmental', 'Climate')
      .replace('Governance Legal', 'Governance')
      .replace('Technology Data', 'Technology');
  }
}
