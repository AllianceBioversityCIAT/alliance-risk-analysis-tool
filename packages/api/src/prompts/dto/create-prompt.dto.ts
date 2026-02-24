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
import { AgentSection } from '@alliance-risk/shared';

export class FewShotExampleDto {
  @IsString()
  input!: string;

  @IsString()
  output!: string;
}

export class PromptContextDto {
  @IsOptional()
  @IsString()
  persona?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sources?: string[];

  @IsOptional()
  @IsString()
  constraints?: string;

  @IsOptional()
  @IsString()
  guardrails?: string;
}

export class CreatePromptDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsEnum(AgentSection)
  section!: AgentSection;

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

  @IsString()
  @MinLength(1)
  systemPrompt!: string;

  @IsString()
  @MinLength(1)
  userPromptTemplate!: string;

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
