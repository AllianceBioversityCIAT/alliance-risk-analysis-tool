import { IsString, IsOptional, IsObject, MaxLength } from 'class-validator';

export class PromptPreviewDto {
  @IsString()
  @MaxLength(50000)
  systemPrompt!: string;

  @IsString()
  @MaxLength(50000)
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
