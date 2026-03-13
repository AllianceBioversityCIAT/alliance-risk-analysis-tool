import { Injectable, Logger } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');
import type { ReportResponse, SubcategoryScore } from '@alliance-risk/shared';

export interface ReportExtras {
  strengths?: string[];
  weaknesses?: string[];
  keyFindings?: string[];
}

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  // ─── Color Palette ───────────────────────────────────────────────────────

  private readonly colors = {
    primary: '#0F766E',     // Teal-700
    secondary: '#115E59',   // Teal-800
    accent: '#14B8A6',      // Teal-500
    text: '#1F2937',        // Gray-800
    textLight: '#6B7280',   // Gray-500
    border: '#E5E7EB',      // Gray-200
    bgLight: '#F9FAFB',     // Gray-50
    white: '#FFFFFF',
    low: '#16A34A',         // Green-600
    moderate: '#F48C06',    // Orange
    high: '#EA580C',        // Orange-Red
    critical: '#DC2626',    // Red-600
  } as const;

  /**
   * Generate a professional PDF report buffer from risk analysis data.
   */
  async generate(report: ReportResponse, extras?: ReportExtras): Promise<Buffer> {
    this.logger.log(`Generating PDF for assessment: ${report.assessment.id}`);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
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

      this.renderTitlePage(doc, report);
      this.renderExecutiveSummary(doc, report, extras);
      this.renderOverallScoreSummary(doc, report);
      this.renderCategoryDetails(doc, report);
      this.renderRecommendations(doc, report);

      if (extras?.strengths?.length || extras?.weaknesses?.length) {
        this.renderStrengthsWeaknesses(doc, extras);
      }

      this.renderMethodology(doc);

      doc.end();
    });
  }

  // ─── Title Page ──────────────────────────────────────────────────────────

  private renderTitlePage(doc: PDFKit.PDFDocument, report: ReportResponse): void {
    // Top accent bar
    doc.rect(0, 0, doc.page.width, 8).fill(this.colors.primary);

    doc.moveDown(6);

    // Title
    doc
      .fontSize(28)
      .fillColor(this.colors.primary)
      .text('RISK INTELLIGENCE REPORT', { align: 'center' });

    doc.moveDown(0.5);

    // Divider line
    const lineY = doc.y;
    doc
      .moveTo(150, lineY)
      .lineTo(doc.page.width - 150, lineY)
      .strokeColor(this.colors.accent)
      .lineWidth(2)
      .stroke();

    doc.moveDown(2);

    // Business info
    doc
      .fontSize(20)
      .fillColor(this.colors.text)
      .text(report.assessment.companyName, { align: 'center' });

    doc.moveDown(0.5);

    if (report.assessment.companyType) {
      doc
        .fontSize(14)
        .fillColor(this.colors.textLight)
        .text(report.assessment.companyType, { align: 'center' });
      doc.moveDown(0.3);
    }

    doc
      .fontSize(14)
      .fillColor(this.colors.textLight)
      .text(report.assessment.country, { align: 'center' });

    doc.moveDown(3);

    // Overall score box
    const boxWidth = 200;
    const boxX = (doc.page.width - boxWidth) / 2;
    const boxY = doc.y;
    const levelColor = this.getLevelColor(report.overallLevel);

    doc.rect(boxX, boxY, boxWidth, 80).fill(this.colors.bgLight);
    doc.rect(boxX, boxY, boxWidth, 80).strokeColor(levelColor).lineWidth(2).stroke();

    doc
      .fontSize(12)
      .fillColor(this.colors.textLight)
      .text('OVERALL RISK SCORE', boxX, boxY + 10, { width: boxWidth, align: 'center' });

    doc
      .fontSize(32)
      .fillColor(levelColor)
      .text(`${report.overallScore}`, boxX, boxY + 28, { width: boxWidth, align: 'center' });

    doc
      .fontSize(12)
      .fillColor(levelColor)
      .text(report.overallLevel, boxX, boxY + 60, { width: boxWidth, align: 'center' });

    doc.y = boxY + 100;
    doc.moveDown(3);

    // Date and version
    const dateStr = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    doc
      .fontSize(10)
      .fillColor(this.colors.textLight)
      .text(`Generated: ${dateStr}`, { align: 'center' });

    doc
      .fontSize(10)
      .text('CGIAR Agricultural Risk Intelligence Tool', { align: 'center' });
  }

  // ─── Executive Summary ───────────────────────────────────────────────────

  private renderExecutiveSummary(
    doc: PDFKit.PDFDocument,
    report: ReportResponse,
    extras?: ReportExtras,
  ): void {
    doc.addPage();
    this.renderPageHeader(doc, 'Executive Summary');

    doc
      .fontSize(11)
      .fillColor(this.colors.text)
      .text(report.executiveSummary, {
        align: 'justify',
        lineGap: 4,
      });

    if (extras?.keyFindings?.length) {
      doc.moveDown(1.5);
      this.renderSectionHeading(doc, 'Key Findings');
      for (const finding of extras.keyFindings) {
        this.renderBulletPoint(doc, finding);
      }
    }
  }

  // ─── Overall Score Summary ───────────────────────────────────────────────

  private renderOverallScoreSummary(doc: PDFKit.PDFDocument, report: ReportResponse): void {
    doc.moveDown(1.5);
    this.renderSectionHeading(doc, 'Risk Category Overview');

    // Table header
    const tableTop = doc.y + 5;
    const colWidths = { category: 180, score: 60, level: 80, narrative: 170 };
    const startX = 50;

    doc.rect(startX, tableTop, 490, 20).fill(this.colors.primary);
    doc
      .fontSize(9)
      .fillColor(this.colors.white)
      .text('Category', startX + 8, tableTop + 5, { width: colWidths.category })
      .text('Score', startX + colWidths.category + 8, tableTop + 5, { width: colWidths.score })
      .text('Level', startX + colWidths.category + colWidths.score + 8, tableTop + 5, { width: colWidths.level })
      .text('Summary', startX + colWidths.category + colWidths.score + colWidths.level + 8, tableTop + 5, { width: colWidths.narrative });

    let rowY = tableTop + 22;
    for (let i = 0; i < report.categories.length; i++) {
      const cat = report.categories[i];

      // Check page overflow
      if (rowY + 30 > doc.page.height - 60) {
        doc.addPage();
        rowY = 60;
      }

      // Alternate row background
      if (i % 2 === 0) {
        doc.rect(startX, rowY - 2, 490, 22).fill(this.colors.bgLight);
      }

      const levelColor = this.getLevelColor(cat.level);
      const categoryLabel = this.formatCategoryName(cat.category);

      doc.fontSize(9).fillColor(this.colors.text)
        .text(categoryLabel, startX + 8, rowY, { width: colWidths.category });

      doc.fillColor(levelColor)
        .text(`${cat.score}/100`, startX + colWidths.category + 8, rowY, { width: colWidths.score });

      doc.fillColor(levelColor)
        .text(cat.level, startX + colWidths.category + colWidths.score + 8, rowY, { width: colWidths.level });

      const shortNarrative = cat.narrative
        ? cat.narrative.substring(0, 60) + (cat.narrative.length > 60 ? '...' : '')
        : '—';
      doc.fillColor(this.colors.textLight)
        .text(shortNarrative, startX + colWidths.category + colWidths.score + colWidths.level + 8, rowY, {
          width: colWidths.narrative,
        });

      rowY += 24;
    }

    doc.y = rowY + 10;
  }

  // ─── Category Details ────────────────────────────────────────────────────

  private renderCategoryDetails(doc: PDFKit.PDFDocument, report: ReportResponse): void {
    for (const category of report.categories) {
      doc.addPage();
      const categoryLabel = this.formatCategoryName(category.category);
      this.renderPageHeader(doc, categoryLabel);
      this.renderCategoryScoreBadge(doc, category);
      this.renderCategoryNarrative(doc, category);
      this.renderCategoryEvidence(doc, category);
      this.renderCategorySubcategories(doc, category);
      this.renderCategoryRecommendations(doc, category);
    }
  }

  private renderCategoryScoreBadge(
    doc: PDFKit.PDFDocument,
    category: ReportResponse['categories'][number],
  ): void {
    const levelColor = this.getLevelColor(category.level);
    doc
      .fontSize(24)
      .fillColor(levelColor)
      .text(`${category.score}/100`, { continued: true })
      .fontSize(14)
      .fillColor(this.colors.textLight)
      .text(`  ${category.level}`, { continued: false });
    doc.moveDown(0.5);
  }

  private renderCategoryNarrative(
    doc: PDFKit.PDFDocument,
    category: ReportResponse['categories'][number],
  ): void {
    if (!category.narrative) return;
    doc
      .fontSize(11)
      .fillColor(this.colors.text)
      .text(category.narrative, { align: 'justify', lineGap: 3 });
    doc.moveDown(1);
  }

  private renderCategoryEvidence(
    doc: PDFKit.PDFDocument,
    category: ReportResponse['categories'][number],
  ): void {
    if (!category.evidence) return;
    this.renderSectionHeading(doc, 'Evidence');
    doc
      .fontSize(10)
      .fillColor(this.colors.textLight)
      .text(category.evidence, { align: 'justify', lineGap: 2 });
    doc.moveDown(1);
  }

  private renderCategorySubcategories(
    doc: PDFKit.PDFDocument,
    category: ReportResponse['categories'][number],
  ): void {
    if (category.subcategories.length === 0) return;
    this.renderSectionHeading(doc, 'Subcategory Scores');
    this.renderSubcategoryTable(doc, category.subcategories);
  }

  private renderCategoryRecommendations(
    doc: PDFKit.PDFDocument,
    category: ReportResponse['categories'][number],
  ): void {
    const catRecs = category.recommendations;
    if (catRecs.length === 0) return;
    doc.moveDown(1);
    this.renderSectionHeading(doc, 'Recommendations');
    for (const rec of catRecs) {
      const text = rec.isEdited && rec.editedText ? rec.editedText : rec.text;
      this.renderBulletPoint(doc, `[${rec.priority}] ${text}`);
    }
  }

  private renderSubcategoryTable(doc: PDFKit.PDFDocument, subcategories: SubcategoryScore[]): void {
    const startX = 50;
    const tableTop = doc.y + 5;
    const colWidths = { name: 140, score: 50, level: 70, evidence: 220 };

    doc.rect(startX, tableTop, 480, 18).fill(this.colors.primary);
    doc
      .fontSize(8)
      .fillColor(this.colors.white)
      .text('Subcategory', startX + 6, tableTop + 4, { width: colWidths.name })
      .text('Score', startX + colWidths.name + 6, tableTop + 4, { width: colWidths.score })
      .text('Level', startX + colWidths.name + colWidths.score + 6, tableTop + 4, { width: colWidths.level })
      .text('Evidence / Mitigation', startX + colWidths.name + colWidths.score + colWidths.level + 6, tableTop + 4, { width: colWidths.evidence });

    let rowY = tableTop + 20;
    for (let i = 0; i < subcategories.length; i++) {
      const sub = subcategories[i];

      if (rowY + 28 > doc.page.height - 60) {
        doc.addPage();
        rowY = 60;
      }

      if (i % 2 === 0) {
        doc.rect(startX, rowY - 1, 480, 20).fill(this.colors.bgLight);
      }

      const levelColor = this.getLevelColor(sub.level);

      doc.fontSize(8).fillColor(this.colors.text)
        .text(sub.name, startX + 6, rowY, { width: colWidths.name });

      doc.fillColor(levelColor)
        .text(`${sub.score}`, startX + colWidths.name + 6, rowY, { width: colWidths.score });

      doc.fillColor(levelColor)
        .text(sub.level, startX + colWidths.name + colWidths.score + 6, rowY, { width: colWidths.level });

      const evidenceText = sub.evidence || sub.mitigation || '—';
      const shortEvidence = evidenceText.substring(0, 80) + (evidenceText.length > 80 ? '...' : '');
      doc.fillColor(this.colors.textLight)
        .text(shortEvidence, startX + colWidths.name + colWidths.score + colWidths.level + 6, rowY, {
          width: colWidths.evidence,
        });

      rowY += 22;
    }

    doc.y = rowY + 5;
  }

  // ─── Recommendations ─────────────────────────────────────────────────────

  private renderRecommendations(doc: PDFKit.PDFDocument, report: ReportResponse): void {
    doc.addPage();
    this.renderPageHeader(doc, 'All Recommendations');

    const allRecs = report.categories.flatMap((c) =>
      c.recommendations.map((r) => ({
        category: this.formatCategoryName(c.category),
        text: r.isEdited && r.editedText ? r.editedText : r.text,
        priority: r.priority,
      })),
    );

    // Group by priority
    const priorities = ['HIGH', 'MEDIUM', 'LOW'] as const;
    for (const priority of priorities) {
      const filtered = allRecs.filter((r) => r.priority === priority);
      if (filtered.length === 0) continue;

      this.renderSectionHeading(doc, `${priority} Priority`);
      for (const rec of filtered) {
        if (doc.y + 30 > doc.page.height - 60) {
          doc.addPage();
        }
        doc
          .fontSize(10)
          .fillColor(this.colors.text)
          .text(`${rec.category}: `, { continued: true })
          .fillColor(this.colors.textLight)
          .text(rec.text, { continued: false, lineGap: 2 });
        doc.moveDown(0.3);
      }
      doc.moveDown(0.5);
    }
  }

  // ─── Strengths & Weaknesses ──────────────────────────────────────────────

  private renderStrengthsWeaknesses(doc: PDFKit.PDFDocument, extras: ReportExtras): void {
    doc.addPage();
    this.renderPageHeader(doc, 'Strengths & Weaknesses');

    if (extras.strengths?.length) {
      this.renderSectionHeading(doc, 'Strengths');
      for (const item of extras.strengths) {
        this.renderBulletPoint(doc, item, this.colors.low);
      }
      doc.moveDown(1);
    }

    if (extras.weaknesses?.length) {
      this.renderSectionHeading(doc, 'Weaknesses');
      for (const item of extras.weaknesses) {
        this.renderBulletPoint(doc, item, this.colors.high);
      }
    }
  }

  // ─── Methodology ─────────────────────────────────────────────────────────

  private renderMethodology(doc: PDFKit.PDFDocument): void {
    doc.addPage();
    this.renderPageHeader(doc, 'Methodology');

    const methodology = [
      'This risk assessment was generated using the CGIAR Agricultural Risk Intelligence Tool, which employs AI-powered analysis across seven standardized risk categories.',
      '',
      'Risk Scoring Scale:',
      '  • LOW (0-30): Minimal risk exposure with adequate controls in place',
      '  • MODERATE (31-60): Some risk exposure requiring monitoring and mitigation',
      '  • HIGH (61-80): Significant risk exposure requiring immediate attention',
      '  • CRITICAL (81-100): Severe risk exposure demanding urgent intervention',
      '',
      'Each category contains 5 subcategories scored independently. Category scores represent the weighted assessment of subcategory indicators. The overall score is the simple average of all 7 category scores.',
      '',
      'Recommendations are prioritized as HIGH, MEDIUM, or LOW based on risk severity, implementation feasibility, and potential impact on business resilience.',
      '',
      'Data sources analyzed include uploaded business documents, gap detection field data, interview responses, and manual data entries. The AI model applies domain expertise in agricultural risk assessment to evaluate each indicator.',
      '',
      'This report is intended as a decision-support tool and should be complemented by domain expert review and on-ground assessment.',
    ].join('\n');

    doc
      .fontSize(10)
      .fillColor(this.colors.text)
      .text(methodology, { align: 'justify', lineGap: 3 });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private renderPageHeader(doc: PDFKit.PDFDocument, title: string): void {
    // Top accent bar
    doc.rect(0, 0, doc.page.width, 4).fill(this.colors.primary);

    doc
      .fontSize(18)
      .fillColor(this.colors.primary)
      .text(title, 50, 40);

    // Divider
    const lineY = doc.y + 5;
    doc.moveTo(50, lineY).lineTo(doc.page.width - 50, lineY).strokeColor(this.colors.border).lineWidth(1).stroke();

    doc.y = lineY + 15;
  }

  private renderSectionHeading(doc: PDFKit.PDFDocument, title: string): void {
    doc
      .fontSize(13)
      .fillColor(this.colors.secondary)
      .text(title);
    doc.moveDown(0.3);
  }

  private renderBulletPoint(doc: PDFKit.PDFDocument, text: string, color?: string): void {
    doc
      .fontSize(10)
      .fillColor(color ?? this.colors.text)
      .text(`  •  ${text}`, { indent: 10, lineGap: 2 });
    doc.moveDown(0.2);
  }

  private getLevelColor(level: string): string {
    switch (level) {
      case 'LOW': return this.colors.low;
      case 'MODERATE': return this.colors.moderate;
      case 'HIGH': return this.colors.high;
      case 'CRITICAL': return this.colors.critical;
      default: return this.colors.textLight;
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
}
