import { Injectable, Logger } from '@nestjs/common';
import {
  BedrockRuntimeClient,
  ConverseCommand,
  type Message,
  type SystemContentBlock,
  type InferenceConfiguration,
} from '@aws-sdk/client-bedrock-runtime';
import { ConfigService } from '@nestjs/config';
import type { PromptPreviewRequest, PromptPreviewResponse } from '@alliance-risk/shared';
import { BEDROCK_MODELS, AgentSection } from '@alliance-risk/shared';
import { CircuitBreaker } from '../../common/utils/circuit-breaker';
import { withRetry } from '../../common/utils/retry';

export interface InvokeModelParams {
  modelId: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
}

@Injectable()
export class BedrockService {
  private readonly logger = new Logger(BedrockService.name);
  private readonly client: BedrockRuntimeClient;
  private readonly circuitBreaker: CircuitBreaker;

  constructor(private readonly configService: ConfigService) {
    this.client = new BedrockRuntimeClient({
      region: this.configService.get<string>('AWS_REGION') ?? 'us-east-1',
      requestHandler: { requestTimeout: 300_000 }, // 5-minute timeout (risk analysis generates ~8K tokens)
    });

    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeoutMs: 60_000,
      isFailure: (err) =>
        !((err as Error)?.name === 'ValidationException'),
    });
  }

  /**
   * Model-agnostic invocation via the Bedrock Converse API.
   * Works with any model on Bedrock (Claude, Kimi, Llama, Mistral, etc.)
   * without needing model-specific request/response formats.
   */
  async invokeModel(params: InvokeModelParams): Promise<{ output: string; tokensUsed: number; processingTime: number }> {
    const startedAt = Date.now();

    this.logger.log(`Invoking Bedrock model via Converse API: ${params.modelId}`);

    const system: SystemContentBlock[] = [{ text: params.systemPrompt }];

    const messages: Message[] = [
      { role: 'user', content: [{ text: params.userPrompt }] },
    ];

    const inferenceConfig: InferenceConfiguration = {
      maxTokens: params.maxTokens ?? 4096,
      ...(params.temperature !== undefined && { temperature: params.temperature }),
      ...(params.topP !== undefined && { topP: params.topP }),
    };

    const response = await this.circuitBreaker.execute(() =>
      withRetry(
        () =>
          this.client.send(
            new ConverseCommand({
              modelId: params.modelId,
              system,
              messages,
              inferenceConfig,
            }),
          ),
        {
          maxAttempts: 3,
          isRetryable: (err) =>
            (err as Error)?.name === 'ThrottlingException' ||
            (err as Error)?.name === 'ServiceUnavailableException',
        },
      ),
    );

    const output =
      response.output?.message?.content
        ?.filter((block) => 'text' in block)
        .map((block) => block.text ?? '')
        .join('') ?? '';

    const tokensUsed =
      (response.usage?.inputTokens ?? 0) +
      (response.usage?.outputTokens ?? 0);

    const processingTime = Date.now() - startedAt;

    this.logger.log(
      `Converse response: ${tokensUsed} tokens, ${processingTime}ms, output ${output.length} chars`,
    );

    return { output, tokensUsed, processingTime };
  }

  async preview(req: PromptPreviewRequest): Promise<PromptPreviewResponse> {
    const modelId = BEDROCK_MODELS[AgentSection.PARSER].modelId;

    const userPrompt = Object.entries(req.variables ?? {}).reduce(
      (text, [key, val]) => text.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val),
      req.userPromptTemplate,
    );

    return this.invokeModel({
      modelId,
      systemPrompt: req.systemPrompt,
      userPrompt,
    });
  }
}
