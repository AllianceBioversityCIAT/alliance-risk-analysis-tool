import { GapDetectionHandler } from './gap-detection.handler';
import { GAP_DETECTION_CONFIG } from '../../../domain/gap-detection/gap-detection.config';

function createGapAIResponse() {
  return {
    fields: GAP_DETECTION_CONFIG.core10Fields.map(({ field }) => ({
      field,
      status: 'PARTIAL' as const,
      extractedValue: 'sample',
      confidence: 0.8,
      reasoning: 'Detected in document',
    })),
  };
}

describe('GapDetectionHandler', () => {
  const mockPrisma = {
    job: { findMany: jest.fn() },
    prompt: { findFirst: jest.fn() },
    gapField: { createMany: jest.fn() },
  };
  const mockBedrock = { invokeModel: jest.fn() };

  let handler: GapDetectionHandler;

  beforeEach(() => {
    jest.resetAllMocks();
    handler = new GapDetectionHandler(mockPrisma as never, mockBedrock as never);
  });

  it('injects assessment country into Bedrock prompts during upload mode', async () => {
    mockPrisma.job.findMany.mockResolvedValue([
      {
        input: { assessmentId: 'assessment-1', fileName: 'brief.pdf' },
        result: { markdownContent: 'Company operates in East Africa.' },
      },
    ]);
    mockPrisma.prompt.findFirst.mockResolvedValue({
      systemPrompt: 'You are a gap detector for {{country}} agriculture.',
      userPromptTemplate: 'Extract Core 10 fields for {{country}}:\n{{extracted_data}}',
    });
    mockPrisma.gapField.createMany.mockResolvedValue({ count: 10 });
    mockBedrock.invokeModel.mockResolvedValue({
      output: JSON.stringify(createGapAIResponse()),
      tokensUsed: 512,
    });

    await (handler as any).processUploadMode('assessment-1', 'Zambia', false);

    expect(mockBedrock.invokeModel).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining('Zambia'),
        userPrompt: expect.stringContaining('Zambia'),
      }),
    );
    expect(mockBedrock.invokeModel.mock.calls[0][0].systemPrompt).not.toContain('{{country}}');
  });
});
