import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  IsBoolean,
  ValidateNested,
  MinLength,
  MaxLength,
  IsObject,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AgentSection } from '@alliance-risk/shared';

export class ImportPromptItem {
  @ApiProperty({ example: 'Gap Detection — Market Risk v2' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiProperty({ enum: AgentSection })
  @IsEnum(AgentSection)
  section!: AgentSection;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  subSection?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  route?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty()
  @IsString()
  @MinLength(1)
  systemPrompt!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  userPromptTemplate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  tone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  outputFormat?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  fewShot?: Array<{ input: string; output: string }>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class BulkImportDto {
  @ApiProperty({ type: [ImportPromptItem] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportPromptItem)
  prompts!: ImportPromptItem[];

  @ApiProperty({ enum: ['create_new', 'upsert'], example: 'create_new' })
  @IsIn(['create_new', 'upsert'])
  mode!: 'create_new' | 'upsert';
}
