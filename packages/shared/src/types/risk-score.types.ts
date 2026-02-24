import { RiskLevel } from '../enums/risk-level.enum';
import { RecommendationPriority } from '../enums/recommendation-priority.enum';

export interface SubcategoryScore {
  name: string;
  indicator: string;
  score: number;
  level: RiskLevel;
  evidence: string | null;
  mitigation: string | null;
}

export interface RecommendationResponse {
  id: string;
  text: string;
  priority: RecommendationPriority;
  isEdited: boolean;
  editedText: string | null;
}

export interface RiskScoreResponse {
  id: string;
  category: string;
  score: number;
  level: RiskLevel;
  subcategories: SubcategoryScore[];
  evidence: string | null;
  narrative: string | null;
  recommendations: RecommendationResponse[];
}

export interface AssessmentCommentResponse {
  id: string;
  userId: string;
  userEmail: string;
  content: string;
  createdAt: string;
}
