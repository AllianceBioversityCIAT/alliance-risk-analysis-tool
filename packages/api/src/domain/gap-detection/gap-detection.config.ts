// packages/api/src/domain/gap-detection/gap-detection.config.ts

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
   * Maximum input characters from extraction (truncated beyond this).
   * Claude Sonnet 4.5 supports ~1M tokens; 500K chars ≈ 125K tokens.
   * Generous limit to handle very large business plans.
   */
  maxInputCharacters: 500_000,

  /** Prompt section identifier used for database lookup. */
  promptSection: AgentSection.GAP_DETECTOR,

  /** The 10 mandatory fields every assessment must have. */
  core10Fields: [
    { field: 'business_model_summary',      label: 'Business Model Summary',     category: RiskCategory.OPERATIONAL, order: 0 },
    { field: 'enterprise_type',             label: 'Enterprise Type',             category: RiskCategory.OPERATIONAL, order: 1 },
    { field: 'country_of_operation',        label: 'Country of Operation',        category: RiskCategory.OPERATIONAL, order: 2 },
    { field: 'product_service_description', label: 'Product/Service Description', category: RiskCategory.MARKET,      order: 3 },
    { field: 'revenue_model',               label: 'Revenue Model',               category: RiskCategory.FINANCIAL,   order: 4 },
    { field: 'cost_drivers',                label: 'Cost Drivers',                category: RiskCategory.FINANCIAL,   order: 5 },
    { field: 'supply_chain_overview',       label: 'Supply Chain Overview',       category: RiskCategory.OPERATIONAL, order: 6 },
    { field: 'workforce_summary',           label: 'Workforce Summary',           category: RiskCategory.OPERATIONAL, order: 7 },
    { field: 'customer_base',              label: 'Customer Base',               category: RiskCategory.MARKET,      order: 8 },
    { field: 'key_challenges',              label: 'Key Challenges',              category: RiskCategory.OPERATIONAL, order: 9 },
  ] as Core10FieldDefinition[],
} as const;
