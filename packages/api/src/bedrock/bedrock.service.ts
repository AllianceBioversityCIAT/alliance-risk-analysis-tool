import { Injectable, Logger } from '@nestjs/common';
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { ConfigService } from '@nestjs/config';
import type { PromptPreviewRequest, PromptPreviewResponse } from '@alliance-risk/shared';
import { BEDROCK_MODELS, AgentSection } from '@alliance-risk/shared';
import { CircuitBreaker } from '../common/utils/circuit-breaker';
import { withRetry } from '../common/utils/retry';

export interface InvokeModelParams {
  modelId: string;
  systemPrompt: string;
  userPrompt: string;
}

@Injectable()
export class BedrockService {
  private readonly logger = new Logger(BedrockService.name);
  private readonly client: BedrockRuntimeClient;
  private readonly circuitBreaker: CircuitBreaker;

  constructor(private readonly configService: ConfigService) {
    this.client = new BedrockRuntimeClient({
      region: this.configService.get<string>('AWS_REGION') ?? 'us-east-1',
    });

    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeoutMs: 60_000,
      isFailure: (err) =>
        !((err as Error)?.name === 'ValidationException'),
    });
  }

  async invokeModel(params: InvokeModelParams): Promise<{ output: string; tokensUsed: number; processingTime: number }> {
    const startedAt = Date.now();

    this.logger.log(`Invoking Bedrock model: ${params.modelId}`);

    const body = JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 4096,
      system: params.systemPrompt,
      messages: [
        { role: 'user', content: params.userPrompt },
      ],
    });

    const response = await this.circuitBreaker.execute(() =>
      withRetry(
        () =>
          this.client.send(
            new InvokeModelCommand({
              modelId: params.modelId,
              contentType: 'application/json',
              accept: 'application/json',
              body: Buffer.from(body),
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

    const responseBody = JSON.parse(
      Buffer.from(response.body).toString('utf-8'),
    ) as {
      content: Array<{ type: string; text: string }>;
      usage?: { input_tokens: number; output_tokens: number };
    };

    const output =
      responseBody.content
        ?.filter((c) => c.type === 'text')
        .map((c) => c.text)
        .join('') ?? '';

    const tokensUsed =
      (responseBody.usage?.input_tokens ?? 0) +
      (responseBody.usage?.output_tokens ?? 0);

    const processingTime = Date.now() - startedAt;

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
