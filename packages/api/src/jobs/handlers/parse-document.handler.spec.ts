import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ParseDocumentHandler } from './parse-document.handler';
import { PrismaService } from '../../database/prisma.service';
import { TextractService } from '../../textract/textract.service';
import type { ExtractionResult } from '@alliance-risk/shared';

const mockExtraction: ExtractionResult = {
  pages: 3,
  textContent: 'Hello from Textract',
  tables: [],
  metadata: {
    textractJobId: 'tj-123',
    s3Key: 'assessments/a1/documents/d1/plan.pdf',
    processingTimeMs: 4200,
    processedAt: new Date().toISOString(),
    textractModel: 'AnalyzeDocument/TABLES',
  },
};

const mockPrisma = {
  assessmentDocument: {
    update: jest.fn().mockResolvedValue({}),
  },
};

const mockTextract = {
  analyzeDocument: jest.fn().mockResolvedValue(mockExtraction),
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
        { provide: TextractService, useValue: mockTextract },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    handler = module.get<ParseDocumentHandler>(ParseDocumentHandler);
    jest.clearAllMocks();
    mockTextract.analyzeDocument.mockResolvedValue(mockExtraction);
  });

  const validInput = {
    assessmentId: 'a1',
    documentId: 'd1',
    s3Key: 'assessments/a1/documents/d1/plan.pdf',
  };

  describe('execute', () => {
    it('sets document status to PARSING before calling Textract', async () => {
      await handler.execute(validInput);

      const firstUpdateCall = mockPrisma.assessmentDocument.update.mock.calls[0];
      expect(firstUpdateCall[0].data.status).toBe('PARSING');
      expect(firstUpdateCall[0].where.id).toBe('d1');
    });

    it('calls TextractService with correct bucket and s3Key', async () => {
      await handler.execute(validInput);

      expect(mockTextract.analyzeDocument).toHaveBeenCalledWith(
        'my-s3-bucket',
        validInput.s3Key,
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
      const error = new Error('Textract timed out');
      await handler.onFailure('d1', error);

      expect(mockPrisma.assessmentDocument.update).toHaveBeenCalledWith({
        where: { id: 'd1' },
        data: {
          status: 'FAILED',
          errorMessage: 'Textract timed out',
        },
      });
    });
  });
});
