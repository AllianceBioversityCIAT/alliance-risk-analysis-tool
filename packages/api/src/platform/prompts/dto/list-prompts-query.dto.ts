import {
  IsEnum,
  IsOptional,
  IsString,
  IsBoolean,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AgentSection } from '@alliance-risk/shared';

export class ListPromptsQueryDto {
  @ApiPropertyOptional({ enum: AgentSection, example: AgentSection.GAP_DETECTOR, description: 'Filter by agent pipeline section' })
  @IsOptional()
  @IsEnum(AgentSection)
  section?: AgentSection;

  @ApiPropertyOptional({ example: '/assessments/:id/gap-detector', description: 'Filter by associated frontend route' })
  @IsOptional()
  @IsString()
  route?: string;

  @ApiPropertyOptional({ example: 'production', description: 'Filter by a specific tag' })
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiPropertyOptional({ example: 'market risk', description: 'Full-text search across prompt name, system prompt, and user prompt template' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: true, description: 'Filter by active status. true = active prompts only, false = inactive only, omit = all prompts' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 1, description: 'Page number (1-indexed, default: 1)', minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, description: 'Number of results per page (default: 20, max: 100)', minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
