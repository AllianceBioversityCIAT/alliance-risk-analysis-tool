import type { ExtractionResult } from '@alliance-risk/shared';

/**
 * Common interface for all document extractors.
 * Implementations: TextractExtractor (PDF), ProgrammaticExtractor (all other formats).
 */
export interface DocumentExtractor {
  /**
   * Extract content from a document stored in S3.
   * All extractors MUST populate the `markdownContent` field on the result.
   */
  extract(
    s3Bucket: string,
    s3Key: string,
    mimeType: string,
    fileName: string,
  ): Promise<ExtractionResult>;

  /** MIME types handled by this extractor */
  readonly supportedMimeTypes: string[];
}
