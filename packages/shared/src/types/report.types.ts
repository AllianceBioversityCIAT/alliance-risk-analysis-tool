import { AssessmentDetail } from './assessment.types';
import { RiskLevel } from '../enums/risk-level.enum';
import { RiskScoreResponse } from './risk-score.types';

export type SubcategoryChartType = 'bar' | 'radar' | 'donut';

export interface ReportConfig {
  includeRadarChart: boolean;
  includeCategoryDetails: boolean;
  includeSubcategoryCharts: boolean;
  subcategoryChartType: SubcategoryChartType;
  includeFinancialCharts: boolean;
  includeRecommendations: boolean;
  includeEvidenceTraces: boolean;
  includeMethodology: boolean;
}

export interface FinancialRevenueEntry {
  year: number;
  amount: number;
  currency: string;
}

export interface FinancialCostEntry {
  category: string;
  amount: number;
}

export interface FinancialMargins {
  gross: number | null;
  operating: number | null;
}

export interface FinancialMetrics {
  revenue: FinancialRevenueEntry[];
  costs: FinancialCostEntry[];
  margins: FinancialMargins;
}

export interface ReportResponse {
  assessment: AssessmentDetail;
  executiveSummary: string;
  overallScore: number;
  overallLevel: RiskLevel;
  categories: RiskScoreResponse[];
  radarData: { category: string; score: number }[];
  financialMetrics?: FinancialMetrics;
  reportConfig?: ReportConfig;
}
