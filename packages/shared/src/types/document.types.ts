import { DocumentStatus } from '../enums/document-status.enum';

export interface DocumentInfo {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  status: DocumentStatus;
  parseJobId: string | null;
  errorMessage: string | null;
  uploadedAt: string;
}

export interface UploadUrlResponse {
  presignedUrl: string;
  documentId: string;
}

export interface ExtractedTable {
  /** 1-based page number where the table appears */
  page: number;
  /** Table index on the page (0-based) */
  tableIndex: number;
  /** Row count */
  rowCount: number;
  /** Column count */
  columnCount: number;
  /** Header row (first row), if identifiable */
  headers: string[];
  /** All rows as string arrays (including header) */
  rows: string[][];
}

export interface ExtractionResult {
  /** Total number of pages in the document (0 for non-paginated formats like CSV/TXT) */
  pages: number;
  /** Full extracted text, concatenated (legacy — kept for backward compat) */
  textContent: string;
  /** Extracted content as well-structured Markdown (primary content for viewers) */
  markdownContent: string;
  /** Structured tables extracted from the document (populated by Textract; empty for programmatic) */
  tables: ExtractedTable[];
  /** Processing metadata */
  metadata: {
    /** Textract async job ID — only present for PDF/Textract extraction */
    textractJobId?: string;
    s3Key: string;
    processingTimeMs: number;
    processedAt: string; // ISO 8601
    /** Extractor model used: 'textract' | 'programmatic' */
    extractorModel: string;
  };
}
