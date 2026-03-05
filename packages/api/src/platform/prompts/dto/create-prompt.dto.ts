import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  IsBoolean,
  MinLength,
  MaxLength,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AgentSection } from '@alliance-risk/shared';

export class FewShotExampleDto {
  @ApiProperty({ example: 'What are the main market risks for smallholder farmers?', description: 'Example user input for few-shot learning' })
  @IsString()
  input!: string;

  @ApiProperty({ example: 'The main market risks include price volatility, lack of market access, and limited contract farming opportunities.', description: 'Expected model output for the corresponding input' })
  @IsString()
  output!: string;
}

export class PromptContextDto {
  @ApiPropertyOptional({ example: 'You are an expert agricultural risk analyst specializing in CGIAR research programmes.', description: 'System persona definition that shapes the model\'s tone and expertise framing' })
  @IsOptional()
  @IsString()
  persona?: string;

  @ApiPropertyOptional({ example: ['CGIAR Research Programs', 'FAO Risk Framework'], description: 'List of reference sources or knowledge bases the model should draw from', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sources?: string[];

  @ApiPropertyOptional({ example: 'Respond only based on the provided document. Do not speculate beyond the evidence.', description: 'Operational constraints for model behavior' })
  @IsOptional()
  @IsString()
  constraints?: string;

  @ApiPropertyOptional({ example: 'Do not provide specific investment advice. Do not name individual companies.', description: 'Safety guardrails to prevent harmful or out-of-scope outputs' })
  @IsOptional()
  @IsString()
  guardrails?: string;
}

export class CreatePromptDto {
  @ApiProperty({ example: 'Gap Detection — Market Risk v2', description: 'Human-readable prompt name (max 200 characters)', maxLength: 200 })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiProperty({ enum: AgentSection, example: AgentSection.GAP_DETECTOR, description: 'The agent pipeline section this prompt belongs to. Determines which Bedrock agent will use it.' })
  @IsEnum(AgentSection)
  section!: AgentSection;

  @ApiPropertyOptional({ example: 'Market Risk', description: 'Optional sub-section for further grouping within a section (max 100 characters)', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  subSection?: string;

  @ApiPropertyOptional({ example: '/assessments/:id/gap-detector', description: 'Frontend route that uses this prompt — useful for filtering in the Prompt Manager UI' })
  @IsOptional()
  @IsString()
  route?: string;

  @ApiPropertyOptional({ example: ['Market Risk', 'Credit Risk'], description: 'Risk category names this prompt applies to', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @ApiPropertyOptional({ example: ['v2', 'production', 'reviewed'], description: 'Free-form tags for filtering and organization', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({ example: 'You are an expert agricultural risk analyst. Analyze the provided business plan document and identify gaps in the risk assessment across the specified categories.', description: 'The system-level prompt sent to the model to establish persona, task, and constraints' })
  @IsString()
  @MinLength(1)
  systemPrompt!: string;

  @ApiProperty({ example: 'Given the following business plan section:\n\n{{document_excerpt}}\n\nIdentify gaps in risk coverage for the following categories: {{categories}}', description: 'The user-turn prompt template. Supports variable substitution: {{category_1}}, {{category_2}}, {{categories}} (comma-separated list)' })
  @IsString()
  @MinLength(1)
  userPromptTemplate!: string;

  @ApiPropertyOptional({ example: 'Professional, analytical, concise. Use bullet points for lists. Avoid jargon.', description: 'Tone and style instructions for the model response (max 500 characters)', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  tone?: string;

  @ApiPropertyOptional({ example: 'Return a JSON object with keys: "gaps" (array of strings), "severity" (low|medium|high), "recommendations" (array of strings)', description: 'Instructions for how the model should format its output (max 5000 characters)', maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  outputFormat?: string;

  @ApiPropertyOptional({ type: [FewShotExampleDto], description: 'Few-shot examples to guide model behavior' })
  @IsOptional()
  @IsArray()
  fewShot?: FewShotExampleDto[];

  @ApiPropertyOptional({ type: PromptContextDto, description: 'Additional context configuration for persona, sources, constraints, and guardrails' })
  @IsOptional()
  @IsObject()
  context?: PromptContextDto;

  @ApiPropertyOptional({ example: false, description: 'Whether this prompt is active and used by Bedrock agents. Defaults to false. Only one prompt per section should be active at a time.' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
