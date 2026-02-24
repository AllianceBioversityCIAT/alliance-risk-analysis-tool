import { Test } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import type { UserInfo } from '@alliance-risk/shared';
import { JobStatus, JobType } from '@alliance-risk/shared';

const mockJobsService = {
  findOne: jest.fn(),
};

function makeJob(overrides = {}) {
  return {
    id: 'job-uuid-1',
    type: JobType.AI_PREVIEW,
    status: 'COMPLETED',
    input: {},
    result: { output: 'preview', tokensUsed: 10, processingTime: 200 },
    error: null,
    attempts: 1,
    maxAttempts: 3,
    createdById: 'user-1',
    createdAt: new Date(),
    startedAt: new Date(),
    completedAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const mockUser: UserInfo = {
  userId: 'user-1',
  email: 'user@example.com',
  username: 'user1',
  role: 'analyst',
  isAdmin: false,
};

describe('JobsController', () => {
  let controller: JobsController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      controllers: [JobsController],
      providers: [{ provide: JobsService, useValue: mockJobsService }],
    }).compile();

    controller = module.get(JobsController);
  });

  describe('findOne()', () => {
    it('returns the job when it exists and user owns it', async () => {
      const job = makeJob();
      mockJobsService.findOne.mockResolvedValue(job);

      const result = await controller.findOne('job-uuid-1', mockUser);

      expect(mockJobsService.findOne).toHaveBeenCalledWith('job-uuid-1', 'user-1');
      expect(result).toEqual(job);
    });

    it('returns a PROCESSING job with null result', async () => {
      const job = makeJob({ status: JobStatus.PROCESSING, result: null, completedAt: null });
      mockJobsService.findOne.mockResolvedValue(job);

      const result = await controller.findOne('job-uuid-1', mockUser);

      expect(result.status).toBe(JobStatus.PROCESSING);
      expect(result.result).toBeNull();
    });

    it('throws NotFoundException for non-existent job', async () => {
      mockJobsService.findOne.mockRejectedValue(new NotFoundException('Job not found'));

      await expect(controller.findOne('non-existent', mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when user does not own the job', async () => {
      mockJobsService.findOne.mockRejectedValue(
        new ForbiddenException('You do not own this job'),
      );

      const otherUser: UserInfo = { ...mockUser, userId: 'other-user', username: 'other' };
      await expect(controller.findOne('job-uuid-1', otherUser)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
