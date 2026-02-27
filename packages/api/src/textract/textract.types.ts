import type { Block } from '@aws-sdk/client-textract';

/** Re-export Block for internal use */
export type TextractBlock = Block;

/** Textract job status values returned by GetDocumentAnalysis */
export type TextractJobStatus = 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'PARTIAL_SUCCESS';
