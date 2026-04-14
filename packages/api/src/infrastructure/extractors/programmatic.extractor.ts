import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../storage/storage.service';
import type { DocumentExtractor } from './document-extractor.interface';
import type { ExtractionResult } from '@alliance-risk/shared';
import mammoth from 'mammoth';
import TurndownService from 'turndown';

type DocxExtractionMode = 'text' | 'html';

interface ExtractionTimingFields {
  mime: string;
  fileName: string;
  mode: DocxExtractionMode | null;
  download_ms: number;
  extract_ms: number;
  total_ms: number;
  content_length: number;
}

/**
 * Extracts non-PDF documents using pure Node.js libraries (no AI dependency).
 * - DOCX: mammoth raw text (default) or legacy HTML → turndown
 * - XLSX/XLS: xlsx (SheetJS) → Markdown tables
 * - CSV: xlsx (SheetJS) → Markdown table
 * - HTML: turndown → Markdown
 * - MD/TXT: direct UTF-8 read
 */
@Injectable()
export class ProgrammaticExtractor implements DocumentExtractor {
  private readonly logger = new Logger(ProgrammaticExtractor.name);
  private readonly docxMode: DocxExtractionMode;

  readonly supportedMimeTypes = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',        // .xlsx
    'application/vnd.ms-excel',                                                  // .xls
    'text/csv',
    'text/html',
    'text/markdown',
    'text/plain',
  ];

  constructor(
    private readonly storage: StorageService,
    private readonly configService: ConfigService,
  ) {
    this.docxMode = this.resolveDocxMode();
  }

  async extract(
    _s3Bucket: string,
    s3Key: string,
    mimeType: string,
    fileName: string,
  ): Promise<ExtractionResult> {
    const totalStartedAt = Date.now();

    this.logger.log(`Extracting ${fileName} (${mimeType}) programmatically`);

    const downloadStartedAt = Date.now();
    const buffer = await this.storage.downloadObject(s3Key);
    const downloadCompletedAt = Date.now();
    const downloadMs = downloadCompletedAt - downloadStartedAt;

    const extractStartedAt = Date.now();
    let markdownContent: string;
    let mode: DocxExtractionMode | null = null;
    let extractorModel = 'programmatic';

    switch (mimeType) {
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        mode = this.docxMode;
        markdownContent = await this.extractDocx(buffer);
        extractorModel = mode === 'text' ? 'programmatic-docx-text' : 'programmatic-docx-html';
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

    const extractCompletedAt = Date.now();
    const extractMs = extractCompletedAt - extractStartedAt;
    const totalMs = extractCompletedAt - totalStartedAt;
    const contentLength = markdownContent.length;

    this.logExtractionTiming({
      mime: mimeType,
      fileName,
      mode,
      download_ms: downloadMs,
      extract_ms: extractMs,
      total_ms: totalMs,
      content_length: contentLength,
    });

    return {
      pages: 0,
      textContent: markdownContent,
      markdownContent,
      tables: [],
      metadata: {
        s3Key,
        processingTimeMs: totalMs,
        processedAt: new Date().toISOString(),
        extractorModel,
      },
    };
  }

  /**
   * DOCX → raw text by default, or legacy HTML → Markdown.
   */
  private async extractDocx(buffer: Buffer): Promise<string> {
    if (this.docxMode === 'html') {
      return this.extractDocxAsHtml(buffer);
    }

    return this.extractDocxAsText(buffer);
  }

  private async extractDocxAsText(buffer: Buffer): Promise<string> {
    const result = await mammoth.extractRawText({ buffer });

    if (result.messages.length > 0) {
      this.logger.warn(
        `mammoth warnings: ${result.messages.map((m) => m.message).join('; ')}`,
      );
    }

    return result.value ?? '';
  }

  private async extractDocxAsHtml(buffer: Buffer): Promise<string> {
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
    const turndown = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
    });
    return turndown.turndown(html);
  }

  private resolveDocxMode(): DocxExtractionMode {
    const rawMode = this.configService.get<string>('DOCX_EXTRACTION_MODE');
    const normalizedMode = rawMode?.toLowerCase().trim();

    if (normalizedMode === 'html') {
      return 'html';
    }

    if (normalizedMode && normalizedMode !== 'text') {
      this.logger.warn(
        `Unknown DOCX_EXTRACTION_MODE="${normalizedMode}"; defaulting to "text"`,
      );
    }

    return 'text';
  }

  private logExtractionTiming(fields: ExtractionTimingFields): void {
    const payload = JSON.stringify({
      event: 'extraction_complete',
      ...fields,
    });

    if (fields.content_length === 0) {
      this.logger.warn(payload);
      return;
    }

    this.logger.log(payload);
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
