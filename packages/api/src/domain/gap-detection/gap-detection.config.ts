// packages/api/src/domain/gap-detection/gap-detection.config.ts

import { AgentSection, BEDROCK_MODELS } from '@alliance-risk/shared';
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

/** Field descriptions used for validation context */
export const FIELD_DESCRIPTIONS: Record<string, string> = {
  business_model_summary: 'Describes how the business creates and delivers value.',
  enterprise_type: 'Classifies the business structure for regulatory assessment.',
  country_of_operation: 'Determines geopolitical and market-specific risk factors.',
  product_service_description: 'Identifies the offering and its market positioning.',
  revenue_model: 'Helps assess income stability and lending capacity.',
  cost_drivers: 'Understanding costs helps evaluate profitability risk.',
  supply_chain_overview: 'Maps dependencies that could disrupt operations.',
  workforce_summary: 'Assesses human capital risks and organizational capacity.',
  customer_base: 'Evaluates revenue concentration and market risk.',
  key_challenges: 'Identifies known risks the business is already facing.',
};

export const GAP_VALIDATION_CONFIG = {
  model: BEDROCK_MODELS[AgentSection.GAP_DETECTOR].modelId,
  maxTokens: 4096,
  temperature: 0.1,

  systemPrompt: `You are a data quality validator for agricultural business plan fields.
Your task is to determine whether user-provided corrections meaningfully address each field's requirement.

Rules:
- VALID: The text contains substantive, relevant information for the field.
- INVALID: The text is trivial, nonsensical, irrelevant, or does not meaningfully add to or correct the field's content.
- Compare the corrected value against the field description to judge relevance.
- Be lenient with formatting and grammar but strict on substance.
- If the corrected value is essentially the same as the extracted value with only trivial/meaningless additions, mark it INVALID.

Return ONLY a JSON object with this exact structure:
{ "results": [{ "field": "field_key", "valid": true, "feedback": null }, { "field": "field_key", "valid": false, "feedback": "brief reason" }] }`,

  userPromptTemplate: `Validate these user-corrected business plan fields:

{{fields_json}}

Each entry contains:
- field: the field key
- label: human-readable name
- description: what this field should contain
- extractedValue: what the AI originally found (may be null)
- correctedValue: what the user provided

Determine if each correctedValue meaningfully addresses the field requirement.`,
} as const;
