import { Injectable } from '@nestjs/common';
import { TextractService } from '../textract/textract.service';
import type { DocumentExtractor } from './document-extractor.interface';
import type { ExtractionResult, ExtractedTable } from '@alliance-risk/shared';

/**
 * Extracts PDF documents using AWS Textract.
 * Converts Textract text + table blocks to Markdown format.
 */
@Injectable()
export class TextractExtractor implements DocumentExtractor {
  readonly supportedMimeTypes = ['application/pdf'];

  constructor(private readonly textract: TextractService) {}

  /* eslint-disable @typescript-eslint/no-unused-vars */
  async extract(
    s3Bucket: string,
    s3Key: string,
    _mimeType: string,
    _fileName: string,
  ): Promise<ExtractionResult> {
    /* eslint-enable @typescript-eslint/no-unused-vars */
    const result = await this.textract.analyzeDocument(s3Bucket, s3Key);

    // Convert textContent + tables to Markdown
    const markdownParts: string[] = [];

    if (result.textContent) {
      markdownParts.push(result.textContent);
    }

    for (const table of result.tables) {
      const tableMarkdown = this.tableToMarkdown(table);
      if (tableMarkdown) markdownParts.push(tableMarkdown);
    }

    return {
      ...result,
      markdownContent: markdownParts.join('\n\n'),
      metadata: {
        ...result.metadata,
        extractorModel: 'textract',
      },
    };
  }

  /**
   * Converts an ExtractedTable to Markdown table syntax.
   * | header | header | ... |
   * | --- | --- | ... |
   * | row | row | ... |
   */
  private tableToMarkdown(table: ExtractedTable): string {
    if (table.rows.length === 0) return '';

    const header = table.headers.length > 0 ? table.headers : table.rows[0];
    if (!header || header.length === 0) return '';

    const separator = header.map(() => '---');
    const dataRows =
      table.headers.length > 0 ? table.rows : table.rows.slice(1);

    const lines = [
      `| ${header.join(' | ')} |`,
      `| ${separator.join(' | ')} |`,
      ...dataRows.map((row) => `| ${row.join(' | ')} |`),
    ];

    return lines.join('\n');
  }
}
