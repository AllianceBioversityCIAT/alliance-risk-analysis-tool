import { Test, TestingModule } from '@nestjs/testing';
import { RiskAnalysisHandler } from './risk-analysis.handler';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { BedrockService } from '../../../infrastructure/bedrock/bedrock.service';

const mockAIResponse = {
  categories: [
    {
      category: 'FINANCIAL',
      score: 45,
      level: 'MODERATE',
      narrative: 'Financial risk is moderate with some concerns about revenue stability.',
      evidence: 'Based on revenue model and cost structure analysis.',
      subcategories: [
        { name: 'Revenue Stability', indicator: 'Revenue streams analysis', score: 40, level: 'MODERATE', evidence: 'Some diversification', mitigation: 'Diversify revenue sources' },
        { name: 'Cost Structure', indicator: 'Cost efficiency', score: 50, level: 'MODERATE', evidence: 'High fixed costs', mitigation: 'Optimize operational costs' },
        { name: 'Debt Levels', indicator: 'Leverage ratios', score: 35, level: 'MODERATE', evidence: 'Manageable debt', mitigation: null },
        { name: 'Cash Flow', indicator: 'Cash flow adequacy', score: 55, level: 'MODERATE', evidence: 'Seasonal variations', mitigation: 'Build cash reserves' },
        { name: 'Financial Controls', indicator: 'Internal controls', score: 45, level: 'MODERATE', evidence: null, mitigation: 'Implement formal accounting' },
      ],
      recommendations: [
        { text: 'Diversify revenue streams to reduce dependency', priority: 'HIGH' },
        { text: 'Implement formal financial reporting', priority: 'MEDIUM' },
      ],
    },
    {
      category: 'CLIMATE_ENVIRONMENTAL',
      score: 60,
      level: 'MODERATE',
      narrative: 'Climate exposure is significant for agricultural operations.',
      evidence: 'Weather patterns and crop dependency.',
      subcategories: [
        { name: 'Weather Exposure', indicator: 'Weather vulnerability', score: 70, level: 'HIGH', evidence: 'Rain-dependent crops', mitigation: 'Invest in irrigation' },
        { name: 'Climate Adaptation', indicator: 'Adaptation capacity', score: 55, level: 'MODERATE', evidence: null, mitigation: null },
        { name: 'Resource Sustainability', indicator: 'Resource use', score: 50, level: 'MODERATE', evidence: null, mitigation: null },
        { name: 'Environmental Compliance', indicator: 'Compliance', score: 45, level: 'MODERATE', evidence: null, mitigation: null },
        { name: 'Disaster Preparedness', indicator: 'Disaster plans', score: 80, level: 'HIGH', evidence: 'No disaster plan', mitigation: 'Develop contingency plan' },
      ],
      recommendations: [
        { text: 'Develop a climate adaptation strategy', priority: 'HIGH' },
      ],
    },
    {
      category: 'BEHAVIORAL',
      score: 35,
      level: 'MODERATE',
      narrative: 'Management team shows adequate capability.',
      evidence: 'Team experience assessment.',
      subcategories: [
        { name: 'Management Capability', indicator: 'Leadership', score: 30, level: 'LOW', evidence: null, mitigation: null },
        { name: 'Decision-Making Patterns', indicator: 'Decisions', score: 35, level: 'MODERATE', evidence: null, mitigation: null },
        { name: 'Risk Awareness', indicator: 'Risk understanding', score: 40, level: 'MODERATE', evidence: null, mitigation: null },
        { name: 'Change Readiness', indicator: 'Adaptability', score: 30, level: 'LOW', evidence: null, mitigation: null },
        { name: 'Stakeholder Relationships', indicator: 'Relationships', score: 40, level: 'MODERATE', evidence: null, mitigation: null },
      ],
      recommendations: [
        { text: 'Strengthen stakeholder engagement', priority: 'MEDIUM' },
      ],
    },
    {
      category: 'OPERATIONAL',
      score: 50,
      level: 'MODERATE',
      narrative: 'Operations are functional but lack standardization.',
      evidence: 'Process maturity evaluation.',
      subcategories: [
        { name: 'Supply Chain', indicator: 'Supply reliability', score: 55, level: 'MODERATE', evidence: null, mitigation: null },
        { name: 'Production Capacity', indicator: 'Capacity', score: 45, level: 'MODERATE', evidence: null, mitigation: null },
        { name: 'Process Maturity', indicator: 'Process docs', score: 60, level: 'MODERATE', evidence: null, mitigation: null },
        { name: 'Quality Controls', indicator: 'QA', score: 40, level: 'MODERATE', evidence: null, mitigation: null },
        { name: 'Workforce Capability', indicator: 'Skills', score: 50, level: 'MODERATE', evidence: null, mitigation: null },
      ],
      recommendations: [
        { text: 'Document key operational processes', priority: 'MEDIUM' },
      ],
    },
    {
      category: 'MARKET',
      score: 40,
      level: 'MODERATE',
      narrative: 'Market positioning is adequate with room for diversification.',
      evidence: 'Market analysis data.',
      subcategories: [
        { name: 'Market Access', indicator: 'Market reach', score: 35, level: 'MODERATE', evidence: null, mitigation: null },
        { name: 'Price Volatility', indicator: 'Price risk', score: 55, level: 'MODERATE', evidence: null, mitigation: null },
        { name: 'Competition', indicator: 'Competition', score: 40, level: 'MODERATE', evidence: null, mitigation: null },
        { name: 'Demand Trends', indicator: 'Demand', score: 30, level: 'LOW', evidence: null, mitigation: null },
        { name: 'Market Diversification', indicator: 'Diversification', score: 40, level: 'MODERATE', evidence: null, mitigation: null },
      ],
      recommendations: [
        { text: 'Explore new market channels', priority: 'LOW' },
      ],
    },
    {
      category: 'GOVERNANCE_LEGAL',
      score: 30,
      level: 'LOW',
      narrative: 'Governance structure is basic but compliant.',
      evidence: 'Legal review.',
      subcategories: [
        { name: 'Legal Compliance', indicator: 'Compliance', score: 25, level: 'LOW', evidence: null, mitigation: null },
        { name: 'Governance Structure', indicator: 'Board', score: 30, level: 'LOW', evidence: null, mitigation: null },
        { name: 'Regulatory Risk', indicator: 'Regulation', score: 35, level: 'MODERATE', evidence: null, mitigation: null },
        { name: 'Contractual Obligations', indicator: 'Contracts', score: 25, level: 'LOW', evidence: null, mitigation: null },
        { name: 'Transparency', indicator: 'Reporting', score: 35, level: 'MODERATE', evidence: null, mitigation: null },
      ],
      recommendations: [
        { text: 'Formalize governance documentation', priority: 'LOW' },
      ],
    },
    {
      category: 'TECHNOLOGY_DATA',
      score: 55,
      level: 'MODERATE',
      narrative: 'Technology adoption is below average for the sector.',
      evidence: 'IT infrastructure assessment.',
      subcategories: [
        { name: 'Technology Adoption', indicator: 'Tech use', score: 60, level: 'MODERATE', evidence: null, mitigation: null },
        { name: 'Data Management', indicator: 'Data practices', score: 55, level: 'MODERATE', evidence: null, mitigation: null },
        { name: 'Cybersecurity', indicator: 'Security', score: 50, level: 'MODERATE', evidence: null, mitigation: null },
        { name: 'Digital Infrastructure', indicator: 'Infrastructure', score: 60, level: 'MODERATE', evidence: null, mitigation: null },
        { name: 'Innovation Capacity', indicator: 'Innovation', score: 50, level: 'MODERATE', evidence: null, mitigation: null },
      ],
      recommendations: [
        { text: 'Invest in agricultural technology tools', priority: 'MEDIUM' },
      ],
    },
  ],
};

