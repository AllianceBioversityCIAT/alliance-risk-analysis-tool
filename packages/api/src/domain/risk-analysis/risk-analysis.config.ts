// packages/api/src/domain/risk-analysis/risk-analysis.config.ts

import { AgentSection } from '@alliance-risk/shared';
import { RiskCategory } from '@prisma/client';

export interface SubcategoryDefinition {
  name: string;
  indicator: string;
}

export interface CategoryDefinition {
  category: RiskCategory;
  label: string;
  subcategories: SubcategoryDefinition[];
}

export const RISK_ANALYSIS_CONFIG = {
  maxInputCharacters: 200_000,
  promptSection: AgentSection.RISK_ANALYSIS,
  categories: [
    {
      category: RiskCategory.FINANCIAL,
      label: 'Financial Risk',
      subcategories: [
        { name: 'Revenue Stability', indicator: 'Consistency and predictability of revenue streams' },
        { name: 'Cost Structure', indicator: 'Efficiency and management of operational costs' },
        { name: 'Debt Levels', indicator: 'Leverage ratios and debt servicing capacity' },
        { name: 'Cash Flow', indicator: 'Adequacy of cash flow for operations and growth' },
        { name: 'Financial Controls', indicator: 'Quality of financial reporting and internal controls' },
      ],
    },
    {
      category: RiskCategory.CLIMATE_ENVIRONMENTAL,
      label: 'Climate & Environmental Risk',
      subcategories: [
        { name: 'Weather Exposure', indicator: 'Vulnerability to weather variability and extreme events' },
        { name: 'Climate Adaptation', indicator: 'Capacity to adapt operations to changing climate' },
        { name: 'Resource Sustainability', indicator: 'Sustainable use of water, soil, and natural resources' },
        { name: 'Environmental Compliance', indicator: 'Adherence to environmental regulations and standards' },
        { name: 'Disaster Preparedness', indicator: 'Resilience plans for natural disasters and crop failure' },
      ],
    },
    {
      category: RiskCategory.BEHAVIORAL,
      label: 'Behavioral Risk',
      subcategories: [
        { name: 'Management Capability', indicator: 'Leadership experience and management competency' },
        { name: 'Decision-Making Patterns', indicator: 'Quality and consistency of strategic decisions' },
        { name: 'Risk Awareness', indicator: 'Understanding and proactive management of risks' },
        { name: 'Change Readiness', indicator: 'Willingness and ability to adapt to market changes' },
        { name: 'Stakeholder Relationships', indicator: 'Quality of relationships with key stakeholders' },
      ],
    },
    {
      category: RiskCategory.OPERATIONAL,
      label: 'Operational Risk',
      subcategories: [
        { name: 'Supply Chain', indicator: 'Reliability and diversification of supply sources' },
        { name: 'Production Capacity', indicator: 'Ability to meet production targets and scale' },
        { name: 'Process Maturity', indicator: 'Standardization and documentation of key processes' },
        { name: 'Quality Controls', indicator: 'Product quality assurance and certification status' },
        { name: 'Workforce Capability', indicator: 'Skills, training, and retention of workforce' },
      ],
    },
    {
      category: RiskCategory.MARKET,
      label: 'Market Risk',
      subcategories: [
        { name: 'Market Access', indicator: 'Ability to reach target markets and distribution channels' },
        { name: 'Price Volatility', indicator: 'Exposure to commodity price fluctuations' },
        { name: 'Competition', indicator: 'Competitive positioning and market share dynamics' },
        { name: 'Demand Trends', indicator: 'Alignment with market demand and consumer preferences' },
        { name: 'Market Diversification', indicator: 'Spread of revenue across markets and geographies' },
      ],
    },
    {
      category: RiskCategory.GOVERNANCE_LEGAL,
      label: 'Governance & Legal Risk',
      subcategories: [
        { name: 'Legal Compliance', indicator: 'Compliance with local and international regulations' },
        { name: 'Governance Structure', indicator: 'Board composition, accountability, and oversight' },
        { name: 'Regulatory Risk', indicator: 'Exposure to regulatory changes and policy shifts' },
        { name: 'Contractual Obligations', indicator: 'Management of contracts, agreements, and liabilities' },
        { name: 'Transparency', indicator: 'Quality of reporting and stakeholder communication' },
      ],
    },
    {
      category: RiskCategory.TECHNOLOGY_DATA,
      label: 'Technology & Data Risk',
      subcategories: [
        { name: 'Technology Adoption', indicator: 'Use of modern tools and agricultural technology' },
        { name: 'Data Management', indicator: 'Collection, storage, and use of business data' },
        { name: 'Cybersecurity', indicator: 'Protection of digital assets and data privacy' },
        { name: 'Digital Infrastructure', indicator: 'Reliability and coverage of IT and connectivity' },
        { name: 'Innovation Capacity', indicator: 'Ability to innovate and adopt new practices' },
      ],
    },
  ] as CategoryDefinition[],

  scoringRubric: {
    LOW: { min: 0, max: 30, label: 'Low Risk' },
    MODERATE: { min: 31, max: 60, label: 'Moderate Risk' },
    HIGH: { min: 61, max: 80, label: 'High Risk' },
    CRITICAL: { min: 81, max: 100, label: 'Critical Risk' },
  },
} as const;
