import type { RecommendationResponse } from '@alliance-risk/shared';
import type { RiskLevel } from '@alliance-risk/shared';

export interface EnrichedRecommendation extends RecommendationResponse {
  category: string;
  categoryLabel: string;
  categoryScore: number;
  categoryLevel: RiskLevel;
}
