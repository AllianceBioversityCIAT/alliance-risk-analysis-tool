import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ParseDocumentHandler } from './parse-document.handler';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { ExtractorFactory } from '../../../infrastructure/extractors/extractor-factory';
import type { ExtractionResult } from '@alliance-risk/shared';

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
});
