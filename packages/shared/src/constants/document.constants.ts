/**
 * Supported document MIME types for upload & extraction.
 * PDF → Textract; all others → ProgrammaticExtractor (mammoth, xlsx, turndown).
 */
export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',        // .xlsx
  'application/vnd.ms-excel',                                                  // .xls
  'text/csv',
  'text/html',
  'text/markdown',
  'text/plain',
] as const;

export type AllowedDocumentMimeType = (typeof ALLOWED_DOCUMENT_MIME_TYPES)[number];

/**
 * Accept string for file inputs (covers all 8 supported formats).
 */
export const ALLOWED_DOCUMENT_EXTENSIONS = '.pdf,.docx,.xls,.xlsx,.csv,.html,.md,.txt';

/**
 * Maximum file size for PDF documents (25 MB).
 * Textract can handle documents up to 500 MB, but we keep a generous cap.
 */
export const MAX_FILE_SIZE_PDF = 25 * 1024 * 1024; // 25 MB

/**
 * Maximum file size for non-PDF documents (10 MB).
 * Programmatic extraction (mammoth, xlsx, turndown) handles files in-memory.
 */
export const MAX_FILE_SIZE_OTHER = 10 * 1024 * 1024; // 10 MB
