import { IsString, IsOptional, IsEnum, MaxLength, IsInt, Min, Max } from 'class-validator';
import { AssessmentStatus } from '@alliance-risk/shared';
import { IsSupportedCountry } from '../../../common/validators/is-supported-country.validator';

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
  @IsSupportedCountry()
  country?: string;

  @IsOptional()
  @IsEnum(AssessmentStatus)
  status?: AssessmentStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  progress?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;
}
