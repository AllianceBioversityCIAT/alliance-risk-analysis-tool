import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  TextractClient,
  StartDocumentAnalysisCommand,
  GetDocumentAnalysisCommand,
  type GetDocumentAnalysisResponse,
  type Block,
} from '@aws-sdk/client-textract';
import type { ExtractionResult, ExtractedTable } from '@alliance-risk/shared';

const BACKOFF_INITIAL_MS = 2000;
const BACKOFF_MAX_MS = 30000;
const BACKOFF_MULTIPLIER = 2;
const MAX_POLL_PAGES = 1000; // safety limit for GetDocumentAnalysis pagination

@Injectable()
export class TextractService {
  private readonly logger = new Logger(TextractService.name);
  private readonly client: TextractClient;

  constructor(private readonly config: ConfigService) {
    this.client = new TextractClient({
      region: config.get<string>('AWS_REGION') ?? 'us-east-1',
    });
  }

  /**
   * Orchestrates full async Textract analysis for a PDF in S3.
   * Starts the job, polls until complete, and returns structured ExtractionResult.
   */
  async analyzeDocument(s3Bucket: string, s3Key: string): Promise<ExtractionResult> {
    const startTime = Date.now();
    this.logger.log(`Starting Textract analysis for s3://${s3Bucket}/${s3Key}`);

    const textractJobId = await this.startAnalysis(s3Bucket, s3Key);
    this.logger.log(`Textract job started: ${textractJobId}`);

    const pages = await this.pollUntilComplete(textractJobId);
    this.logger.log(`Textract job ${textractJobId} completed with ${pages.length} response page(s)`);

    return this.transformResult(pages, textractJobId, s3Key, startTime);
  }

  /**
   * Starts async Textract document analysis with TABLES feature.
   * Returns the Textract job ID.
   */
  private async startAnalysis(s3Bucket: string, s3Key: string): Promise<string> {
    const command = new StartDocumentAnalysisCommand({
      DocumentLocation: {
        S3Object: {
          Bucket: s3Bucket,
          Name: s3Key,
        },
      },
      FeatureTypes: ['TABLES'],
    });

    const response = await this.client.send(command);

    if (!response.JobId) {
      throw new Error('Textract did not return a JobId');
    }

    return response.JobId;
  }

  /**
   * Polls GetDocumentAnalysis with exponential backoff until the job reaches
   * a terminal state (SUCCEEDED or FAILED).
   * Backoff: 2s → 4s → 8s → 16s → 30s (capped)
   */
  private async pollUntilComplete(textractJobId: string): Promise<GetDocumentAnalysisResponse[]> {
    const allPages: GetDocumentAnalysisResponse[] = [];
    let delayMs = BACKOFF_INITIAL_MS;
    let pageCount = 0;

    while (pageCount < MAX_POLL_PAGES) {
      await this.sleep(delayMs);

      let nextToken: string | undefined;
      let jobStatus: string | undefined;

      // Collect all pagination pages for this poll iteration
      do {
        const command = new GetDocumentAnalysisCommand({
          JobId: textractJobId,
          ...(nextToken && { NextToken: nextToken }),
        });

        const response = await this.client.send(command);
        jobStatus = response.JobStatus;

        if (jobStatus === 'FAILED') {
          throw new Error(
            `Textract job ${textractJobId} failed: ${response.StatusMessage ?? 'Unknown error'}`,
          );
        }

        if (jobStatus === 'SUCCEEDED' || jobStatus === 'PARTIAL_SUCCESS') {
          allPages.push(response);
          nextToken = response.NextToken;
        }

        pageCount++;
      } while (jobStatus === 'SUCCEEDED' && nextToken);

      if (jobStatus === 'SUCCEEDED' || jobStatus === 'PARTIAL_SUCCESS') {
        return allPages;
      }

      // Still IN_PROGRESS — increase backoff
      delayMs = Math.min(delayMs * BACKOFF_MULTIPLIER, BACKOFF_MAX_MS);
      this.logger.debug(`Textract job ${textractJobId} still in progress, next poll in ${delayMs}ms`);
    }

    throw new Error(`Textract job ${textractJobId} exceeded maximum poll iterations`);
  }

