import { AgentSection } from '../enums/agent-section.enum';

export const BEDROCK_MODELS: Record<
  AgentSection,
  { modelId: string; knowledgeBaseId?: string }
> = {
  [AgentSection.PARSER]: {
    modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
  },
  [AgentSection.GAP_DETECTOR]: {
    modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
  },
  [AgentSection.RISK_ANALYSIS]: {
    modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
  },
  [AgentSection.REPORT_GENERATION]: {
    modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
  },
};
