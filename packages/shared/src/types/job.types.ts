export enum JobStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum JobType {
  AI_PREVIEW = 'AI_PREVIEW',
  PARSE_DOCUMENT = 'PARSE_DOCUMENT',
  GAP_DETECTION = 'GAP_DETECTION',
  RISK_ANALYSIS = 'RISK_ANALYSIS',
  REPORT_GENERATION = 'REPORT_GENERATION',
}

export interface JobResponse {
  id: string;
  type: JobType;
  status: JobStatus;
  result: unknown | null;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface JobSubmitResponse {
  jobId: string;
  status: 'PROCESSING';
}
