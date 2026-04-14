import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ParseDocumentHandler } from './parse-document.handler';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { ExtractorFactory } from '../../../infrastructure/extractors/extractor-factory';
import type { ExtractionResult } from '@alliance-risk/shared';
import { ProgrammaticExtractor } from '../../../infrastructure/extractors/programmatic.extractor';
import { TextractExtractor } from '../../../infrastructure/extractors/textract.extractor';
import { StorageService } from '../../../infrastructure/storage/storage.service';

const mockExtraction: ExtractionResult = {
  pages: 3,
  textContent: 'Hello from Textract',
  markdownContent: '# Hello from Textract',
  tables: [],
  metadata: {
    textractJobId: 'tj-123',
    s3Key: 'assessments/a1/documents/d1/plan.pdf',
    processingTimeMs: 4200,
    processedAt: new Date().toISOString(),
    extractorModel: 'textract',
  },
};

const mockPrisma = {
  assessmentDocument: {
    update: jest.fn().mockResolvedValue({}),
  },
};

const mockExtractor = {
  extract: jest.fn().mockResolvedValue(mockExtraction),
  supportedMimeTypes: ['application/pdf'],
};

const mockExtractorFactory = {
  getExtractor: jest.fn().mockReturnValue(mockExtractor),
};

const mockConfig = {
  get: jest.fn().mockReturnValue('my-s3-bucket'),
};

const DOCX_FIXTURE_PATH = path.resolve(__dirname, '../../../../test/fixtures/sample-business-plan.docx');
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

