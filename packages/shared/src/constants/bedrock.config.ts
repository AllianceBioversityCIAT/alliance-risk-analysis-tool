import { AgentSection } from '../enums/agent-section.enum';

export const BEDROCK_MODELS: Record<
  AgentSection,
  {
    modelId: string;
    knowledgeBaseId?: string;
    /** Maximum output tokens for this agent section. */
    maxTokens?: number;
    /**
     * Sampling temperature (0.0–1.0). Lower values produce more deterministic
     * output. Note: Claude does not allow temperature + top_p together.
     */
    temperature?: number;
  }
> = {
  [AgentSection.PARSER]: {
    modelId: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
  },
  [AgentSection.GAP_DETECTOR]: {
    modelId: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
    /** Generous limit to handle 10 fields with full reasoning chains. */
    maxTokens: 8192,
    /**
     * Low temperature for consistent VERIFIED/PARTIAL/MISSING classification.
     * At 0.2 the model strongly favours high-probability tokens.
     */
    temperature: 0.2,
  },
  [AgentSection.RISK_ANALYSIS]: {
    modelId: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
  },
  [AgentSection.REPORT_GENERATION]: {
    modelId: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
  },
};
