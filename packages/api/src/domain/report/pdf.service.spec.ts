import { AssessmentStatus, IntakeMode, RecommendationPriority, RiskLevel, type FinancialMetrics, type ReportConfig, type ReportResponse } from '@alliance-risk/shared';
import { PdfService } from './pdf.service';

const createReportConfig = (overrides: Partial<ReportConfig> = {}): ReportConfig => ({
  includeRadarChart: true,
  includeCategoryDetails: true,
  includeSubcategoryCharts: true,
  subcategoryChartType: 'bar',
  includeFinancialCharts: false,
  includeRecommendations: true,
  includeEvidenceTraces: true,
  includeMethodology: true,
  includeCompanyProfile: true,
  includeRiskHeatmap: true,
  includeActionPlan: true,
  includeAppendix: false,
  ...overrides,
});

const createReport = (): ReportResponse => ({
  assessment: {
    id: 'assessment-1',
    name: 'Bluewave Fisheries Risk Assessment',
    companyName: 'Bluewave Fisheries',
    companyType: 'SME',
    country: 'Kenya',
    status: AssessmentStatus.COMPLETE,
    intakeMode: IntakeMode.UPLOAD,
    progress: 100,
    version: 1,
    overallRiskScore: 58,
    overallRiskLevel: RiskLevel.MODERATE,
    updatedAt: '2026-04-08T00:00:00.000Z',
    createdAt: '2026-04-08T00:00:00.000Z',
  },
  executiveSummary:
    'Bluewave Fisheries shows moderate overall risk with concentrated exposure in governance and climate controls, while operational execution and market traction remain viable under close monitoring.',
  overallScore: 58,
  overallLevel: RiskLevel.MODERATE,
  radarData: [
    { category: 'FINANCIAL', score: 52 },
    { category: 'CLIMATE_ENVIRONMENTAL', score: 64 },
    { category: 'BUSINESS_MODEL', score: 48 },
    { category: 'OPERATIONAL', score: 55 },
    { category: 'MARKET_COMMERCIAL', score: 57 },
    { category: 'GOVERNANCE_LEGAL', score: 67 },
    { category: 'TECHNOLOGY_DATA', score: 61 },
  ],
  financialMetrics: {
    revenue: [
      { year: 2024, amount: 850000, currency: 'USD' },
      { year: 2025, amount: 1100000, currency: 'USD' },
      { year: 2026, amount: 1450000, currency: 'USD' },
    ],
    costs: [
      { category: 'Feed', amount: 420000 },
      { category: 'Operations', amount: 260000 },
      { category: 'Logistics', amount: 180000 },
    ],
    margins: {
      gross: 0.34,
      operating: 0.18,
    },
  },
  actionPlanItems: [
    {
      timeframe: 'IMMEDIATE',
      category: 'FINANCIAL',
      priority: 'HIGH',
      text: 'Secure bridge financing and formalize weekly cash controls.',
    },
    {
      timeframe: 'SHORT_TERM',
      category: 'OPERATIONAL',
      priority: 'MEDIUM',
      text: 'Document hatchery SOPs and staff escalation procedures.',
    },
    {
      timeframe: 'MEDIUM_TERM',
      category: 'MARKET_COMMERCIAL',
      priority: 'LOW',
      text: 'Diversify institutional buyers across regional export channels.',
    },
  ],
  documentSources: [
    {
      fileName: 'financials-2025.pdf',
      fileType: 'application/pdf',
      extractedLength: 182345,
    },
    {
      fileName: 'operations.xlsx',
      fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      extractedLength: 98412,
    },
  ],
  gapSummary: [
    {
      fieldKey: 'annual_revenue',
      status: 'PARTIAL',
      detectedValue: '1200000',
      correctedValue: '1250000',
    },
    {
      fieldKey: 'export_market',
      status: 'VERIFIED',
      detectedValue: 'Uganda',
      correctedValue: null,
    },
  ],
  categories: [
    'FINANCIAL',
    'CLIMATE_ENVIRONMENTAL',
    'BUSINESS_MODEL',
    'OPERATIONAL',
    'MARKET_COMMERCIAL',
    'GOVERNANCE_LEGAL',
    'TECHNOLOGY_DATA',
  ].map((category, index) => ({
    id: `risk-${index + 1}`,
    category,
    score: 48 + index * 3,
    level: index >= 5 ? RiskLevel.HIGH : RiskLevel.MODERATE,
    narrative: `${category} narrative summarizing the main drivers of risk and current mitigating actions in place.`,
    evidence: `${category} evidence trace grounded in uploaded documents and analyst review.`,
    analystComment: `Analyst note for ${category} highlighting the primary follow-up action.`,
    subcategories: [
      {
        name: `${category} Subcategory A`,
        indicator: 'Indicator A',
        score: 45 + index,
        level: RiskLevel.MODERATE,
        evidence: 'Evidence A',
        mitigation: 'Mitigation A',
      },
      {
        name: `${category} Subcategory B`,
        indicator: 'Indicator B',
        score: 55 + index,
        level: index >= 5 ? RiskLevel.HIGH : RiskLevel.MODERATE,
        evidence: 'Evidence B',
        mitigation: 'Mitigation B',
      },
    ],
    recommendations: [
      {
        id: `rec-${index + 1}`,
        text: `Recommendation for ${category.toLowerCase()} controls and operating discipline.`,
        priority: index % 3 === 0 ? RecommendationPriority.HIGH : RecommendationPriority.MEDIUM,
        isEdited: false,
        editedText: null,
      },
    ],
  })),
});

