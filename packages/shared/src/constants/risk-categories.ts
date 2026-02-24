export const RISK_CATEGORIES = [
  { key: 'behavioral', label: 'Behavioral Risk', subcategoryCount: 5 },
  { key: 'operational', label: 'Operational Risk', subcategoryCount: 5 },
  { key: 'financial', label: 'Financial Risk', subcategoryCount: 5 },
  { key: 'market', label: 'Market Risk', subcategoryCount: 5 },
  {
    key: 'climate_environmental',
    label: 'Climate-Environmental Risk',
    subcategoryCount: 5,
  },
  {
    key: 'governance_legal',
    label: 'Governance & Legal Risk',
    subcategoryCount: 5,
  },
  {
    key: 'technology_data',
    label: 'Technology & Data Risk',
    subcategoryCount: 5,
  },
] as const;

export type RiskCategoryKey = (typeof RISK_CATEGORIES)[number]['key'];
