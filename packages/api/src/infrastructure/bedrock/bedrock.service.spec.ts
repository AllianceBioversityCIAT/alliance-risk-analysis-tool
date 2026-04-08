import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BedrockService } from './bedrock.service';

// Mock the AWS SDK
const mockSend = jest.fn();
jest.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: jest.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  ConverseCommand: jest.fn().mockImplementation((params) => params),
}));

const mockConfigService = {
  get: jest.fn((key: string) => {
    if (key === 'AWS_REGION') return 'us-east-1';
    return undefined;
  }),
};

function makeConverseResponse(text: string, inputTokens = 100, outputTokens = 50) {
  return {
    output: {
      message: {
        content: [{ text }],
      },
    },
    usage: { inputTokens, outputTokens },
  };
}

describe('BedrockService', () => {
  let service: BedrockService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        BedrockService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get(BedrockService);
  });

  describe('invokeModel()', () => {
    it('calls Bedrock Converse API and returns output, tokensUsed, processingTime', async () => {
      mockSend.mockResolvedValue(makeConverseResponse('Risk analysis result', 100, 50));

      const result = await service.invokeModel({
        modelId: 'moonshotai.kimi-k2.5',
        systemPrompt: 'You are an expert',
        userPrompt: 'Analyze this',
      });

      expect(result.output).toBe('Risk analysis result');
      expect(result.tokensUsed).toBe(150);
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('throws when Bedrock returns an error', async () => {
      mockSend.mockRejectedValue(new Error('Service unavailable'));

      await expect(
        service.invokeModel({
          modelId: 'moonshotai.kimi-k2.5',
          systemPrompt: 'test',
          userPrompt: 'test',
        }),
      ).rejects.toThrow('Service unavailable');
    });

    it('handles empty content array gracefully', async () => {
      mockSend.mockResolvedValue({
        output: { message: { content: [] } },
        usage: { inputTokens: 10, outputTokens: 0 },
      });

      const result = await service.invokeModel({
        modelId: 'moonshotai.kimi-k2.5',
        systemPrompt: 'test',
        userPrompt: 'test',
      });

      expect(result.output).toBe('');
      expect(result.tokensUsed).toBe(10);
    });

    it('handles missing output gracefully', async () => {
      mockSend.mockResolvedValue({
        output: {},
        usage: { inputTokens: 5, outputTokens: 0 },
      });

      const result = await service.invokeModel({
        modelId: 'moonshotai.kimi-k2.5',
        systemPrompt: 'test',
        userPrompt: 'test',
      });

      expect(result.output).toBe('');
      expect(result.tokensUsed).toBe(5);
    });
  });

  describe('preview()', () => {
    it('calls invokeModel with substituted variables', async () => {
      mockSend.mockResolvedValue(makeConverseResponse('Preview output'));

      const result = await service.preview({
        systemPrompt: 'You are an expert',
        userPromptTemplate: 'Analyze {{category}}',
        variables: { category: 'Financial' },
      });

      expect(result.output).toBe('Preview output');
      expect(mockSend).toHaveBeenCalledTimes(1);

      // Verify the ConverseCommand was constructed with correct params
      const sentCommand = mockSend.mock.calls[0][0];
      expect(sentCommand.messages[0].content[0].text).toBe('Analyze Financial');
    });

    it('leaves unmatched variables as-is', async () => {
      mockSend.mockResolvedValue(makeConverseResponse('output'));

      await service.preview({
        systemPrompt: 'test',
        userPromptTemplate: 'Analyze {{unknown}}',
      });

      const sentCommand = mockSend.mock.calls[0][0];
      expect(sentCommand.messages[0].content[0].text).toBe('Analyze {{unknown}}');
    });
  });
});
