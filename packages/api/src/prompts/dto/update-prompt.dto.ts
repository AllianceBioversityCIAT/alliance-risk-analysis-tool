import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  IsBoolean,
  MaxLength,
  IsObject,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AgentSection } from '@alliance-risk/shared';
import { FewShotExampleDto, PromptContextDto } from './create-prompt.dto';

export class UpdatePromptDto {
  @ApiPropertyOptional({ example: 'Gap Detection — Market Risk v3', description: 'Updated prompt name (max 200 characters)', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ enum: AgentSection, example: AgentSection.GAP_DETECTOR, description: 'Updated agent section assignment' })
  @IsOptional()
  @IsEnum(AgentSection)
  section?: AgentSection;

  @ApiPropertyOptional({ example: 'Credit Risk', description: 'Updated sub-section (max 100 characters)', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  subSection?: string;

  @ApiPropertyOptional({ example: '/assessments/:id/gap-detector', description: 'Updated frontend route association' })
  @IsOptional()
  @IsString()
  route?: string;

  @ApiPropertyOptional({ example: ['Market Risk', 'Operational Risk'], description: 'Updated list of applicable risk categories', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @ApiPropertyOptional({ example: ['v3', 'updated'], description: 'Updated tags', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ example: 'You are an updated expert agricultural risk analyst...', description: 'Updated system prompt' })
  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @ApiPropertyOptional({ example: 'Analyze the following document for risks: {{document}}', description: 'Updated user prompt template. Supports variable substitution: {{category_1}}, {{category_2}}, {{categories}}' })
  @IsOptional()
  @IsString()
  userPromptTemplate?: string;

  @ApiPropertyOptional({ example: 'Formal, concise, data-driven.', description: 'Updated tone instructions (max 500 characters)', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  tone?: string;

  @ApiPropertyOptional({ example: 'Return JSON with keys: gaps, severity, recommendations', description: 'Updated output format instructions (max 5000 characters)', maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  outputFormat?: string;

  @ApiPropertyOptional({ type: [FewShotExampleDto], description: 'Updated few-shot examples' })
  @IsOptional()
  @IsArray()
  fewShot?: FewShotExampleDto[];

  @ApiPropertyOptional({ type: PromptContextDto, description: 'Updated context configuration' })
  @IsOptional()
  @IsObject()
  context?: PromptContextDto;

  @ApiPropertyOptional({ example: true, description: 'Set to true to activate this prompt (may deactivate other prompts in the same section)' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
