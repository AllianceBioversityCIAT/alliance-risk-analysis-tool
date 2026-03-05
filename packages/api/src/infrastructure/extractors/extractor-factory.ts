import { Injectable } from '@nestjs/common';
import type { DocumentExtractor } from './document-extractor.interface';
import { TextractExtractor } from './textract.extractor';
import { ProgrammaticExtractor } from './programmatic.extractor';

/**
 * Strategy router: selects the correct DocumentExtractor based on MIME type.
 * Adding a new format requires only a new extractor class — no changes here.
 */
@Injectable()
export class ExtractorFactory {
  private readonly extractors: DocumentExtractor[];

  constructor(
    private readonly textractExtractor: TextractExtractor,
    private readonly programmaticExtractor: ProgrammaticExtractor,
  ) {
    this.extractors = [textractExtractor, programmaticExtractor];
  }

  /**
   * Returns the extractor registered for the given MIME type.
   * Throws if no extractor supports the MIME type.
   */
  getExtractor(mimeType: string): DocumentExtractor {
    const extractor = this.extractors.find((e) =>
      e.supportedMimeTypes.includes(mimeType),
    );
    if (!extractor) {
      throw new Error(`No extractor registered for MIME type: ${mimeType}`);
    }
    return extractor;
  }
}
