import { Injectable, Logger } from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import type { DocumentExtractor } from './document-extractor.interface';
import type { ExtractionResult } from '@alliance-risk/shared';

/**
 * Extracts non-PDF documents using pure Node.js libraries (no AI dependency).
 * - DOCX: mammoth → HTML → turndown → Markdown
 * - XLSX/XLS: xlsx (SheetJS) → Markdown tables
 * - CSV: xlsx (SheetJS) → Markdown table
 * - HTML: turndown → Markdown
 * - MD/TXT: direct UTF-8 read
 */
@Injectable()
export class ProgrammaticExtractor implements DocumentExtractor {
  private readonly logger = new Logger(ProgrammaticExtractor.name);

  readonly supportedMimeTypes = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',        // .xlsx
    'application/vnd.ms-excel',                                                  // .xls
    'text/csv',
    'text/html',
    'text/markdown',
    'text/plain',
  ];

  constructor(private readonly storage: StorageService) {}

  async extract(
    _s3Bucket: string,
    s3Key: string,
    mimeType: string,
    fileName: string,
  ): Promise<ExtractionResult> {
    const startedAt = Date.now();

    this.logger.log(`Extracting ${fileName} (${mimeType}) programmatically`);

    const buffer = await this.storage.downloadObject(s3Key);
    let markdownContent: string;

    switch (mimeType) {
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        markdownContent = await this.extractDocx(buffer);
        break;
      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      case 'application/vnd.ms-excel':
        markdownContent = this.extractExcel(buffer);
        break;
      case 'text/csv':
        markdownContent = this.extractCsv(buffer);
        break;
      case 'text/html':
        markdownContent = await this.extractHtml(buffer);
        break;
      case 'text/markdown':
      case 'text/plain':
        markdownContent = buffer.toString('utf-8');
        break;
      default:
        markdownContent = buffer.toString('utf-8');
    }

    this.logger.log(
      `Extraction complete for ${fileName}. Content length: ${markdownContent.length}`,
    );

    return {
      pages: 0,
      textContent: markdownContent,
      markdownContent,
      tables: [],
      metadata: {
        s3Key,
        processingTimeMs: Date.now() - startedAt,
        processedAt: new Date().toISOString(),
        extractorModel: 'programmatic',
      },
    };
  }

  /**
   * DOCX → HTML (mammoth) → Markdown (turndown).
   */
  private async extractDocx(buffer: Buffer): Promise<string> {
    const mammoth = await import('mammoth');
    const result = await mammoth.convertToHtml({ buffer });

    if (result.messages.length > 0) {
      this.logger.warn(
        `mammoth warnings: ${result.messages.map((m) => m.message).join('; ')}`,
      );
    }

    if (!result.value) return '';

    return this.htmlToMarkdown(result.value);
  }

  /**
   * XLSX/XLS → Markdown tables (one section per sheet).
   */
  private extractExcel(buffer: Buffer): string {
    // xlsx is CJS-only
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const XLSX = require('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sections: string[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const data: string[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: '',
        raw: false,
      });

      if (data.length === 0) continue;

      const table = this.buildMarkdownTable(data);
      if (workbook.SheetNames.length > 1) {
        sections.push(`## ${sheetName}\n\n${table}`);
      } else {
        sections.push(table);
      }
    }

    return sections.join('\n\n');
  }

  /**
   * CSV → Markdown table via xlsx (handles quoted fields correctly).
   */
  private extractCsv(buffer: Buffer): string {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const XLSX = require('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    if (!sheet) return '';

    const data: string[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      raw: false,
    });

    if (data.length === 0) return '';

    return this.buildMarkdownTable(data);
  }

  /**
   * HTML → Markdown via turndown.
   */
  private async extractHtml(buffer: Buffer): Promise<string> {
    const html = buffer.toString('utf-8');
    return this.htmlToMarkdown(html);
  }

  /**
   * Convert HTML string to Markdown using TurndownService.
   */
  private async htmlToMarkdown(html: string): Promise<string> {
    const TurndownModule = await import('turndown');
    // Handle both ESM default and CJS module.exports
    const TurndownService =
      'default' in TurndownModule ? TurndownModule.default : TurndownModule;
    const turndown = new (TurndownService as any)({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
    });
    return turndown.turndown(html);
  }

  /**
   * Build a Markdown table from a 2D array of strings.
   * First row is treated as header.
   */
  private buildMarkdownTable(data: string[][]): string {
    if (data.length === 0) return '';

    // Normalise row lengths to the max column count
    const colCount = Math.max(...data.map((r) => r.length));
    const rows = data.map((r) => {
      const padded = [...r];
      while (padded.length < colCount) padded.push('');
      return padded.map((cell) => this.escapeCell(String(cell)));
    });

    const header = `| ${rows[0].join(' | ')} |`;
    const separator = `| ${rows[0].map(() => '---').join(' | ')} |`;
    const body = rows
      .slice(1)
      .map((row) => `| ${row.join(' | ')} |`)
      .join('\n');

    return [header, separator, body].filter(Boolean).join('\n');
  }

  /**
   * Escape pipe characters in cell values to prevent broken Markdown tables.
   */
  private escapeCell(value: string): string {
    return value.replace(/\|/g, '\\|').replace(/\n/g, ' ').trim();
  }
}
