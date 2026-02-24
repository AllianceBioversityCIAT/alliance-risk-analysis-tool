import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { AiPreviewHandler } from './handlers/ai-preview.handler';
import { ParseDocumentHandler } from './handlers/parse-document.handler';
import { GapDetectionHandler } from './handlers/gap-detection.handler';
import { RiskAnalysisHandler } from './handlers/risk-analysis.handler';
import { ReportGenerationHandler } from './handlers/report-generation.handler';
import { PrismaService } from '../database/prisma.service';
import { JobStatus, JobType } from '@alliance-risk/shared';

// Mock LambdaClient to avoid AWS calls
jest.mock('@aws-sdk/client-lambda', () => ({
  LambdaClient: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({}),
  })),
  InvokeCommand: jest.fn(),
}));

const mockPrisma = {
  job: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

const mockAiPreviewHandler = {
  execute: jest.fn(),
};

const mockStubHandler = { execute: jest.fn() };

const mockConfigService = {
  get: jest.fn((key: string) => {
    const config: Record<string, string> = {
      ENVIRONMENT: 'test',
      AWS_REGION: 'us-east-1',
    };
    return config[key];
  }),
};

function makeJob(overrides = {}) {
  return {
    id: 'job-uuid-1',
    type: JobType.AI_PREVIEW,
    status: 'PENDING',
    input: { systemPrompt: 'You are an expert', userPromptTemplate: 'Analyze {{cat}}' },
    result: null,
    error: null,
    attempts: 0,
    maxAttempts: 3,
    createdById: 'user-1',
    createdAt: new Date(),
    startedAt: null,
    completedAt: null,
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('JobsService', () => {
  let service: JobsService;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        JobsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: AiPreviewHandler, useValue: mockAiPreviewHandler },
        { provide: ParseDocumentHandler, useValue: mockStubHandler },
        { provide: GapDetectionHandler, useValue: mockStubHandler },
        { provide: RiskAnalysisHandler, useValue: mockStubHandler },
        { provide: ReportGenerationHandler, useValue: mockStubHandler },
      ],
    }).compile();

    service = module.get(JobsService);
  });

  describe('create()', () => {
    it('creates a job record and returns its ID', async () => {
      const job = makeJob();
      mockPrisma.job.create.mockResolvedValue(job);
      mockPrisma.job.findUnique.mockResolvedValue({ ...job, attempts: 1 });
      mockPrisma.job.update.mockResolvedValue(job);
      mockAiPreviewHandler.execute.mockResolvedValue({ output: 'ok', tokensUsed: 10, processingTime: 100 });

      const result = await service.create(JobType.AI_PREVIEW, { systemPrompt: 'test', userPromptTemplate: 'test' }, 'user-1');

      expect(mockPrisma.job.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: JobType.AI_PREVIEW,
            createdById: 'user-1',
            status: 'PENDING',
          }),
        }),
      );
      expect(result).toBe(job.id);
    });

    it('executes locally when ENVIRONMENT is test', async () => {
      const job = makeJob();
      mockPrisma.job.create.mockResolvedValueOnce(job);
      // processJob calls findUnique (once to get job) + once to check attempts after processing
      mockPrisma.job.findUnique
        .mockResolvedValueOnce(job)
        .mockResolvedValueOnce({ ...job, attempts: 1 });
      mockPrisma.job.update.mockResolvedValue({});
      mockAiPreviewHandler.execute.mockResolvedValueOnce({ output: 'ok', tokensUsed: 5, processingTime: 50 });

      await service.create(JobType.AI_PREVIEW, {}, 'user-1');

      // Allow local execution to complete
      await new Promise((r) => setTimeout(r, 20));

      expect(mockAiPreviewHandler.execute).toHaveBeenCalled();
    });

    it('executes locally when ENVIRONMENT is development', async () => {
      mockConfigService.get.mockImplementation((key: string): string => {
        if (key === 'ENVIRONMENT') return 'development';
        return 'us-east-1';
      });

      const job = makeJob();
      mockPrisma.job.create.mockResolvedValueOnce(job);
      mockPrisma.job.findUnique
        .mockResolvedValueOnce(job)
        .mockResolvedValueOnce({ ...job, attempts: 1 });
      mockPrisma.job.update.mockResolvedValue({});
      mockAiPreviewHandler.execute.mockResolvedValueOnce({ output: 'ok', tokensUsed: 5, processingTime: 50 });

      await service.create(JobType.AI_PREVIEW, {}, 'user-1');
      await new Promise((r) => setTimeout(r, 20));

      expect(mockAiPreviewHandler.execute).toHaveBeenCalled();
    });
  });

  describe('findOne()', () => {
    it('returns the job when ownership matches', async () => {
      const job = makeJob();
      mockPrisma.job.findUnique.mockResolvedValue(job);

      const result = await service.findOne(job.id, 'user-1');

      expect(result).toEqual(job);
    });

    it('throws NotFoundException when job does not exist', async () => {
      mockPrisma.job.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when user does not own the job', async () => {
      const job = makeJob({ createdById: 'user-1' });
      mockPrisma.job.findUnique.mockResolvedValue(job);

      await expect(service.findOne(job.id, 'other-user')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('updateStatus()', () => {
    it('updates status to PROCESSING with startedAt', async () => {
      mockPrisma.job.update.mockResolvedValue({});

      await service.updateStatus('job-1', JobStatus.PROCESSING);

      expect(mockPrisma.job.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'job-1' },
          data: expect.objectContaining({
            status: 'PROCESSING',
            startedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('updates status to COMPLETED with result and completedAt', async () => {
      mockPrisma.job.update.mockResolvedValue({});
      const result = { output: 'text', tokensUsed: 100, processingTime: 500 };

      await service.updateStatus('job-1', JobStatus.COMPLETED, result);

      expect(mockPrisma.job.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'COMPLETED',
            result,
            completedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('updates status to FAILED with error message', async () => {
      mockPrisma.job.update.mockResolvedValue({});

      await service.updateStatus('job-1', JobStatus.FAILED, undefined, 'Timeout');

      expect(mockPrisma.job.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'FAILED',
            error: 'Timeout',
          }),
        }),
      );
    });
  });

  describe('processJob()', () => {
    it('processes an AI_PREVIEW job to COMPLETED', async () => {
      const job = makeJob({ type: JobType.AI_PREVIEW, attempts: 0 });
      mockPrisma.job.findUnique
        .mockResolvedValueOnce(job)              // first findUnique in processJob
        .mockResolvedValueOnce({ ...job, attempts: 1 }); // after increment
      mockPrisma.job.update.mockResolvedValue({});
      mockAiPreviewHandler.execute.mockResolvedValue({
        output: 'Preview result',
        tokensUsed: 20,
        processingTime: 300,
      });

      await service.processJob(job.id);

      // Should have called update with PROCESSING, then COMPLETED
      const updateCalls = mockPrisma.job.update.mock.calls;
      const statusCalls = updateCalls.filter(
        (call) => call[0]?.data?.status !== undefined,
      );
      expect(statusCalls[statusCalls.length - 1][0].data.status).toBe('COMPLETED');
    });

    it('marks job as FAILED after max attempts reached', async () => {
      const job = makeJob({ type: JobType.AI_PREVIEW, attempts: 2 });
      // processJob: first findUnique = initial job fetch
      // second findUnique = check attempts after failure
      mockPrisma.job.findUnique
        .mockResolvedValueOnce(job)
        .mockResolvedValueOnce({ ...job, attempts: 3, maxAttempts: 3 }); // at max
      mockPrisma.job.update.mockResolvedValue({});
      mockAiPreviewHandler.execute.mockRejectedValue(new Error('Bedrock error'));

      await service.processJob(job.id);

      // updateStatus(FAILED) should have been called
      const updateCalls: Array<[{ where: unknown; data: { status?: string; error?: string } }]> = mockPrisma.job.update.mock.calls;
      const failedCall = updateCalls.find((call) => call[0]?.data?.status === 'FAILED');
      expect(failedCall).toBeDefined();
      expect(failedCall![0].data.error).toBe('Bedrock error');
    });

    it('resets job to PENDING when attempts < maxAttempts', async () => {
      const job = makeJob({ type: JobType.AI_PREVIEW });
      mockPrisma.job.findUnique
        .mockResolvedValueOnce(job)
        .mockResolvedValueOnce({ ...job, attempts: 1, maxAttempts: 3 }); // below max
      mockPrisma.job.update.mockResolvedValue({});
      mockAiPreviewHandler.execute.mockRejectedValue(new Error('Transient error'));

      await service.processJob(job.id);

      const updateCalls = mockPrisma.job.update.mock.calls;
      const pendingCall = updateCalls.find((call) => call[0]?.data?.status === 'PENDING');
      expect(pendingCall).toBeDefined();
    });

    it('does nothing when job is not found', async () => {
      mockPrisma.job.findUnique.mockResolvedValueOnce(null);
      mockPrisma.job.update.mockResolvedValue({});

      // Should not throw
      await expect(service.processJob('non-existent')).resolves.toBeUndefined();
      // Service returns early — handler is never invoked
      expect(mockAiPreviewHandler.execute).not.toHaveBeenCalled();
    });

    it('throws error for unknown job type', async () => {
      const job = makeJob({ type: 'UNKNOWN_TYPE' });
      mockPrisma.job.findUnique
        .mockResolvedValueOnce(job)
        .mockResolvedValueOnce({ ...job, attempts: 3, maxAttempts: 3 });
      mockPrisma.job.update.mockResolvedValue({});

      await service.processJob(job.id);

      // Should end up as FAILED
      const updateCalls = mockPrisma.job.update.mock.calls;
      const failedCall = updateCalls.find((call) => call[0]?.data?.status === 'FAILED');
      expect(failedCall).toBeDefined();
    });
  });
});
