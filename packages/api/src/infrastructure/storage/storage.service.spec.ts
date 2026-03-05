import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';

// Mock the AWS S3 client and presigner
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://s3.example.com/presigned-url'),
}));

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              const config: Record<string, string> = {
                AWS_REGION: 'us-east-1',
                S3_BUCKET_NAME: 'test-bucket',
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
  });

  describe('buildDocumentKey', () => {
    it('should build correct S3 key for documents', () => {
      const key = service.buildDocumentKey('assess-123', 'doc-456', 'business-plan.pdf');
      expect(key).toBe('assessments/assess-123/documents/doc-456/business-plan.pdf');
    });
  });

  describe('buildReportKey', () => {
    it('should build correct S3 key for reports', () => {
      const key = service.buildReportKey('assess-123', 'report-789');
      expect(key).toBe('assessments/assess-123/reports/report-789.pdf');
    });
  });

  describe('generatePresignedUploadUrl', () => {
    it('should return a presigned URL', async () => {
      const url = await service.generatePresignedUploadUrl(
        'assessments/123/documents/456/plan.pdf',
        'application/pdf',
      );
      expect(url).toBe('https://s3.example.com/presigned-url');
    });
  });

  describe('generatePresignedDownloadUrl', () => {
    it('should return a presigned download URL', async () => {
      const url = await service.generatePresignedDownloadUrl(
        'assessments/123/documents/456/plan.pdf',
      );
      expect(url).toBe('https://s3.example.com/presigned-url');
    });
  });
});
