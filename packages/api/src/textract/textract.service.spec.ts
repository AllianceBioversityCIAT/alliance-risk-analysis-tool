import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TextractClient } from '@aws-sdk/client-textract';
import { TextractService } from './textract.service';
import type { GetDocumentAnalysisResponse, Block } from '@aws-sdk/client-textract';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeBlock(overrides: Partial<Block>): Block {
  return {
    BlockType: 'LINE',
    Id: Math.random().toString(36).slice(2),
    ...overrides,
  };
}

function makeLineBlock(text: string, id = Math.random().toString(36).slice(2)): Block {
  return makeBlock({ BlockType: 'LINE', Id: id, Text: text });
}

function makePageBlock(id = 'page-1'): Block {
  return makeBlock({ BlockType: 'PAGE', Id: id });
}

function makeCellBlock(row: number, col: number, childIds: string[], id?: string): Block {
  return makeBlock({
    BlockType: 'CELL',
    Id: id ?? `cell-${row}-${col}`,
    RowIndex: row,
    ColumnIndex: col,
    Relationships: [{ Type: 'CHILD', Ids: childIds }],
  });
}

function makeWordBlock(text: string, id: string): Block {
  return makeBlock({ BlockType: 'WORD', Id: id, Text: text });
}

function makeTableBlock(cellIds: string[], id = 'table-1'): Block {
  return makeBlock({
    BlockType: 'TABLE',
    Id: id,
    Page: 1,
    Relationships: [{ Type: 'CHILD', Ids: cellIds }],
  });
}

function makePage(blocks: Block[]): Partial<GetDocumentAnalysisResponse> {
  return {
    JobStatus: 'SUCCEEDED',
    Blocks: blocks,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('TextractService', () => {
  let service: TextractService;
  let clientSendSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TextractService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('us-east-1') },
        },
      ],
    }).compile();

    service = module.get<TextractService>(TextractService);

    // Spy on the private client's `send` method
    clientSendSpy = jest
      .spyOn(TextractClient.prototype, 'send')
      .mockResolvedValue({} as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── transformResult ──────────────────────────────────────────────────────

  describe('transformResult (via analyzeDocument)', () => {
    it('concatenates LINE block text into textContent', async () => {
      const blocks = [
        makePageBlock(),
        makeLineBlock('Hello world', 'l1'),
        makeLineBlock('Second line', 'l2'),
      ];

      clientSendSpy
        .mockResolvedValueOnce({ JobId: 'tj-1' }) // StartDocumentAnalysis
        .mockResolvedValueOnce(makePage(blocks));   // GetDocumentAnalysis

      const result = await service.analyzeDocument('my-bucket', 'my-key.pdf');

      expect(result.textContent).toBe('Hello world\nSecond line');
    });

    it('counts PAGE blocks correctly', async () => {
      const blocks = [makePageBlock('p1'), makePageBlock('p2'), makeLineBlock('text')];

      clientSendSpy
        .mockResolvedValueOnce({ JobId: 'tj-2' })
        .mockResolvedValueOnce(makePage(blocks));

      const result = await service.analyzeDocument('bucket', 'key.pdf');

      expect(result.pages).toBe(2);
    });

    it('builds a table with headers and rows from CELL blocks', async () => {
      const w1 = makeWordBlock('Name', 'w1');
      const w2 = makeWordBlock('Age', 'w2');
      const w3 = makeWordBlock('Alice', 'w3');
      const w4 = makeWordBlock('30', 'w4');

      // Header row: (1,1)=Name, (1,2)=Age
      // Data row:   (2,1)=Alice, (2,2)=30
      const cell11 = makeCellBlock(1, 1, ['w1']);
      const cell12 = makeCellBlock(1, 2, ['w2']);
      const cell21 = makeCellBlock(2, 1, ['w3']);
      const cell22 = makeCellBlock(2, 2, ['w4']);

      const tableBlock = makeTableBlock([cell11.Id!, cell12.Id!, cell21.Id!, cell22.Id!]);

      const blocks = [
        makePageBlock(),
        tableBlock,
        cell11, cell12, cell21, cell22,
        w1, w2, w3, w4,
      ];

      clientSendSpy
        .mockResolvedValueOnce({ JobId: 'tj-3' })
        .mockResolvedValueOnce(makePage(blocks));

      const result = await service.analyzeDocument('bucket', 'key.pdf');

      expect(result.tables).toHaveLength(1);
      const table = result.tables[0];
      expect(table.rowCount).toBe(2);
      expect(table.columnCount).toBe(2);
      expect(table.headers).toEqual(['Name', 'Age']);
      expect(table.rows[1]).toEqual(['Alice', '30']);
    });

    it('handles empty document (no blocks)', async () => {
      clientSendSpy
        .mockResolvedValueOnce({ JobId: 'tj-4' })
        .mockResolvedValueOnce(makePage([]));

      const result = await service.analyzeDocument('bucket', 'key.pdf');

      expect(result.textContent).toBe('');
      expect(result.tables).toHaveLength(0);
      expect(result.pages).toBe(1); // fallback minimum 1
    });

    it('populates metadata fields', async () => {
      clientSendSpy
        .mockResolvedValueOnce({ JobId: 'tj-meta' })
        .mockResolvedValueOnce(makePage([makePageBlock()]));

      const result = await service.analyzeDocument('bucket', 'my-key.pdf');

      expect(result.metadata.textractJobId).toBe('tj-meta');
      expect(result.metadata.s3Key).toBe('my-key.pdf');
      expect(typeof result.metadata.processingTimeMs).toBe('number');
      expect(result.metadata.processedAt).toBeTruthy();
    });
  });

  // ─── analyzeDocument ──────────────────────────────────────────────────────

  describe('analyzeDocument', () => {
    it('calls StartDocumentAnalysis with correct S3 params', async () => {
      clientSendSpy
        .mockResolvedValueOnce({ JobId: 'tj-start' })
        .mockResolvedValueOnce(makePage([]));

      await service.analyzeDocument('test-bucket', 'path/to/doc.pdf');

      const startCall = clientSendSpy.mock.calls[0][0];
      // The input object is passed to send — check DocumentLocation
      expect(JSON.stringify(startCall)).toContain('test-bucket');
      expect(JSON.stringify(startCall)).toContain('path/to/doc.pdf');
      expect(JSON.stringify(startCall)).toContain('TABLES');
    });

    it('throws when Textract returns FAILED status', async () => {
      clientSendSpy
        .mockResolvedValueOnce({ JobId: 'tj-fail' })
        .mockResolvedValueOnce({
          JobStatus: 'FAILED',
          StatusMessage: 'Unsupported document type',
          Blocks: [],
        });

      await expect(service.analyzeDocument('bucket', 'key.pdf')).rejects.toThrow(
        'Textract job tj-fail failed',
      );
    });

    it('throws when StartDocumentAnalysis does not return a JobId', async () => {
      clientSendSpy.mockResolvedValueOnce({ JobId: undefined });

      await expect(service.analyzeDocument('bucket', 'key.pdf')).rejects.toThrow(
        'Textract did not return a JobId',
      );
    });
  });
});
