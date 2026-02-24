import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  IsBoolean,
  MaxLength,
  IsObject,
} from 'class-validator';
import { AgentSection } from '@alliance-risk/shared';
import { FewShotExampleDto, PromptContextDto } from './create-prompt.dto';

export class UpdatePromptDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsEnum(AgentSection)
  section?: AgentSection;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  subSection?: string;

  @IsOptional()
  @IsString()
  route?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @IsOptional()
  @IsString()
  userPromptTemplate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  tone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  outputFormat?: string;

  @IsOptional()
  @IsArray()
  fewShot?: FewShotExampleDto[];

  @IsOptional()
  @IsObject()
  context?: PromptContextDto;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
