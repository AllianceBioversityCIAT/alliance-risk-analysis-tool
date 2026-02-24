import { AssessmentDetail } from './assessment.types';
import { RiskLevel } from '../enums/risk-level.enum';
import { RiskScoreResponse } from './risk-score.types';

export interface ReportResponse {
  assessment: AssessmentDetail;
  executiveSummary: string;
  overallScore: number;
  overallLevel: RiskLevel;
  categories: RiskScoreResponse[];
  radarData: { category: string; score: number }[];
}
