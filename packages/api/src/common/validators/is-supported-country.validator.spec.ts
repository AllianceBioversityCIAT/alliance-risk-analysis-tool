import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateAssessmentDto } from '../../domain/assessments/dto/create-assessment.dto';
import { ListAssessmentsQueryDto } from '../../domain/assessments/dto/list-assessments-query.dto';
import { AssessmentStatsQueryDto } from '../../domain/assessments/dto/assessment-stats-query.dto';
import { IntakeMode } from '@alliance-risk/shared';

describe('IsSupportedCountry validator', () => {
  it('accepts a supported country', async () => {
    const dto = plainToInstance(CreateAssessmentDto, {
      name: 'Test',
      companyName: 'Co',
      intakeMode: IntakeMode.UPLOAD,
      country: 'Kenya',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects an unsupported country', async () => {
    const dto = plainToInstance(CreateAssessmentDto, {
      name: 'Test',
      companyName: 'Co',
      intakeMode: IntakeMode.UPLOAD,
      country: 'Uganda',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'country')).toBe(true);
  });

  it('rejects unsupported country on list query DTO', async () => {
    const dto = plainToInstance(ListAssessmentsQueryDto, { country: 'Uganda' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'country')).toBe(true);
  });

  it('accepts supported country on stats query DTO', async () => {
    const dto = plainToInstance(AssessmentStatsQueryDto, { country: 'Ethiopia' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
