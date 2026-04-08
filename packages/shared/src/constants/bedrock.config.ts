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
    modelId: 'moonshotai.kimi-k2.5',
  },
  [AgentSection.GAP_DETECTOR]: {
    modelId: 'moonshotai.kimi-k2.5',
    /** Generous limit to handle 10 fields with full reasoning chains. Kimi is more verbose than Claude. */
    maxTokens: 16384,
    /**
     * Low temperature for consistent VERIFIED/PARTIAL/MISSING classification.
     * At 0.2 the model strongly favours high-probability tokens.
     */
    temperature: 0.2,
  },
  [AgentSection.RISK_ANALYSIS]: {
    modelId: 'moonshotai.kimi-k2.5',
    /** Score 7 categories × 5 subcategories with narratives and recommendations. Kimi is more verbose than Claude. */
    maxTokens: 24576,
    /** Slightly higher than gap-detector (0.2) for richer narrative generation. */
    temperature: 0.3,
  },
  [AgentSection.REPORT_GENERATION]: {
    modelId: 'moonshotai.kimi-k2.5',
    /** Executive summary + strengths/weaknesses synthesis. */
    maxTokens: 8192,
    /** Higher temperature for more creative report writing. */
    temperature: 0.4,
  },
};
