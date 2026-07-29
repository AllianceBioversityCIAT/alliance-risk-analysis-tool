import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { IntakeMode } from '@alliance-risk/shared';
import { IsSupportedCountry } from '../../../common/validators/is-supported-country.validator';

export class CreateAssessmentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  companyName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  companyType?: string;

  @IsOptional()
  @IsSupportedCountry()
  country?: string;

  @IsEnum(IntakeMode)
  intakeMode!: IntakeMode;
}
