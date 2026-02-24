import { IsString, IsOptional, IsEnum, MaxLength, IsInt, Min, Max } from 'class-validator';
import { AssessmentStatus } from '@alliance-risk/shared';

export class UpdateAssessmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  companyType?: string;

  @IsOptional()
  @IsEnum(AssessmentStatus)
  status?: AssessmentStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  progress?: number;
}
