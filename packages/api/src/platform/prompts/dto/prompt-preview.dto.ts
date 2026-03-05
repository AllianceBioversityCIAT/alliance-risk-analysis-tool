import { IsString, IsOptional, IsObject, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PromptPreviewDto {
  @ApiProperty({ example: 'You are an expert agricultural risk analyst. Analyze the provided document for risk gaps.', description: 'System prompt to send to Bedrock. Supports the same variable substitution as saved prompts (max 50,000 characters)', maxLength: 50000 })
  @IsString()
  @MaxLength(50000)
  systemPrompt!: string;

  @ApiProperty({ example: 'Identify gaps in risk coverage for: {{categories}}\n\nDocument:\n{{document}}', description: 'User prompt template. Variables in {{variable_name}} format will be substituted with values from the variables map (max 50,000 characters)', maxLength: 50000 })
  @IsString()
  @MaxLength(50000)
  userPromptTemplate!: string;

  @ApiPropertyOptional({
    example: { categories: 'Market Risk, Credit Risk', document: 'Sample business plan text...' },
    description: 'Key-value map of variables to inject into the userPromptTemplate. Keys should match {{variable_name}} placeholders in the template.',
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  @IsOptional()
  @IsObject()
  variables?: Record<string, string>;

  @ApiPropertyOptional({
    description: 'Optional context override for this preview run',
    type: 'object',
    properties: {
      persona: { type: 'string', example: 'You are a senior risk analyst.' },
      sources: { type: 'array', items: { type: 'string' }, example: ['CGIAR Framework', 'FAO Guidelines'] },
      constraints: { type: 'string', example: 'Only use information from the provided document.' },
      guardrails: { type: 'string', example: 'Do not provide investment advice.' },
    },
  })
  @IsOptional()
  @IsObject()
  context?: {
    persona?: string;
    sources?: string[];
    constraints?: string;
    guardrails?: string;
  };
}
