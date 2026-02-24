import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { AssessmentsService } from './assessments.service';
import { PrismaService } from '../database/prisma.service';
import { StorageService } from '../storage/storage.service';
import { JobsService } from '../jobs/jobs.service';
import { IntakeMode } from '@alliance-risk/shared';

const mockAssessment = {
  id: 'assess-1',
  name: 'Test Assessment',
  companyName: 'Test Co',
  companyType: null,
  country: 'Kenya',
  status: 'DRAFT',
  intakeMode: 'UPLOAD',
  progress: 0,
  overallRiskScore: null,
  overallRiskLevel: null,
  userId: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPrisma = {
  assessment: {
    create: jest.fn().mockResolvedValue(mockAssessment),
    findMany: jest.fn().mockResolvedValue([mockAssessment]),
    findUnique: jest.fn().mockResolvedValue(mockAssessment),
    update: jest.fn().mockResolvedValue(mockAssessment),
    delete: jest.fn().mockResolvedValue(mockAssessment),
    count: jest.fn().mockResolvedValue(1),
  },
  assessmentDocument: {
    create: jest.fn().mockResolvedValue({ id: 'doc-1', s3Key: '' }),
    update: jest.fn().mockResolvedValue({}),
    findMany: jest.fn().mockResolvedValue([]),
  },
  assessmentComment: {
    create: jest.fn().mockResolvedValue({ id: 'comment-1', content: 'Test' }),
    findMany: jest.fn().mockResolvedValue([]),
  },
};

const mockStorage = {
  buildDocumentKey: jest.fn().mockReturnValue('assessments/assess-1/documents/doc-1/plan.pdf'),
  generatePresignedUploadUrl: jest.fn().mockResolvedValue('https://s3.example.com/upload'),
};

const mockJobs = {
  create: jest.fn().mockResolvedValue('job-1'),
};

describe('AssessmentsService', () => {
  let service: AssessmentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssessmentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StorageService, useValue: mockStorage },
        { provide: JobsService, useValue: mockJobs },
      ],
    }).compile();

    service = module.get<AssessmentsService>(AssessmentsService);
    jest.clearAllMocks();
    mockPrisma.assessment.findUnique.mockResolvedValue(mockAssessment);
  });

  describe('create', () => {
    it('should create an assessment', async () => {
      mockPrisma.assessment.create.mockResolvedValue(mockAssessment);
      const result = await service.create(
        { name: 'Test', companyName: 'Test Co', intakeMode: IntakeMode.UPLOAD },
        'user-1',
      );
      expect(result).toEqual(mockAssessment);
    });
  });

  describe('findOne', () => {
    it('should return assessment when user owns it', async () => {
      const result = await service.findOne('assess-1', 'user-1');
      expect(result).toEqual(mockAssessment);
    });

    it('should throw NotFoundException when not found', async () => {
      mockPrisma.assessment.findUnique.mockResolvedValue(null);
      await expect(service.findOne('bad-id', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user does not own assessment', async () => {
      await expect(service.findOne('assess-1', 'other-user')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getStats', () => {
    it('should return stats for user', async () => {
      mockPrisma.assessment.count.mockResolvedValue(1);
      const result = await service.getStats('user-1');
      expect(result).toHaveProperty('active');
      expect(result).toHaveProperty('drafts');
      expect(result).toHaveProperty('completed');
      expect(result).toHaveProperty('total');
    });
  });

  describe('requestUploadUrl', () => {
    it('should create document record and return presigned URL', async () => {
      mockPrisma.assessmentDocument.create.mockResolvedValue({ id: 'doc-1', s3Key: '' });
      const result = await service.requestUploadUrl(
        'assess-1',
        { fileName: 'plan.pdf', mimeType: 'application/pdf', fileSize: 1024 },
        'user-1',
      );
      expect(result.presignedUrl).toBeTruthy();
      expect(result.documentId).toBe('doc-1');
    });

    it('should reject invalid mime types', async () => {
      await expect(
        service.requestUploadUrl(
          'assess-1',
          { fileName: 'plan.exe', mimeType: 'application/exe', fileSize: 1024 },
          'user-1',
        ),
      ).rejects.toThrow();
    });
  });
});
