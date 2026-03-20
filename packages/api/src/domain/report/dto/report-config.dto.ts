import { IsOptional, IsBoolean, IsIn } from 'class-validator';
import type { SubcategoryChartType } from '@alliance-risk/shared';

export class ReportConfigDto {
  @IsOptional()
  @IsBoolean()
  includeRadarChart?: boolean = true;

  @IsOptional()
  @IsBoolean()
  includeCategoryDetails?: boolean = true;

  @IsOptional()
  @IsBoolean()
  includeSubcategoryCharts?: boolean = false;

  @IsOptional()
  @IsIn(['bar', 'radar', 'donut'])
  subcategoryChartType?: SubcategoryChartType = 'bar';

  @IsOptional()
  @IsBoolean()
  includeFinancialCharts?: boolean = false;

  @IsOptional()
  @IsBoolean()
  includeRecommendations?: boolean = true;

  @IsOptional()
  @IsBoolean()
  includeEvidenceTraces?: boolean = false;

  @IsOptional()
  @IsBoolean()
  includeMethodology?: boolean = true;
}