  /**
   * Transforms raw Textract block responses into a structured ExtractionResult.
   * - Extracts LINE blocks → concatenates into textContent
   * - Extracts TABLE/CELL blocks → builds ExtractedTable[]
   * - Counts PAGE blocks for page count
   */
  private transformResult(
    pages: GetDocumentAnalysisResponse[],
    textractJobId: string,
    s3Key: string,
    startTime: number,
  ): ExtractionResult {
    // Flatten all blocks from all response pages
    const allBlocks: Block[] = pages.flatMap((p) => p.Blocks ?? []);

    // Build a lookup map for block relationships
    const blockMap = new Map<string, Block>(
      allBlocks.filter((b) => b.Id).map((b) => [b.Id!, b]),
    );

    // Count pages
    const pageCount = allBlocks.filter((b) => b.BlockType === 'PAGE').length;

    // Extract text from LINE blocks
    const lineBlocks = allBlocks.filter((b) => b.BlockType === 'LINE');
    const textContent = lineBlocks
      .map((b) => b.Text ?? '')
      .filter(Boolean)
      .join('\n');

    // Extract tables
    const tableBlocks = allBlocks.filter((b) => b.BlockType === 'TABLE');
    const tables: ExtractedTable[] = tableBlocks.map((table, tableIndex) => {
      // Get page number from geometry (fallback to 1)
      const page = table.Page ?? 1;

      // Get all CELL blocks that belong to this table
      const cellIds = table.Relationships
        ?.filter((r) => r.Type === 'CHILD')
        .flatMap((r) => r.Ids ?? []) ?? [];

      const cells = cellIds
        .map((id) => blockMap.get(id))
        .filter((b): b is Block => b?.BlockType === 'CELL');

      if (cells.length === 0) {
        return {
          page,
          tableIndex,
          rowCount: 0,
          columnCount: 0,
          headers: [],
          rows: [],
        };
      }

      const rowCount = Math.max(...cells.map((c) => c.RowIndex ?? 0));
      const columnCount = Math.max(...cells.map((c) => c.ColumnIndex ?? 0));

      // Build 2D grid (1-indexed from Textract)
      const grid: string[][] = Array.from({ length: rowCount }, () =>
        Array(columnCount).fill(''),
      );

      for (const cell of cells) {
        const row = (cell.RowIndex ?? 1) - 1;
        const col = (cell.ColumnIndex ?? 1) - 1;

        // Get cell text by walking its CHILD word blocks
        const wordIds = cell.Relationships
          ?.filter((r) => r.Type === 'CHILD')
          .flatMap((r) => r.Ids ?? []) ?? [];

        const cellText = wordIds
          .map((id) => blockMap.get(id))
          .filter((b): b is Block => b?.BlockType === 'WORD' || b?.BlockType === 'SELECTION_ELEMENT')
          .map((b) => (b.BlockType === 'SELECTION_ELEMENT' ? (b.SelectionStatus === 'SELECTED' ? 'X' : '') : (b.Text ?? '')))
          .join(' ')
          .trim();

        if (row >= 0 && row < rowCount && col >= 0 && col < columnCount) {
          grid[row][col] = cellText;
        }
      }

      const headers = grid[0] ?? [];
      const rows = grid;

      return { page, tableIndex, rowCount, columnCount, headers, rows };
    });

    const processingTimeMs = Date.now() - startTime;

    return {
      pages: pageCount || 1,
      textContent,
      tables,
      metadata: {
        textractJobId,
        s3Key,
        processingTimeMs,
        processedAt: new Date().toISOString(),
        textractModel: 'AnalyzeDocument/TABLES',
      },
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