const createExtras = () => ({
  strengths: ['Strong aquaculture demand in target markets.'],
  weaknesses: ['Governance controls require formalization.'],
  keyFindings: ['Liquidity management and compliance oversight need immediate attention.'],
});

const createFinancialMetrics = (overrides: Partial<FinancialMetrics> = {}): FinancialMetrics => ({
  revenue: [
    { year: 2024, amount: 850000, currency: 'USD' },
    { year: 2025, amount: 1100000, currency: 'USD' },
    { year: 2026, amount: 1450000, currency: 'USD' },
  ],
  costs: [
    { category: 'Feed', amount: 420000 },
    { category: 'Operations', amount: 260000 },
    { category: 'Logistics', amount: 180000 },
  ],
  margins: {
    gross: 0.34,
    operating: 0.18,
  },
  ...overrides,
});

describe('PdfService', () => {
  let service: PdfService;

  beforeEach(() => {
    service = new PdfService();
  });

  it('tracks only real content pages for a full report', async () => {
    const report = createReport();
    const extras = createExtras();

    const buffer = await service.generate(report, extras, createReportConfig());
    const metrics = (service as any).lastGenerationMetrics as {
      bufferedPageCount: number;
      contentPageIndexes: number[];
      footerPageIndexes: number[];
      postFooterBufferedPageCount: number;
    };

    expect(buffer.length).toBeGreaterThan(0);
    expect(metrics.bufferedPageCount).toBe(18);
    expect(metrics.contentPageIndexes).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]);
    expect(metrics.footerPageIndexes).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]);
    // Regression: footer rendering must not create phantom pages via PDFKit overflow.
    expect(metrics.postFooterBufferedPageCount).toBe(metrics.bufferedPageCount);
  });

  it('does not create phantom pages when rendering footers for a full report', async () => {
    // Regression for the blank-pages bug: FOOTER_Y sits below doc.page.maxY,
    // so each doc.text() at that position used to trigger auto-paging and
    // drop "CONFIDENTIAL" / "Page X of Y" onto newly created phantom pages.
    const report = createReport();
    const extras = createExtras();

    await service.generate(
      report,
      extras,
      createReportConfig({ includeFinancialCharts: true, includeAppendix: true }),
    );

    const metrics = (service as any).lastGenerationMetrics as {
      bufferedPageCount: number;
      postFooterBufferedPageCount: number;
    };

    expect(metrics.postFooterBufferedPageCount).toBe(metrics.bufferedPageCount);
  });

  it('integrates all Phase 2 sections together in the full report flow', async () => {
    const report = createReport();
    const buffer = await service.generate(report, createExtras(), createReportConfig({
      includeFinancialCharts: true,
      includeAppendix: true,
    }));
    const tocMetrics = (service as any).lastTocLayoutMetrics as {
      entries: Array<{ title: string; pageIndex: number; pageNumber: number; level: number }>;
    };
    const generationMetrics = (service as any).lastGenerationMetrics as {
      bufferedPageCount: number;
      footerPageIndexes: number[];
    };

    expect(buffer.length).toBeGreaterThan(0);
    expect(tocMetrics.entries.some((entry) => entry.title === 'Company Profile')).toBe(true);
    expect(tocMetrics.entries.some((entry) => entry.title === 'Financial Overview')).toBe(true);
    expect(tocMetrics.entries.some((entry) => entry.title === 'Action Plan')).toBe(true);
    expect(tocMetrics.entries.some((entry) => entry.title === 'Appendix')).toBe(true);
    expect(tocMetrics.entries.at(-1)?.title).toBe('Disclaimer');
    expect(generationMetrics.footerPageIndexes.length).toBe(generationMetrics.bufferedPageCount - 1);
  });

  it('preserves backwards compatibility when all Phase 2 optional sections are disabled', async () => {
    const report = createReport();
    const buffer = await service.generate(
      report,
      undefined,
      createReportConfig({
        includeCompanyProfile: false,
        includeRiskHeatmap: false,
        includeFinancialCharts: false,
        includeActionPlan: false,
        includeAppendix: false,
        includeCategoryDetails: false,
        includeRecommendations: false,
        includeMethodology: true,
      }),
    );
    const tocMetrics = (service as any).lastTocLayoutMetrics as {
      entries: Array<{ title: string; pageIndex: number; pageNumber: number; level: number }>;
    };
    const generationMetrics = (service as any).lastGenerationMetrics as {
      bufferedPageCount: number;
      footerPageIndexes: number[];
    };

    expect(buffer.length).toBeGreaterThan(0);
    expect(tocMetrics.entries).toEqual([
      { title: 'Executive Summary', pageIndex: 2, pageNumber: 2, level: 0 },
      { title: 'Risk Overview', pageIndex: 3, pageNumber: 3, level: 0 },
      { title: 'Methodology', pageIndex: 4, pageNumber: 4, level: 0 },
      { title: 'Disclaimer', pageIndex: 5, pageNumber: 5, level: 0 },
    ]);
    expect(generationMetrics.bufferedPageCount).toBe(6);
    expect(generationMetrics.footerPageIndexes).toEqual([1, 2, 3, 4, 5]);
  });

  it('does not add trailing blank pages for a reduced report', async () => {
    const report = createReport();

    const buffer = await service.generate(
      report,
      undefined,
      createReportConfig({
        includeRadarChart: false,
        includeCategoryDetails: false,
        includeRecommendations: false,
        includeMethodology: true,
        includeEvidenceTraces: false,
        includeCompanyProfile: false,
        includeActionPlan: false,
      }),
    );
    const metrics = (service as any).lastGenerationMetrics as {
      bufferedPageCount: number;
      contentPageIndexes: number[];
      footerPageIndexes: number[];
    };

    expect(buffer.length).toBeGreaterThan(0);
    expect(metrics.bufferedPageCount).toBe(6);
    expect(metrics.contentPageIndexes).toEqual([0, 1, 2, 3, 4, 5]);
    expect(metrics.footerPageIndexes).toEqual([1, 2, 3, 4, 5]);
  });

  it('keeps long title-page metadata above the score gauge', async () => {
    const report = createReport();
    report.assessment.companyName = 'Bluewave Fisheries Cooperative for Climate-Resilient Aquaculture and Regional Market Expansion Initiative';
    report.assessment.companyType = 'Farmer-Owned Export Consortium';

    const buffer = await service.generate(
      report,
      undefined,
      createReportConfig({
        includeCategoryDetails: false,
        includeRecommendations: false,
        includeMethodology: false,
      }),
    );
    const titleMetrics = (service as any).lastTitlePageLayoutMetrics as {
      companyNameBottom: number;
      detailsBottom: number;
      gaugeTop: number;
      gaugeCenterY: number;
      badgeBottom: number;
    };

    expect(buffer.length).toBeGreaterThan(0);
    expect(titleMetrics.companyNameBottom).toBeLessThan(titleMetrics.gaugeTop);
    expect(titleMetrics.detailsBottom + 20).toBeLessThan(titleMetrics.gaugeTop);
    expect(titleMetrics.gaugeCenterY).toBeGreaterThan(350);
    expect(titleMetrics.badgeBottom).toBeGreaterThan(titleMetrics.gaugeCenterY);
  });

  it('sizes the executive summary box dynamically for short and long text', async () => {
    const shortReport = createReport();
    shortReport.executiveSummary = 'Bluewave Fisheries presents moderate risk with manageable execution gaps and a credible pathway to improvement.';

    await service.generate(shortReport, {
      keyFindings: ['Short summary finding.'],
    }, createReportConfig({
      includeCategoryDetails: false,
      includeRecommendations: false,
      includeMethodology: false,
    }));

    const shortMetrics = (service as any).lastExecutiveSummaryLayoutMetrics as {
      summaryTextHeight: number;
      summaryBoxHeight: number;
      summaryBoxBottom: number;
      keyFindingsStartY: number | null;
      paddingTop: number;
      paddingBottom: number;
    };

    const longReport = createReport();
    longReport.executiveSummary = [
      'Bluewave Fisheries presents moderate risk with visible pressure in governance discipline, climate resilience planning, and working-capital controls.',
      'At the same time, the company retains encouraging demand momentum, operational traction, and identifiable mitigation actions that make the risk profile improvable rather than structurally unsound.',
      'The next phase should prioritize financial control strengthening, documented compliance routines, and resilience investments that reduce exposure to supply and environmental volatility.',
    ].join(' ');

    await service.generate(longReport, {
      keyFindings: ['Long summary finding one.', 'Long summary finding two.'],
    }, createReportConfig({
      includeCategoryDetails: false,
      includeRecommendations: false,
      includeMethodology: false,
    }));

    const longMetrics = (service as any).lastExecutiveSummaryLayoutMetrics as typeof shortMetrics;

    expect(shortMetrics.summaryBoxHeight).toBe(shortMetrics.summaryTextHeight + shortMetrics.paddingTop + shortMetrics.paddingBottom);
    expect(longMetrics.summaryBoxHeight).toBe(longMetrics.summaryTextHeight + longMetrics.paddingTop + longMetrics.paddingBottom);
    expect(longMetrics.summaryBoxHeight).toBeGreaterThan(shortMetrics.summaryBoxHeight);
    expect(shortMetrics.keyFindingsStartY).toBe(shortMetrics.summaryBoxBottom + 15);
    expect(longMetrics.keyFindingsStartY).toBe(longMetrics.summaryBoxBottom + 15);
  });

  it('keeps methodology text anchored to content margins', async () => {
    const report = createReport();

    const buffer = await service.generate(
      report,
      undefined,
      createReportConfig({
        includeRadarChart: false,
        includeCategoryDetails: false,
        includeRecommendations: false,
        includeMethodology: true,
      }),
    );
    const methodologyMetrics = (service as any).lastMethodologyLayoutMetrics as {
      introX: number;
      introWidth: number;
      scaleDescriptionX: number;
      scaleDescriptionWidth: number;
      paragraphX: number;
      paragraphWidth: number;
      finalCursorX: number;
    };

    expect(buffer.length).toBeGreaterThan(0);
    expect(methodologyMetrics.introX).toBe(45);
    expect(methodologyMetrics.introWidth).toBe(505.28);
    expect(methodologyMetrics.paragraphX).toBe(45);
    expect(methodologyMetrics.paragraphWidth).toBe(505.28);
    expect(methodologyMetrics.scaleDescriptionX + methodologyMetrics.scaleDescriptionWidth).toBeLessThanOrEqual(550.28);
    expect(methodologyMetrics.finalCursorX).toBe(45);
  });

  it('renders a TOC with accurate page numbers for the full report', async () => {
    const report = createReport();
    const extras = createExtras();

    const buffer = await service.generate(report, extras, createReportConfig());
    const tocMetrics = (service as any).lastTocLayoutMetrics as {
      tocPageIndex: number;
      entries: Array<{ title: string; pageIndex: number; pageNumber: number; level: number }>;
    };

    expect(buffer.length).toBeGreaterThan(0);
    expect(tocMetrics.tocPageIndex).toBe(1);
    expect(tocMetrics.entries[0]).toEqual({ title: 'Company Profile', pageIndex: 2, pageNumber: 2, level: 0 });
    expect(tocMetrics.entries[1]).toEqual({ title: 'Executive Summary', pageIndex: 3, pageNumber: 3, level: 0 });
    expect(tocMetrics.entries[2]).toEqual({ title: 'Risk Overview', pageIndex: 4, pageNumber: 4, level: 0 });
    expect(tocMetrics.entries).toContainEqual({ title: 'Financial', pageIndex: 6, pageNumber: 6, level: 1 });
    expect(tocMetrics.entries).toContainEqual({ title: 'Technology Data', pageIndex: 12, pageNumber: 12, level: 1 });
    expect(tocMetrics.entries).toContainEqual({ title: 'All Recommendations', pageIndex: 13, pageNumber: 13, level: 0 });
    expect(tocMetrics.entries).toContainEqual({ title: 'Action Plan', pageIndex: 14, pageNumber: 14, level: 0 });
    expect(tocMetrics.entries).toContainEqual({ title: 'Strengths & Weaknesses', pageIndex: 15, pageNumber: 15, level: 0 });
    expect(tocMetrics.entries).toContainEqual({ title: 'Methodology', pageIndex: 16, pageNumber: 16, level: 0 });
    expect(tocMetrics.entries).toContainEqual({ title: 'Disclaimer', pageIndex: 17, pageNumber: 17, level: 0 });
  });

  it('renders a reduced TOC when category details are disabled', async () => {
    const report = createReport();

    const buffer = await service.generate(
      report,
      undefined,
      createReportConfig({
        includeRadarChart: false,
        includeCategoryDetails: false,
        includeRecommendations: false,
        includeMethodology: true,
        includeCompanyProfile: false,
        includeActionPlan: false,
      }),
    );
    const tocMetrics = (service as any).lastTocLayoutMetrics as {
      tocPageIndex: number;
      entries: Array<{ title: string; pageIndex: number; pageNumber: number; level: number }>;
    };

    expect(buffer.length).toBeGreaterThan(0);
    expect(tocMetrics.tocPageIndex).toBe(1);
    expect(tocMetrics.entries).toEqual([
      { title: 'Executive Summary', pageIndex: 2, pageNumber: 2, level: 0 },
      { title: 'Risk Overview', pageIndex: 3, pageNumber: 3, level: 0 },
      { title: 'Methodology', pageIndex: 4, pageNumber: 4, level: 0 },
      { title: 'Disclaimer', pageIndex: 5, pageNumber: 5, level: 0 },
    ]);
  });

  it('applies headers and 1-indexed footers to content pages only', async () => {
    const report = createReport();
    const extras = createExtras();

    const buffer = await service.generate(report, extras, createReportConfig());
    const headerFooterMetrics = (service as any).lastHeaderFooterLayoutMetrics as {
      contentPageTotal: number;
      pages: Array<{
        pageIndex: number;
        headerRendered: boolean;
        footerLabel: string;
        footerText: string;
      }>;
    };

    expect(buffer.length).toBeGreaterThan(0);
    expect(headerFooterMetrics.contentPageTotal).toBe(17);
    expect(headerFooterMetrics.pages[0]).toEqual({
      pageIndex: 1,
      headerRendered: true,
      footerLabel: 'Page 1 of 17',
      footerText: 'CONFIDENTIAL — CGIAR Agricultural Risk Intelligence',
    });
    expect(headerFooterMetrics.pages.at(-1)).toEqual({
      pageIndex: 17,
      headerRendered: true,
      footerLabel: 'Page 17 of 17',
      footerText: 'CONFIDENTIAL — CGIAR Agricultural Risk Intelligence',
    });
    expect(headerFooterMetrics.pages.every((page) => page.pageIndex > 0)).toBe(true);
  });

  it('uses standardized geometry for recommendation cards and category visuals', async () => {
    const report = createReport();

    const buffer = await service.generate(
      report,
      undefined,
      createReportConfig({
        includeCategoryDetails: true,
        includeRecommendations: true,
        includeMethodology: false,
      }),
    );
    const layoutMetrics = (service as any).lastCategoryRecommendationLayoutMetrics as {
      recommendationRailWidth: number;
      recommendationPadding: number;
      radarBottomY: number;
      overviewRowHeight: number;
      subcategoryRowHeight: number;
    };

    expect(buffer.length).toBeGreaterThan(0);
    expect(layoutMetrics.recommendationRailWidth).toBe(4);
    expect(layoutMetrics.recommendationPadding).toBe(12);
    expect(layoutMetrics.radarBottomY).toBeLessThan(280);
    expect(layoutMetrics.overviewRowHeight).toBe(28);
    expect(layoutMetrics.subcategoryRowHeight).toBe(30);
  });

  it('renders a risk heatmap for all seven categories', async () => {
    const report = createReport();

    const buffer = await service.generate(
      report,
      undefined,
      createReportConfig({
        includeCategoryDetails: false,
        includeRecommendations: false,
        includeMethodology: false,
      }),
    );
    const heatmapMetrics = (service as any).lastRiskHeatmapLayoutMetrics as {
      zoneLabels: string[];
      points: Array<{ category: string; shortLabel: string; score: number; x: number; y: number }>;
      gridStartX: number;
      gridWidth: number;
    };

    expect(buffer.length).toBeGreaterThan(0);
    expect(heatmapMetrics.zoneLabels).toEqual(['LOW (0-30)', 'MODERATE (31-60)', 'HIGH (61-80)', 'CRITICAL']);
    expect(heatmapMetrics.points).toHaveLength(7);
    expect(heatmapMetrics.points.map((point) => point.shortLabel)).toEqual(['FIN', 'CLI', 'BUS', 'OPS', 'MKT', 'GOV', 'TEC']);
  });

  it('positions heatmap circles correctly for edge scores', async () => {
    const report = createReport();
    const edgeScores = [0, 30, 60, 80, 100, 45, 75];
    report.categories = report.categories.map((category, index) => ({
      ...category,
      score: edgeScores[index],
      level: edgeScores[index] >= 81
        ? RiskLevel.CRITICAL
        : edgeScores[index] >= 61
          ? RiskLevel.HIGH
          : edgeScores[index] >= 31
            ? RiskLevel.MODERATE
            : RiskLevel.LOW,
    }));

    const buffer = await service.generate(
      report,
      undefined,
      createReportConfig({
        includeCategoryDetails: false,
        includeRecommendations: false,
        includeMethodology: false,
      }),
    );
    const heatmapMetrics = (service as any).lastRiskHeatmapLayoutMetrics as {
      points: Array<{ category: string; shortLabel: string; score: number; x: number; y: number }>;
      gridStartX: number;
      gridWidth: number;
    };

    expect(buffer.length).toBeGreaterThan(0);
    expect(heatmapMetrics.points[0].x).toBeCloseTo(heatmapMetrics.gridStartX, 5);
    expect(heatmapMetrics.points[1].x).toBeCloseTo(heatmapMetrics.gridStartX + heatmapMetrics.gridWidth * 0.3, 5);
    expect(heatmapMetrics.points[2].x).toBeCloseTo(heatmapMetrics.gridStartX + heatmapMetrics.gridWidth * 0.6, 5);
    expect(heatmapMetrics.points[3].x).toBeCloseTo(heatmapMetrics.gridStartX + heatmapMetrics.gridWidth * 0.8, 5);
    expect(heatmapMetrics.points[4].x).toBeCloseTo(heatmapMetrics.gridStartX + heatmapMetrics.gridWidth, 5);
  });

  it('renders a company profile page with assessment metadata', async () => {
    const report = createReport();

    const buffer = await service.generate(
      report,
      createExtras(),
      createReportConfig({
        includeCategoryDetails: false,
        includeRecommendations: false,
        includeMethodology: false,
      }),
    );
    const companyProfileMetrics = (service as any).lastCompanyProfileLayoutMetrics as {
      rowCount: number;
      sectorIndustryValue: string;
      companyTypeValue: string;
      startPageIndex: number;
    };
    const tocMetrics = (service as any).lastTocLayoutMetrics as {
      entries: Array<{ title: string; pageIndex: number; pageNumber: number; level: number }>;
    };

    expect(buffer.length).toBeGreaterThan(0);
    expect(companyProfileMetrics.rowCount).toBe(7);
    expect(companyProfileMetrics.sectorIndustryValue).toBe('SME');
    expect(companyProfileMetrics.companyTypeValue).toBe('SME');
    expect(companyProfileMetrics.startPageIndex).toBe(2);
    expect(tocMetrics.entries[0]).toEqual({ title: 'Company Profile', pageIndex: 2, pageNumber: 2, level: 0 });
  });

  it('renders financial overview charts when complete financial data is present', async () => {
    const report = createReport();

    const buffer = await service.generate(
      report,
      createExtras(),
      createReportConfig({
        includeCategoryDetails: false,
        includeRecommendations: false,
        includeFinancialCharts: true,
        includeMethodology: false,
      }),
    );
    const financialMetrics = (service as any).lastFinancialOverviewLayoutMetrics as {
      startPageIndex: number;
      renderedRevenueChart: boolean;
      renderedCostChart: boolean;
      renderedMarginsSummary: boolean;
      revenuePointCount: number;
      costBarCount: number;
      grossMarginLabel: string;
      operatingMarginLabel: string;
    };
    const tocMetrics = (service as any).lastTocLayoutMetrics as {
      entries: Array<{ title: string; pageIndex: number; pageNumber: number; level: number }>;
    };

    expect(buffer.length).toBeGreaterThan(0);
    expect(financialMetrics.startPageIndex).toBeGreaterThan(0);
    expect(financialMetrics.renderedRevenueChart).toBe(true);
    expect(financialMetrics.renderedCostChart).toBe(true);
    expect(financialMetrics.renderedMarginsSummary).toBe(true);
    expect(financialMetrics.revenuePointCount).toBe(3);
    expect(financialMetrics.costBarCount).toBe(3);
    expect(financialMetrics.grossMarginLabel).toBe('34%');
    expect(financialMetrics.operatingMarginLabel).toBe('18%');
    expect(tocMetrics.entries.some((entry) => entry.title === 'Financial Overview')).toBe(true);
  });

  it('renders action plan groups with all three timeframes', async () => {
    const report = createReport();

    const buffer = await service.generate(
      report,
      createExtras(),
      createReportConfig({
        includeCategoryDetails: false,
        includeRecommendations: true,
        includeActionPlan: true,
        includeMethodology: false,
      }),
    );
    const actionPlanMetrics = (service as any).lastActionPlanLayoutMetrics as {
      startPageIndex: number;
      timeframeGroups: Array<{ timeframe: 'IMMEDIATE' | 'SHORT_TERM' | 'MEDIUM_TERM'; count: number }>;
    };
    const tocMetrics = (service as any).lastTocLayoutMetrics as {
      entries: Array<{ title: string; pageIndex: number; pageNumber: number; level: number }>;
    };

    expect(buffer.length).toBeGreaterThan(0);
    expect(actionPlanMetrics.startPageIndex).toBeGreaterThan(0);
    expect(actionPlanMetrics.timeframeGroups).toEqual([
      { timeframe: 'IMMEDIATE', count: 1 },
      { timeframe: 'SHORT_TERM', count: 1 },
      { timeframe: 'MEDIUM_TERM', count: 1 },
    ]);
    expect(tocMetrics.entries.some((entry) => entry.title === 'Action Plan')).toBe(true);
  });

  it('omits the action plan section when no action plan items are present', async () => {
    const report = createReport();
    report.actionPlanItems = [];

    const buffer = await service.generate(
      report,
      createExtras(),
      createReportConfig({
        includeCategoryDetails: false,
        includeRecommendations: true,
        includeActionPlan: true,
        includeMethodology: false,
      }),
    );
    const tocMetrics = (service as any).lastTocLayoutMetrics as {
      entries: Array<{ title: string; pageIndex: number; pageNumber: number; level: number }>;
    };
    const actionPlanMetrics = (service as any).lastActionPlanLayoutMetrics as {
      timeframeGroups: Array<{ timeframe: string; count: number }>;
    } | null;

    expect(buffer.length).toBeGreaterThan(0);
    expect(tocMetrics.entries.some((entry) => entry.title === 'Action Plan')).toBe(false);
    expect(actionPlanMetrics).toBeNull();
  });

  it('renders the disclaimer as the final page with four legal sections', async () => {
    const report = createReport();

    const buffer = await service.generate(
      report,
      createExtras(),
      createReportConfig({
        includeCategoryDetails: false,
        includeRecommendations: false,
        includeActionPlan: false,
        includeAppendix: false,
        includeMethodology: false,
      }),
    );
    const disclaimerMetrics = (service as any).lastDisclaimerLayoutMetrics as {
      startPageIndex: number;
      sectionCount: number;
      copyrightYear: number;
    };
    const tocMetrics = (service as any).lastTocLayoutMetrics as {
      entries: Array<{ title: string; pageIndex: number; pageNumber: number; level: number }>;
    };
    const headerFooterMetrics = (service as any).lastHeaderFooterLayoutMetrics as {
      contentPageTotal: number;
      pages: Array<{ pageIndex: number; footerLabel: string }>;
    };

    expect(buffer.length).toBeGreaterThan(0);
    expect(disclaimerMetrics.sectionCount).toBe(4);
    expect(disclaimerMetrics.startPageIndex).toBeGreaterThan(0);
    expect(disclaimerMetrics.copyrightYear).toBe(new Date().getFullYear());
    expect(tocMetrics.entries.at(-1)).toEqual({
      title: 'Disclaimer',
      pageIndex: disclaimerMetrics.startPageIndex,
      pageNumber: disclaimerMetrics.startPageIndex,
      level: 0,
    });
    expect(headerFooterMetrics.pages.at(-1)?.pageIndex).toBe(disclaimerMetrics.startPageIndex);
  });

  it('renders appendix tables for document sources and gap summary', async () => {
    const report = createReport();

    const buffer = await service.generate(
      report,
      createExtras(),
      createReportConfig({
        includeCategoryDetails: false,
        includeRecommendations: false,
        includeActionPlan: false,
        includeAppendix: true,
        includeEvidenceTraces: false,
        includeMethodology: false,
      }),
    );
    const appendixMetrics = (service as any).lastAppendixLayoutMetrics as {
      startPageIndex: number;
      documentSourceCount: number;
      gapSummaryCount: number;
      evidenceCategoryCount: number;
    };
    const tocMetrics = (service as any).lastTocLayoutMetrics as {
      entries: Array<{ title: string; pageIndex: number; pageNumber: number; level: number }>;
    };

    expect(buffer.length).toBeGreaterThan(0);
    expect(appendixMetrics.startPageIndex).toBeGreaterThan(0);
    expect(appendixMetrics.documentSourceCount).toBe(2);
    expect(appendixMetrics.gapSummaryCount).toBe(2);
    expect(appendixMetrics.evidenceCategoryCount).toBe(0);
    expect(tocMetrics.entries.some((entry) => entry.title === 'Appendix')).toBe(true);
  });

  it('renders appendix evidence blocks when evidence traces are enabled', async () => {
    const report = createReport();

    const buffer = await service.generate(
      report,
      createExtras(),
      createReportConfig({
        includeCategoryDetails: false,
        includeRecommendations: false,
        includeActionPlan: false,
        includeAppendix: true,
        includeEvidenceTraces: true,
        includeMethodology: false,
      }),
    );
    const appendixMetrics = (service as any).lastAppendixLayoutMetrics as {
      documentSourceCount: number;
      gapSummaryCount: number;
      evidenceCategoryCount: number;
    };

    expect(buffer.length).toBeGreaterThan(0);
    expect(appendixMetrics.documentSourceCount).toBe(2);
    expect(appendixMetrics.gapSummaryCount).toBe(2);
    expect(appendixMetrics.evidenceCategoryCount).toBe(7);
  });

  it('omits appendix when both document sources and gap summary are empty', async () => {
    const report = createReport();
    report.documentSources = [];
    report.gapSummary = [];

    const buffer = await service.generate(
      report,
      createExtras(),
      createReportConfig({
        includeCategoryDetails: false,
        includeRecommendations: false,
        includeActionPlan: false,
        includeAppendix: true,
        includeMethodology: false,
      }),
    );
    const tocMetrics = (service as any).lastTocLayoutMetrics as {
      entries: Array<{ title: string; pageIndex: number; pageNumber: number; level: number }>;
    };
    const appendixMetrics = (service as any).lastAppendixLayoutMetrics as {
      documentSourceCount: number;
      gapSummaryCount: number;
      evidenceCategoryCount: number;
    } | null;

    expect(buffer.length).toBeGreaterThan(0);
    expect(tocMetrics.entries.some((entry) => entry.title === 'Appendix')).toBe(false);
    expect(appendixMetrics).toBeNull();
  });

  it('skips the revenue chart when revenue data is missing', async () => {
    const report = createReport();
    report.financialMetrics = createFinancialMetrics({
      revenue: [],
    });

    const buffer = await service.generate(
      report,
      createExtras(),
      createReportConfig({
        includeCategoryDetails: false,
        includeRecommendations: false,
        includeFinancialCharts: true,
        includeMethodology: false,
      }),
    );
    const financialMetrics = (service as any).lastFinancialOverviewLayoutMetrics as {
      renderedRevenueChart: boolean;
      renderedCostChart: boolean;
      renderedMarginsSummary: boolean;
      revenuePointCount: number;
      costBarCount: number;
    };

    expect(buffer.length).toBeGreaterThan(0);
    expect(financialMetrics.renderedRevenueChart).toBe(false);
    expect(financialMetrics.revenuePointCount).toBe(0);
    expect(financialMetrics.renderedCostChart).toBe(true);
    expect(financialMetrics.costBarCount).toBe(3);
    expect(financialMetrics.renderedMarginsSummary).toBe(true);
  });

  it('omits the financial overview section when financial charts are enabled but no financial data exists', async () => {
    const report = createReport();
    report.financialMetrics = {
      revenue: [],
      costs: [],
      margins: { gross: null, operating: null },
    };

    const buffer = await service.generate(
      report,
      createExtras(),
      createReportConfig({
        includeFinancialCharts: true,
        includeCategoryDetails: false,
        includeRecommendations: false,
        includeActionPlan: false,
        includeAppendix: false,
        includeMethodology: false,
      }),
    );
    const tocMetrics = (service as any).lastTocLayoutMetrics as {
      entries: Array<{ title: string; pageIndex: number; pageNumber: number; level: number }>;
    };
    const financialMetrics = (service as any).lastFinancialOverviewLayoutMetrics as null | {
      renderedRevenueChart: boolean;
    };

    expect(buffer.length).toBeGreaterThan(0);
    expect(tocMetrics.entries.some((entry) => entry.title === 'Financial Overview')).toBe(false);
    expect(financialMetrics).toBeNull();
  });

  it('displays N/A margin labels when margins are null', async () => {
    const report = createReport();
    report.financialMetrics = createFinancialMetrics({
      margins: {
        gross: null,
        operating: null,
      },
    });

    const buffer = await service.generate(
      report,
      createExtras(),
      createReportConfig({
        includeCategoryDetails: false,
        includeRecommendations: false,
        includeFinancialCharts: true,
        includeMethodology: false,
      }),
    );
    const financialMetrics = (service as any).lastFinancialOverviewLayoutMetrics as {
      grossMarginLabel: string;
      operatingMarginLabel: string;
      renderedMarginsSummary: boolean;
    };

    expect(buffer.length).toBeGreaterThan(0);
    expect(financialMetrics.renderedMarginsSummary).toBe(true);
    expect(financialMetrics.grossMarginLabel).toBe('N/A');
    expect(financialMetrics.operatingMarginLabel).toBe('N/A');
  });

  it('handles missing companyType gracefully on the company profile page', async () => {
    const report = createReport();
    report.assessment.companyType = null;

    const buffer = await service.generate(
      report,
      undefined,
      createReportConfig({
        includeCategoryDetails: false,
        includeRecommendations: false,
        includeMethodology: false,
      }),
    );
    const companyProfileMetrics = (service as any).lastCompanyProfileLayoutMetrics as {
      rowCount: number;
      sectorIndustryValue: string;
      companyTypeValue: string;
      startPageIndex: number;
    };

    expect(buffer.length).toBeGreaterThan(0);
    expect(companyProfileMetrics.rowCount).toBe(7);
    expect(companyProfileMetrics.sectorIndustryValue).toBe('Not specified');
    expect(companyProfileMetrics.companyTypeValue).toBe('Not specified');
    expect(companyProfileMetrics.startPageIndex).toBe(2);
  });

  it('omits recommendation sections when all categories have zero recommendations', async () => {
    const report = createReport();
    report.categories = report.categories.map((category) => ({
      ...category,
      recommendations: [],
    }));
    report.actionPlanItems = [];

    const buffer = await service.generate(report, createExtras(), createReportConfig());
    const tocMetrics = (service as any).lastTocLayoutMetrics as {
      entries: Array<{ title: string; pageIndex: number; pageNumber: number; level: number }>;
    };
    const headerFooterMetrics = (service as any).lastHeaderFooterLayoutMetrics as {
      contentPageTotal: number;
      pages: Array<{ pageIndex: number; footerLabel: string }>;
    };

    expect(buffer.length).toBeGreaterThan(0);
    expect(tocMetrics.entries.some((entry) => entry.title === 'All Recommendations')).toBe(false);
    expect(headerFooterMetrics.contentPageTotal).toBe(15);
    expect(headerFooterMetrics.pages.at(-1)?.footerLabel).toBe('Page 15 of 15');
  });

  it('renders gracefully when evidence and narrative fields are missing', async () => {
    const report = createReport();
    report.categories = report.categories.map((category, index) => ({
      ...category,
      narrative: index % 2 === 0 ? null : category.narrative,
      evidence: null,
      analystComment: index % 3 === 0 ? null : category.analystComment,
      subcategories: category.subcategories.map((sub, subIndex) => ({
        ...sub,
        evidence: subIndex === 0 ? null : sub.evidence,
        mitigation: subIndex === 1 ? null : sub.mitigation,
      })),
    }));

    const buffer = await service.generate(report, undefined, createReportConfig({
      includeRecommendations: false,
      includeMethodology: true,
    }));
    const tocMetrics = (service as any).lastTocLayoutMetrics as {
      entries: Array<{ title: string; pageIndex: number; pageNumber: number; level: number }>;
    };
    const generationMetrics = (service as any).lastGenerationMetrics as {
      bufferedPageCount: number;
      footerPageIndexes: number[];
    };

    expect(buffer.length).toBeGreaterThan(0);
    expect(tocMetrics.entries.some((entry) => entry.title === 'Methodology')).toBe(true);
    expect(generationMetrics.bufferedPageCount).toBeGreaterThan(4);
    expect(generationMetrics.footerPageIndexes.length).toBe(generationMetrics.bufferedPageCount - 1);
  });

  it('adds pages cleanly for very long content while preserving TOC and footer integrity', async () => {
    const report = createReport();
    const longParagraph = 'Bluewave Fisheries is expanding climate-smart aquaculture operations across multiple regions while balancing working-capital pressure, compliance obligations, infrastructure constraints, and market execution risk.';
    report.executiveSummary = Array.from({ length: 12 }, () => longParagraph).join(' ');
    report.categories = report.categories.map((category) => ({
      ...category,
      narrative: Array.from({ length: 8 }, () => `${category.category} narrative ${longParagraph}`).join(' '),
      evidence: Array.from({ length: 6 }, () => `${category.category} evidence ${longParagraph}`).join(' '),
      analystComment: Array.from({ length: 4 }, () => `${category.category} analyst note ${longParagraph}`).join(' '),
      recommendations: category.recommendations.map((rec) => ({
        ...rec,
        text: Array.from({ length: 4 }, () => rec.text).join(' '),
      })),
    }));

    const buffer = await service.generate(report, {
      strengths: Array.from({ length: 5 }, () => longParagraph),
      weaknesses: Array.from({ length: 5 }, () => longParagraph),
      keyFindings: Array.from({ length: 4 }, () => longParagraph),
    }, createReportConfig());
    const generationMetrics = (service as any).lastGenerationMetrics as {
      bufferedPageCount: number;
      contentPageIndexes: number[];
      footerPageIndexes: number[];
    };
    const tocMetrics = (service as any).lastTocLayoutMetrics as {
      entries: Array<{ title: string; pageIndex: number; pageNumber: number; level: number }>;
    };
    const headerFooterMetrics = (service as any).lastHeaderFooterLayoutMetrics as {
      contentPageTotal: number;
      pages: Array<{ pageIndex: number; footerLabel: string }>;
    };

    expect(buffer.length).toBeGreaterThan(0);
    expect(generationMetrics.bufferedPageCount).toBeGreaterThan(14);
    expect(generationMetrics.contentPageIndexes.length).toBe(generationMetrics.bufferedPageCount);
    expect(generationMetrics.footerPageIndexes.length).toBe(generationMetrics.bufferedPageCount - 1);
    expect(tocMetrics.entries[0]).toEqual({ title: 'Company Profile', pageIndex: 2, pageNumber: 2, level: 0 });
    expect(tocMetrics.entries[1]).toEqual({ title: 'Executive Summary', pageIndex: 3, pageNumber: 3, level: 0 });
    expect(headerFooterMetrics.contentPageTotal).toBe(generationMetrics.bufferedPageCount - 1);
    expect(headerFooterMetrics.pages[0]?.footerLabel).toBe(`Page 1 of ${headerFooterMetrics.contentPageTotal}`);
  });
});
