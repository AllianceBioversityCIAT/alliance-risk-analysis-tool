import { Test, TestingModule } from '@nestjs/testing';
import { ReportService } from './report.service';
import { PrismaService } from '../database/prisma.service';
import { JobsService } from '../jobs/jobs.service';
import { NotFoundException } from '@nestjs/common';

const mockAssessment = {
  id: 'assess-1',
  name: 'Test Assessment',
  companyName: 'Test Co',
  companyType: null,
  country: 'Kenya',
  status: 'COMPLETE',
  intakeMode: 'UPLOAD',
  progress: 100,
  overallRiskScore: 45.0,
  overallRiskLevel: 'MODERATE',
  userId: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPrisma = {
  assessment: {
    findUnique: jest.fn().mockResolvedValue(mockAssessment),
  },
  riskScore: {
    findMany: jest.fn().mockResolvedValue([]),
  },
};

const mockJobs = {
  create: jest.fn().mockResolvedValue('job-1'),
};

describe('ReportService', () => {
  let service: ReportService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JobsService, useValue: mockJobs },
      ],
    }).compile();

    service = module.get<ReportService>(ReportService);
    jest.clearAllMocks();
    mockPrisma.assessment.findUnique.mockResolvedValue(mockAssessment);
    mockPrisma.riskScore.findMany.mockResolvedValue([]);
  });

  describe('getReport', () => {
    it('should aggregate report data for an assessment', async () => {
      const report = await service.getReport('assess-1', 'user-1');
      expect(report.assessment.id).toBe('assess-1');
      expect(report.overallScore).toBe(45.0);
      expect(report.executiveSummary).toBeTruthy();
      expect(Array.isArray(report.categories)).toBe(true);
    });

    it('should throw NotFoundException for non-existent assessment', async () => {
      mockPrisma.assessment.findUnique.mockResolvedValue(null);
      await expect(service.getReport('bad-id', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('generatePdf', () => {
    it('should create a REPORT_GENERATION job', async () => {
      const result = await service.generatePdf('assess-1', 'user-1');
      expect(result.jobId).toBe('job-1');
      expect(mockJobs.create).toHaveBeenCalledWith(
        expect.any(String),
        { assessmentId: 'assess-1' },
        'user-1',
      );
    });
  });
});
