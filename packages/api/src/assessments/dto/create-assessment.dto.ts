import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { IntakeMode } from '@alliance-risk/shared';

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
  @IsString()
  @MaxLength(100)
  country?: string;

  @IsEnum(IntakeMode)
  intakeMode!: IntakeMode;
}
