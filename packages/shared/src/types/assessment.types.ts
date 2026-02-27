import { AssessmentStatus } from '../enums/assessment-status.enum';
import { IntakeMode } from '../enums/intake-mode.enum';
import { RiskLevel } from '../enums/risk-level.enum';

export interface AssessmentSummary {
  id: string;
  name: string;
  companyName: string;
  status: AssessmentStatus;
  intakeMode: IntakeMode;
  progress: number;
  version: number;
  overallRiskScore: number | null;
  overallRiskLevel: RiskLevel | null;
  updatedAt: string;
}

export interface AssessmentDetail extends AssessmentSummary {
  companyType: string | null;
  country: string;
  createdAt: string;
}

export interface AssessmentStats {
  active: number;
  drafts: number;
  completed: number;
  total: number;
}
