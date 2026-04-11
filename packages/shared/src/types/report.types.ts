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
  includeCompanyProfile: boolean;
  includeRiskHeatmap: boolean;
  includeActionPlan: boolean;
  includeAppendix: boolean;
}

export type ActionPlanTimeframe = 'IMMEDIATE' | 'SHORT_TERM' | 'MEDIUM_TERM';

export interface ActionPlanItem {
  timeframe: ActionPlanTimeframe;
  category: string;
  priority: string;
  text: string;
}

export interface DocumentSource {
  fileName: string;
  fileType: string;
  extractedLength: number;
}

export interface GapSummaryItem {
  fieldKey: string;
  status: string;
  detectedValue: string | null;
  correctedValue: string | null;
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

export type ReportGenerationStage =
  | 'LOADING_DATA'
  | 'GENERATING_SUMMARY'
  | 'EXTRACTING_FINANCIAL'
  | 'PLANNING_ACTIONS'
  | 'FETCHING_APPENDIX'
  | 'RENDERING_PDF'
  | 'UPLOADING';

export interface ReportGenerationProgress {
  stage: ReportGenerationStage;
  stageLabel: string;
  stageIndex: number;
  stageTotal: number;
  updatedAt: string;
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
  actionPlanItems?: ActionPlanItem[];
  documentSources?: DocumentSource[];
  gapSummary?: GapSummaryItem[];
}