describe('ParseDocumentHandler', () => {
  let handler: ParseDocumentHandler;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParseDocumentHandler,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ExtractorFactory, useValue: mockExtractorFactory },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    handler = module.get<ParseDocumentHandler>(ParseDocumentHandler);
    jest.clearAllMocks();
    mockExtractor.extract.mockResolvedValue(mockExtraction);
    mockExtractorFactory.getExtractor.mockReturnValue(mockExtractor);
  });

  const validInput = {
    assessmentId: 'a1',
    documentId: 'd1',
    s3Key: 'assessments/a1/documents/d1/plan.pdf',
    mimeType: 'application/pdf',
    fileName: 'plan.pdf',
  };

  describe('execute', () => {
    it('sets document status to PARSING before calling extractor', async () => {
      await handler.execute(validInput);

      const firstUpdateCall = mockPrisma.assessmentDocument.update.mock.calls[0];
      expect(firstUpdateCall[0].data.status).toBe('PARSING');
      expect(firstUpdateCall[0].where.id).toBe('d1');
    });

    it('routes PDF mime type through ExtractorFactory', async () => {
      await handler.execute(validInput);

      expect(mockExtractorFactory.getExtractor).toHaveBeenCalledWith('application/pdf');
      expect(mockExtractor.extract).toHaveBeenCalledWith(
        'my-s3-bucket',
        validInput.s3Key,
        validInput.mimeType,
        validInput.fileName,
      );
    });

    it('routes DOCX mime type through ExtractorFactory', async () => {
      const docxInput = {
        ...validInput,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileName: 'plan.docx',
      };
      await handler.execute(docxInput);

      expect(mockExtractorFactory.getExtractor).toHaveBeenCalledWith(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
    });

    it('sets document status to PARSED after successful extraction', async () => {
      await handler.execute(validInput);

      const secondUpdateCall = mockPrisma.assessmentDocument.update.mock.calls[1];
      expect(secondUpdateCall[0].data.status).toBe('PARSED');
      expect(secondUpdateCall[0].data.errorMessage).toBeNull();
    });

    it('returns the ExtractionResult', async () => {
      const result = await handler.execute(validInput);
      expect(result).toEqual(mockExtraction);
    });
  });

  describe('onFailure', () => {
    it('sets document status to FAILED with error message', async () => {
      const error = new Error('Extractor timed out');
      await handler.onFailure('d1', error);

      expect(mockPrisma.assessmentDocument.update).toHaveBeenCalledWith({
        where: { id: 'd1' },
        data: {
          status: 'FAILED',
          errorMessage: 'Extractor timed out',
        },
      });
    });
  });

  describe('execute integration with real ProgrammaticExtractor', () => {
    const fixtureBuffer = readFileSync(DOCX_FIXTURE_PATH);
    const originalDocxMode = process.env.DOCX_EXTRACTION_MODE;

    afterEach(() => {
      if (originalDocxMode === undefined) {
        delete process.env.DOCX_EXTRACTION_MODE;
      } else {
        process.env.DOCX_EXTRACTION_MODE = originalDocxMode;
      }
    });

    async function createIntegrationHandler(mode: 'text' | 'html') {
      process.env.DOCX_EXTRACTION_MODE = mode;

      const updateMock = jest.fn().mockResolvedValue({});
      const downloadObjectMock = jest.fn().mockResolvedValue(fixtureBuffer);
      const integrationConfig = {
        get: jest.fn((key: string) => {
          if (key === 'S3_BUCKET_NAME') return 'integration-bucket';
          if (key === 'DOCX_EXTRACTION_MODE') return process.env.DOCX_EXTRACTION_MODE;
          return undefined;
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ParseDocumentHandler,
          ExtractorFactory,
          ProgrammaticExtractor,
          {
            provide: PrismaService,
            useValue: {
              assessmentDocument: {
                update: updateMock,
              },
            },
          },
          {
            provide: StorageService,
            useValue: {
              downloadObject: downloadObjectMock,
            },
          },
          {
            provide: TextractExtractor,
            useValue: {
              supportedMimeTypes: ['application/pdf'],
              extract: jest.fn(),
            },
          },
          { provide: ConfigService, useValue: integrationConfig },
        ],
      }).compile();

      return {
        handler: module.get<ParseDocumentHandler>(ParseDocumentHandler),
        updateMock,
        downloadObjectMock,
      };
    }

    it('parses the DOCX fixture through the real text-mode extractor path', async () => {
      const { handler: integrationHandler, updateMock, downloadObjectMock } =
        await createIntegrationHandler('text');

      const result = await integrationHandler.execute({
        assessmentId: 'a-docx',
        documentId: 'd-docx',
        s3Key: 'assessments/a-docx/documents/d-docx/sample-business-plan.docx',
        mimeType: DOCX_MIME,
        fileName: 'sample-business-plan.docx',
      });

      expect(downloadObjectMock).toHaveBeenCalledWith(
        'assessments/a-docx/documents/d-docx/sample-business-plan.docx',
      );
      expect(updateMock.mock.calls[0][0]).toEqual({
        where: { id: 'd-docx' },
        data: { status: 'PARSING' },
      });
      expect(updateMock.mock.calls[1][0]).toEqual({
        where: { id: 'd-docx' },
        data: { status: 'PARSED', errorMessage: null },
      });
      expect(result).toEqual(
        expect.objectContaining({
          pages: 0,
          textContent: expect.any(String),
          markdownContent: expect.any(String),
          tables: expect.any(Array),
          metadata: expect.objectContaining({
            s3Key: 'assessments/a-docx/documents/d-docx/sample-business-plan.docx',
            processingTimeMs: expect.any(Number),
            processedAt: expect.any(String),
            extractorModel: 'programmatic-docx-text',
          }),
        }),
      );
      expect(result.textContent.length).toBeGreaterThan(500);
      expect(result.markdownContent.length).toBeGreaterThan(500);
    });

    it('parses the DOCX fixture through the real html-mode extractor path', async () => {
      const { handler: integrationHandler, updateMock, downloadObjectMock } =
        await createIntegrationHandler('html');

      const result = await integrationHandler.execute({
        assessmentId: 'a-docx-html',
        documentId: 'd-docx-html',
        s3Key: 'assessments/a-docx-html/documents/d-docx-html/sample-business-plan.docx',
        mimeType: DOCX_MIME,
        fileName: 'sample-business-plan.docx',
      });

      expect(downloadObjectMock).toHaveBeenCalledWith(
        'assessments/a-docx-html/documents/d-docx-html/sample-business-plan.docx',
      );
      expect(updateMock.mock.calls[0][0].data.status).toBe('PARSING');
      expect(updateMock.mock.calls[1][0].data.status).toBe('PARSED');
      expect(result).toEqual(
        expect.objectContaining({
          pages: 0,
          textContent: expect.any(String),
          markdownContent: expect.any(String),
          tables: expect.any(Array),
          metadata: expect.objectContaining({
            s3Key: 'assessments/a-docx-html/documents/d-docx-html/sample-business-plan.docx',
            processingTimeMs: expect.any(Number),
            processedAt: expect.any(String),
            extractorModel: 'programmatic-docx-html',
          }),
        }),
      );
      expect(result.textContent.length).toBeGreaterThan(500);
      expect(result.markdownContent.length).toBeGreaterThan(500);
    });
  });
});
