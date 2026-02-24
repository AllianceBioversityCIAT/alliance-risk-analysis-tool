import { Injectable } from '@nestjs/common';
import type { PromptPreviewRequest, PromptPreviewResponse } from '@alliance-risk/shared';
import { BedrockService } from '../../bedrock/bedrock.service';
import type { JobHandler } from '../job-handler.interface';

@Injectable()
export class AiPreviewHandler implements JobHandler {
  constructor(private readonly bedrockService: BedrockService) {}

  async execute(input: PromptPreviewRequest): Promise<PromptPreviewResponse> {
    return this.bedrockService.preview(input);
  }
}
