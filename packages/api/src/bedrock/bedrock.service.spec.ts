import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BedrockService } from './bedrock.service';

// Mock the AWS SDK
const mockSend = jest.fn();
jest.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: jest.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  InvokeModelCommand: jest.fn().mockImplementation((params) => params),
}));

const mockConfigService = {
  get: jest.fn((key: string) => {
    if (key === 'AWS_REGION') return 'us-east-1';
    return undefined;
  }),
};

function makeBedrockResponse(text: string, inputTokens = 100, outputTokens = 50) {
  const body = JSON.stringify({
    content: [{ type: 'text', text }],
    usage: { input_tokens: inputTokens, output_tokens: outputTokens },
  });
  return { body: Buffer.from(body) };
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
    it('calls Bedrock and returns output, tokensUsed, processingTime', async () => {
      mockSend.mockResolvedValue(makeBedrockResponse('Risk analysis result', 100, 50));

      const result = await service.invokeModel({
        modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
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
          modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
          systemPrompt: 'test',
          userPrompt: 'test',
        }),
      ).rejects.toThrow('Service unavailable');
    });

    it('handles empty content array gracefully', async () => {
      const body = JSON.stringify({ content: [], usage: { input_tokens: 10, output_tokens: 0 } });
      mockSend.mockResolvedValue({ body: Buffer.from(body) });

      const result = await service.invokeModel({
        modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
        systemPrompt: 'test',
        userPrompt: 'test',
      });

      expect(result.output).toBe('');
      expect(result.tokensUsed).toBe(10);
    });
  });

  describe('preview()', () => {
    it('calls invokeModel with substituted variables', async () => {
      mockSend.mockResolvedValue(makeBedrockResponse('Preview output'));

      const result = await service.preview({
        systemPrompt: 'You are an expert',
        userPromptTemplate: 'Analyze {{category}}',
        variables: { category: 'Financial' },
      });

      expect(result.output).toBe('Preview output');
      expect(mockSend).toHaveBeenCalledTimes(1);

      // Verify variable substitution happened in the body
      const sentCommand = mockSend.mock.calls[0][0];
      const body = JSON.parse(Buffer.from(sentCommand.body).toString('utf-8')) as {
        messages: Array<{ role: string; content: string }>;
      };
      expect(body.messages[0].content).toBe('Analyze Financial');
    });

    it('leaves unmatched variables as-is', async () => {
      mockSend.mockResolvedValue(makeBedrockResponse('output'));

      await service.preview({
        systemPrompt: 'test',
        userPromptTemplate: 'Analyze {{unknown}}',
      });

      const sentCommand = mockSend.mock.calls[0][0];
      const body = JSON.parse(Buffer.from(sentCommand.body).toString('utf-8')) as {
        messages: Array<{ role: string; content: string }>;
      };
      expect(body.messages[0].content).toBe('Analyze {{unknown}}');
    });
  });
});
