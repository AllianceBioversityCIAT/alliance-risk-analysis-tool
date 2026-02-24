export enum AgentSection {
  PARSER = 'parser',
  GAP_DETECTOR = 'gap_detector',
  RISK_ANALYSIS = 'risk_analysis',
  REPORT_GENERATION = 'report_generation',
}

export const AGENT_SECTION_LABELS: Record<AgentSection, string> = {
  [AgentSection.PARSER]: 'Parser Agent',
  [AgentSection.GAP_DETECTOR]: 'Gap Detector Agent',
  [AgentSection.RISK_ANALYSIS]: 'Risk Analysis Agent',
  [AgentSection.REPORT_GENERATION]: 'Report Generation Agent',
};