describe('RiskAnalysisHandler', () => {
  let handler: RiskAnalysisHandler;
  let prisma: jest.Mocked<PrismaService>;
  let bedrock: jest.Mocked<BedrockService>;

  const mockAssessmentId = 'test-assessment-id';

  beforeEach(async () => {
    const mockPrisma = {
      assessment: {
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
      gapField: {
        findMany: jest.fn(),
      },
      job: {
        findMany: jest.fn(),
      },
      interviewAnswer: {
        findMany: jest.fn(),
      },
      dataEntry: {
        findMany: jest.fn(),
      },
      prompt: {
        findFirst: jest.fn(),
      },
      riskScore: {
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
      recommendation: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
        create: jest.fn(),
      },
    };

    const mockBedrock = {
      invokeModel: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RiskAnalysisHandler,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BedrockService, useValue: mockBedrock },
      ],
    }).compile();

    handler = module.get<RiskAnalysisHandler>(RiskAnalysisHandler);
    prisma = module.get(PrismaService);
    bedrock = module.get(BedrockService);
  });

  function setupDefaultMocks() {
    (prisma.assessment.findUniqueOrThrow as jest.Mock).mockResolvedValue({
      id: mockAssessmentId,
      companyName: 'Test Farm',
      country: 'Nigeria',
      intakeMode: 'UPLOAD',
    });

    (prisma.gapField.findMany as jest.Mock).mockResolvedValue([
      { field: 'business_model_summary', label: 'Business Model Summary', extractedValue: 'Test business model', correctedValue: null, status: 'VERIFIED' },
      { field: 'revenue_model', label: 'Revenue Model', extractedValue: 'Crop sales', correctedValue: null, status: 'VERIFIED' },
    ]);

    (prisma.job.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.interviewAnswer.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.dataEntry.findMany as jest.Mock).mockResolvedValue([]);

    (prisma.prompt.findFirst as jest.Mock).mockResolvedValue({
      systemPrompt: 'You are a risk analyst for {{country}}.',
      userPromptTemplate: 'Analyze in {{country}}: {{business_data}} Documents: {{document_content}}',
    });

    (prisma.riskScore.findMany as jest.Mock).mockImplementation(async (args) => {
      // When called with select: { id: true } → existing scores check (pre-delete)
      if (args.select?.id) return [];
      // When called with select: { score: true } → overall score re-calculation
      if (args.select?.score) {
        return [
          { score: 45 }, { score: 60 }, { score: 35 },
          { score: 50 }, { score: 40 }, { score: 30 }, { score: 55 },
        ];
      }
      return [];
    });
    (prisma.recommendation.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.riskScore.upsert as jest.Mock).mockImplementation(async (args) => ({
      id: `score-${args.where.assessmentId_category.category}`,
      ...args.create,
    }));
    (prisma.recommendation.createMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.assessment.update as jest.Mock).mockResolvedValue({});
  }

  it('should parse valid AI response and create 7 risk scores', async () => {
    setupDefaultMocks();
    (bedrock.invokeModel as jest.Mock).mockResolvedValue({
      output: JSON.stringify(mockAIResponse),
      tokensUsed: 5000,
    });

    const result = await handler.execute({ assessmentId: mockAssessmentId });

    expect(result.categoriesScored).toBe(7);
    expect(result.overallScore).toBeGreaterThan(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
    expect(result.bedrockTokensUsed).toBe(5000);
    expect(prisma.riskScore.upsert).toHaveBeenCalledTimes(7);
    expect(prisma.assessment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'COMPLETE',
          progress: 90,
        }),
      }),
    );
  });

  it('should parse JSON wrapped in markdown code fences', async () => {
    setupDefaultMocks();
    const wrappedOutput = '```json\n' + JSON.stringify(mockAIResponse) + '\n```';
    (bedrock.invokeModel as jest.Mock).mockResolvedValue({
      output: wrappedOutput,
      tokensUsed: 5000,
    });

    const result = await handler.execute({ assessmentId: mockAssessmentId });
    expect(result.categoriesScored).toBe(7);
  });

  it('should create fallback scores on Bedrock failure', async () => {
    setupDefaultMocks();
    (bedrock.invokeModel as jest.Mock).mockRejectedValue(new Error('Bedrock timeout'));
    (prisma.recommendation.create as jest.Mock).mockResolvedValue({});

    const result = await handler.execute({ assessmentId: mockAssessmentId });

    expect(result.categoriesScored).toBe(7);
    expect(result.overallScore).toBe(50);
    expect(result.bedrockTokensUsed).toBe(0);
  });

  it('should create fallback scores on JSON parse failure', async () => {
    setupDefaultMocks();
    (bedrock.invokeModel as jest.Mock).mockResolvedValue({
      output: 'This is not valid JSON at all',
      tokensUsed: 1000,
    });
    (prisma.recommendation.create as jest.Mock).mockResolvedValue({});

    const result = await handler.execute({ assessmentId: mockAssessmentId });

    expect(result.categoriesScored).toBe(7);
    expect(result.overallScore).toBe(50);
  });

  it('should throw if no prompt found', async () => {
    setupDefaultMocks();
    (prisma.prompt.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(handler.execute({ assessmentId: mockAssessmentId })).rejects.toThrow(
      'No active risk_analysis prompt found',
    );
  });

  it('should delete existing recommendations before creating new ones (idempotency)', async () => {
    setupDefaultMocks();
    (prisma.riskScore.findMany as jest.Mock).mockImplementation(async (args) => {
      if (args.select?.id) return [{ id: 'existing-score-1' }, { id: 'existing-score-2' }];
      if (args.select?.score) {
        return [
          { score: 45 }, { score: 60 }, { score: 35 },
          { score: 50 }, { score: 40 }, { score: 30 }, { score: 55 },
        ];
      }
      return [];
    });
    (bedrock.invokeModel as jest.Mock).mockResolvedValue({
      output: JSON.stringify(mockAIResponse),
      tokensUsed: 5000,
    });

    await handler.execute({ assessmentId: mockAssessmentId });

    expect(prisma.recommendation.deleteMany).toHaveBeenCalledWith({
      where: { riskScoreId: { in: ['existing-score-1', 'existing-score-2'] } },
    });
  });

  it('should inject assessment country into Bedrock prompts', async () => {
    setupDefaultMocks();
    (bedrock.invokeModel as jest.Mock).mockResolvedValue({
      output: JSON.stringify(mockAIResponse),
      tokensUsed: 5000,
    });

    await handler.execute({ assessmentId: mockAssessmentId });

    expect(bedrock.invokeModel).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining('Nigeria'),
        userPrompt: expect.stringContaining('Nigeria'),
      }),
    );
  });

  it('should compute correct overall score as average', async () => {
    setupDefaultMocks();
    (bedrock.invokeModel as jest.Mock).mockResolvedValue({
      output: JSON.stringify(mockAIResponse),
      tokensUsed: 5000,
    });

    const result = await handler.execute({ assessmentId: mockAssessmentId });

    // Expected: (45 + 60 + 35 + 50 + 40 + 30 + 55) / 7 = 315 / 7 = 45
    expect(result.overallScore).toBe(45);
  });
});
