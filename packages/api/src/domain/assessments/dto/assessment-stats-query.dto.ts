import { IsOptional } from 'class-validator';
import { IsSupportedCountry } from '../../../common/validators/is-supported-country.validator';

export class AssessmentStatsQueryDto {
  @IsOptional()
  @IsSupportedCountry()
  country?: string;
}
