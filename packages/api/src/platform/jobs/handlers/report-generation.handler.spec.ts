import { ReportGenerationHandler } from './report-generation.handler';

function createAssessment() {
  return {
    id: 'assessment-1',
    name: 'Bluewave Fisheries Risk Assessment',
    companyName: 'Bluewave Fisheries',
    companyType: 'SME',
    country: 'Kenya',
    status: 'COMPLETE',
    intakeMode: 'UPLOAD',
    progress: 100,
    version: 1,
    overallRiskScore: 58,
    overallRiskLevel: 'MODERATE',
    createdAt: new Date('2026-04-08T00:00:00.000Z'),
    updatedAt: new Date('2026-04-08T00:00:00.000Z'),
  };
}

function createRiskScores() {
  return [
    {
      id: 'risk-1',
      category: 'FINANCIAL',
      score: 65,
      level: 'HIGH',
      subcategories: [],
      evidence: 'Financial evidence',
      narrative: 'Financial narrative',
      analystComment: 'Analyst comment',
      recommendations: [
        {
          id: 'rec-1',
          text: 'Secure bridge financing.',
          priority: 'HIGH',
          isEdited: false,
          editedText: null,
          order: 0,
        },
      ],
    },
    {
      id: 'risk-2',
      category: 'OPERATIONAL',
      score: 54,
      level: 'MODERATE',
      subcategories: [],
      evidence: 'Operational evidence',
      narrative: 'Operational narrative',
      analystComment: 'Operational comment',
      recommendations: [
        {
          id: 'rec-2',
          text: 'Document SOPs.',
          priority: 'MEDIUM',
          isEdited: false,
          editedText: null,
          order: 0,
        },
      ],
    },
  ];
}

function createPrompt() {
  return {
    systemPrompt: 'Generate a report',
    userPromptTemplate: 'Analyze\n{{risk_results}}',
  };
}

