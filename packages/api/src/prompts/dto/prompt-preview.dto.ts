import { IsString, IsOptional, IsObject } from 'class-validator';

export class PromptPreviewDto {
  @IsString()
  systemPrompt!: string;

  @IsString()
  userPromptTemplate!: string;

  @IsOptional()
  @IsObject()
  variables?: Record<string, string>;

  @IsOptional()
  @IsObject()
  context?: {
    persona?: string;
    sources?: string[];
    constraints?: string;
    guardrails?: string;
  };
}
