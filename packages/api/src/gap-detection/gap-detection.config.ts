// packages/api/src/gap-detection/gap-detection.config.ts

import { AgentSection } from '@alliance-risk/shared';
import { RiskCategory } from '@prisma/client';

export interface Core10FieldDefinition {
  field: string;
  label: string;
  category: RiskCategory;
  order: number;
}

export const GAP_DETECTION_CONFIG = {
  /**
   * Claude Sonnet 4.5 via US cross-region inference profile.
   * Newer Bedrock models require inference profile IDs (prefixed with "us.") instead
   * of direct model IDs. This routes to us-east-1/us-east-2/us-west-2.
   */
  model: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',

  /** Maximum output tokens — generous for 10 fields with reasoning */
  maxTokens: 8192,

  /**
   * Low temperature for consistent, deterministic classification.
   * Range 0.0–1.0. At 0.2, the model favors high-probability tokens,
   * producing reliable VERIFIED/PARTIAL/MISSING classifications.
   * Note: Claude Sonnet 4.5 does not allow temperature + top_p together.
   */
  temperature: 0.2,

  /**
   * Maximum input characters from extraction (truncated beyond this).
   * Claude Sonnet 4.6 supports ~1M tokens; 500K chars ≈ 125K tokens.
   * Generous limit to handle very large business plans.
   */
  maxInputCharacters: 500_000,

  /** Prompt section for database lookup */
  promptSection: AgentSection.GAP_DETECTOR,

  /** The 10 mandatory fields every assessment must have */
  core10Fields: [
    { field: 'business_model_summary',       label: 'Business Model Summary',      category: RiskCategory.OPERATIONAL, order: 0 },
    { field: 'enterprise_type',              label: 'Enterprise Type',              category: RiskCategory.OPERATIONAL, order: 1 },
    { field: 'country_of_operation',         label: 'Country of Operation',         category: RiskCategory.OPERATIONAL, order: 2 },
    { field: 'product_service_description',  label: 'Product/Service Description',  category: RiskCategory.MARKET,      order: 3 },
    { field: 'revenue_model',                label: 'Revenue Model',                category: RiskCategory.FINANCIAL,   order: 4 },
    { field: 'cost_drivers',                 label: 'Cost Drivers',                 category: RiskCategory.FINANCIAL,   order: 5 },
    { field: 'supply_chain_overview',        label: 'Supply Chain Overview',        category: RiskCategory.OPERATIONAL, order: 6 },
    { field: 'workforce_summary',            label: 'Workforce Summary',            category: RiskCategory.OPERATIONAL, order: 7 },
    { field: 'customer_base',               label: 'Customer Base',                category: RiskCategory.MARKET,      order: 8 },
    { field: 'key_challenges',               label: 'Key Challenges',               category: RiskCategory.OPERATIONAL, order: 9 },
  ] as Core10FieldDefinition[],
} as const;