describe('ReportGenerationHandler', () => {
  const mockPrisma = {
    assessment: { findUniqueOrThrow: jest.fn(), update: jest.fn() },
    riskScore: { findMany: jest.fn() },
    prompt: { findFirst: jest.fn() },
    job: { findMany: jest.fn(), update: jest.fn() },
    assessmentDocument: { findMany: jest.fn() },
    gapField: { findMany: jest.fn() },
  };
  const mockBedrock = { invokeModel: jest.fn() };
  const mockStorage = {
    buildReportKey: jest.fn(),
    uploadBuffer: jest.fn(),
    generatePresignedDownloadUrl: jest.fn(),
  };
  const mockPdfService = { generate: jest.fn() };

  let handler: ReportGenerationHandler;

  beforeEach(() => {
    jest.resetAllMocks();
    mockStorage.buildReportKey.mockReturnValue('reports/assessment-1/report-1.pdf');
    mockStorage.uploadBuffer.mockResolvedValue(undefined);
    mockStorage.generatePresignedDownloadUrl.mockResolvedValue('https://example.com/report.pdf');
    mockPdfService.generate.mockResolvedValue(Buffer.from('pdf'));
    handler = new ReportGenerationHandler(
      mockPrisma as never,
      mockBedrock as never,
      mockStorage as never,
      mockPdfService as never,
    );
  });

  it('returns fallback action-plan assignments when Bedrock fails', async () => {
    mockBedrock.invokeModel.mockRejectedValue(new Error('bedrock unavailable'));

    const result = await (handler as any).assignActionPlanTimeframes([
      { category: 'FINANCIAL', priority: 'HIGH', text: 'Secure bridge financing.' },
      { category: 'OPERATIONAL', priority: 'MEDIUM', text: 'Document SOPs.' },
      { category: 'MARKET', priority: 'LOW', text: 'Expand channel coverage.' },
    ]);

    expect(result).toEqual([
      { category: 'FINANCIAL', priority: 'HIGH', text: 'Secure bridge financing.', timeframe: 'IMMEDIATE' },
      { category: 'OPERATIONAL', priority: 'MEDIUM', text: 'Document SOPs.', timeframe: 'SHORT_TERM' },
      { category: 'MARKET', priority: 'LOW', text: 'Expand channel coverage.', timeframe: 'MEDIUM_TERM' },
    ]);
  });

  it('parses action-plan assignments from fenced JSON output', async () => {
    mockBedrock.invokeModel.mockResolvedValue({
      output: '```json\n{"assignments":[{"index":0,"timeframe":"SHORT_TERM"},{"index":1,"timeframe":"IMMEDIATE"}]}\n```',
    });

    const result = await (handler as any).assignActionPlanTimeframes([
      { category: 'FINANCIAL', priority: 'HIGH', text: 'Secure bridge financing.' },
      { category: 'OPERATIONAL', priority: 'MEDIUM', text: 'Document SOPs.' },
    ]);

    expect(result).toEqual([
      { category: 'FINANCIAL', priority: 'HIGH', text: 'Secure bridge financing.', timeframe: 'SHORT_TERM' },
      { category: 'OPERATIONAL', priority: 'MEDIUM', text: 'Document SOPs.', timeframe: 'IMMEDIATE' },
    ]);
  });

  it('maps appendix document sources from assessment documents', async () => {
    mockPrisma.assessmentDocument.findMany.mockResolvedValue([
      {
        fileName: 'financials-2025.pdf',
        mimeType: 'application/pdf',
        fileSize: 182345,
      },
      {
        fileName: 'operations.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        fileSize: 98412,
      },
    ]);

    const result = await (handler as any).fetchDocumentSources('assessment-1');

    expect(result).toEqual([
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
    ]);
  });

  it('maps appendix gap summary from gap fields', async () => {
    mockPrisma.gapField.findMany.mockResolvedValue([
      {
        field: 'annual_revenue',
        status: 'PARTIAL',
        extractedValue: '1200000',
        correctedValue: '1250000',
      },
      {
        field: 'export_market',
        status: 'VERIFIED',
        extractedValue: 'Uganda',
        correctedValue: null,
      },
    ]);

    const result = await (handler as any).fetchGapSummary('assessment-1');

    expect(result).toEqual([
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
    ]);
  });

  it('uses fallback action-plan timeframes during execute when Bedrock assignment fails', async () => {
    mockPrisma.assessment.findUniqueOrThrow.mockResolvedValue(createAssessment());
    mockPrisma.riskScore.findMany.mockResolvedValue(createRiskScores());
    mockPrisma.prompt.findFirst.mockResolvedValue(createPrompt());
    mockPrisma.assessment.update.mockResolvedValue({});
    mockBedrock.invokeModel
      .mockResolvedValueOnce({
        output: JSON.stringify({
          executiveSummary: 'Summary',
          strengths: ['Strong demand'],
          weaknesses: ['Weak controls'],
          keyFindings: ['Finding'],
        }),
        tokensUsed: 321,
      })
      .mockRejectedValueOnce(new Error('bedrock unavailable'));

    await handler.execute({
      assessmentId: 'assessment-1',
      reportConfig: {
        includeRadarChart: true,
        includeCategoryDetails: true,
        includeSubcategoryCharts: false,
        subcategoryChartType: 'bar',
        includeFinancialCharts: false,
        includeRecommendations: true,
        includeEvidenceTraces: false,
        includeMethodology: true,
        includeCompanyProfile: true,
        includeRiskHeatmap: true,
        includeActionPlan: true,
        includeAppendix: false,
      },
    });

    expect(mockPdfService.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        actionPlanItems: [
          expect.objectContaining({ category: 'FINANCIAL', priority: 'HIGH', timeframe: 'IMMEDIATE' }),
          expect.objectContaining({ category: 'OPERATIONAL', priority: 'MEDIUM', timeframe: 'SHORT_TERM' }),
        ],
      }),
      expect.any(Object),
      expect.any(Object),
    );
  });

  it('emits stage progress updates in order when a jobId is provided', async () => {
    mockPrisma.assessment.findUniqueOrThrow.mockResolvedValue(createAssessment());
    mockPrisma.riskScore.findMany.mockResolvedValue(createRiskScores());
    mockPrisma.prompt.findFirst.mockResolvedValue(createPrompt());
    mockPrisma.job.findMany.mockResolvedValue([]);
    mockPrisma.assessmentDocument.findMany.mockResolvedValue([]);
    mockPrisma.gapField.findMany.mockResolvedValue([]);
    mockPrisma.assessment.update.mockResolvedValue({});
    mockPrisma.job.update.mockResolvedValue({});
    mockBedrock.invokeModel
      .mockResolvedValueOnce({
        output: JSON.stringify({
          executiveSummary: 'Summary',
          strengths: ['Strong demand'],
          weaknesses: ['Weak controls'],
          keyFindings: ['Finding'],
        }),
        tokensUsed: 150,
      })
      .mockResolvedValueOnce({
        output: JSON.stringify({
          assignments: [
            { index: 0, timeframe: 'IMMEDIATE' },
            { index: 1, timeframe: 'SHORT_TERM' },
          ],
        }),
        tokensUsed: 80,
      });

    await handler.execute(
      {
        assessmentId: 'assessment-1',
        reportConfig: {
          includeRadarChart: true,
          includeCategoryDetails: true,
          includeSubcategoryCharts: false,
          subcategoryChartType: 'bar',
          includeFinancialCharts: false,
          includeRecommendations: true,
          includeEvidenceTraces: false,
          includeMethodology: true,
          includeCompanyProfile: true,
          includeRiskHeatmap: true,
          includeActionPlan: true,
          includeAppendix: false,
        },
      },
      { jobId: 'job-42' },
    );

    const stageCalls = mockPrisma.job.update.mock.calls.map(([arg]) => {
      const data = (arg as { data: { result: { stage: string; stageIndex: number; stageTotal: number } } }).data;
      return {
        id: (arg as { where: { id: string } }).where.id,
        stage: data.result.stage,
        stageIndex: data.result.stageIndex,
        stageTotal: data.result.stageTotal,
      };
    });

    // Expected stages for this config: LOADING_DATA → GENERATING_SUMMARY →
    // PLANNING_ACTIONS → RENDERING_PDF → UPLOADING (financial + appendix skipped).
    expect(stageCalls).toEqual([
      { id: 'job-42', stage: 'LOADING_DATA', stageIndex: 1, stageTotal: 5 },
      { id: 'job-42', stage: 'GENERATING_SUMMARY', stageIndex: 2, stageTotal: 5 },
      { id: 'job-42', stage: 'PLANNING_ACTIONS', stageIndex: 3, stageTotal: 5 },
      { id: 'job-42', stage: 'RENDERING_PDF', stageIndex: 4, stageTotal: 5 },
      { id: 'job-42', stage: 'UPLOADING', stageIndex: 5, stageTotal: 5 },
    ]);
  });

  it('does not emit stage updates when no jobId is provided (backwards compatible)', async () => {
    mockPrisma.assessment.findUniqueOrThrow.mockResolvedValue(createAssessment());
    mockPrisma.riskScore.findMany.mockResolvedValue(createRiskScores());
    mockPrisma.prompt.findFirst.mockResolvedValue(createPrompt());
    mockPrisma.assessment.update.mockResolvedValue({});
    mockPrisma.job.update.mockResolvedValue({});
    mockBedrock.invokeModel.mockResolvedValueOnce({
      output: JSON.stringify({
        executiveSummary: 'Summary',
        strengths: ['Strong demand'],
        weaknesses: ['Weak controls'],
        keyFindings: ['Finding'],
      }),
      tokensUsed: 120,
    });

    await handler.execute({
      assessmentId: 'assessment-1',
      reportConfig: {
        includeRadarChart: true,
        includeCategoryDetails: true,
        includeSubcategoryCharts: false,
        subcategoryChartType: 'bar',
        includeFinancialCharts: false,
        includeRecommendations: true,
        includeEvidenceTraces: false,
        includeMethodology: true,
        includeCompanyProfile: true,
        includeRiskHeatmap: true,
        includeActionPlan: false,
        includeAppendix: false,
      },
    });

    expect(mockPrisma.job.update).not.toHaveBeenCalled();
  });

  it('omits financial metrics and appendix payloads during execute when no source data exists', async () => {
    mockPrisma.assessment.findUniqueOrThrow.mockResolvedValue(createAssessment());
    mockPrisma.riskScore.findMany.mockResolvedValue(createRiskScores());
    mockPrisma.prompt.findFirst.mockResolvedValue(createPrompt());
    mockPrisma.job.findMany.mockResolvedValue([]);
    mockPrisma.assessmentDocument.findMany.mockResolvedValue([]);
    mockPrisma.gapField.findMany.mockResolvedValue([]);
    mockPrisma.assessment.update.mockResolvedValue({});
    mockBedrock.invokeModel.mockResolvedValueOnce({
      output: JSON.stringify({
        executiveSummary: 'Summary',
        strengths: ['Strong demand'],
        weaknesses: ['Weak controls'],
        keyFindings: ['Finding'],
      }),
      tokensUsed: 120,
    });

    await handler.execute({
      assessmentId: 'assessment-1',
      reportConfig: {
        includeRadarChart: true,
        includeCategoryDetails: true,
        includeSubcategoryCharts: false,
        subcategoryChartType: 'bar',
        includeFinancialCharts: true,
        includeRecommendations: true,
        includeEvidenceTraces: false,
        includeMethodology: true,
        includeCompanyProfile: true,
        includeRiskHeatmap: true,
        includeActionPlan: false,
        includeAppendix: true,
      },
    });

    expect(mockPdfService.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        financialMetrics: undefined,
        documentSources: undefined,
        gapSummary: undefined,
      }),
      expect.any(Object),
      expect.any(Object),
    );
  });
});
