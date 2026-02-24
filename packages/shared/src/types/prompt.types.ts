import { AgentSection } from '../enums/agent-section.enum';

export interface FewShotExample {
  input: string;
  output: string;
}

export interface PromptContext {
  persona?: string;
  sources?: string[];
  constraints?: string;
  guardrails?: string;
}

export interface PromptSummary {
  id: string;
  name: string;
  section: AgentSection;
  subSection?: string;
  route?: string;
  categories: string[];
  tags: string[];
  version: number;
  isActive: boolean;
  commentsCount: number;
  updatedAt: string;
}

export interface PromptDetail extends PromptSummary {
  systemPrompt: string;
  userPromptTemplate: string;
  tone?: string;
  outputFormat?: string;
  fewShot?: FewShotExample[];
  context?: PromptContext;
  createdBy: { id: string; email: string };
  updatedBy: { id: string; email: string };
  createdAt: string;
}

export interface PromptPreviewRequest {
  systemPrompt: string;
  userPromptTemplate: string;
  variables?: Record<string, string>;
  context?: PromptContext;
}

export interface PromptPreviewResponse {
  output: string;
  tokensUsed: number;
  processingTime: number;
}
