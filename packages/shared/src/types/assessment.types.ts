import { AssessmentStatus } from '../enums/assessment-status.enum';
import { IntakeMode } from '../enums/intake-mode.enum';
import { RiskLevel } from '../enums/risk-level.enum';

export interface AssessmentSummary {
  id: string;
  name: string;
  companyName: string;
  country: string;
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
  detectedCountry: string | null;
  createdAt: string;
}

export interface AssessmentStats {
  active: number;
  drafts: number;
  completed: number;
  total: number;
}

export interface MergedContentResponse {
  mergedMarkdown: string | null;
  superseded: boolean;
  /**
   * True when work is actively in progress for this assessment: a
   * non-terminal PARSE_DOCUMENT job for one of its current documents, or a
   * non-terminal GAP_DETECTION job for the assessment itself (design.md
   * §7.3 v2.1). Computed independently of `superseded` — neither gates the
   * other. Content availability is a property of the snapshot;
   * work-in-progress is a property of the run.
   */
  analysisInFlight: boolean;
}
