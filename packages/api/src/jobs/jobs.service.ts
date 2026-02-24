import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import { JobStatus, JobType } from '@alliance-risk/shared';
import { PrismaService } from '../database/prisma.service';
import { AiPreviewHandler } from './handlers/ai-preview.handler';
import type { Job } from '@prisma/client';

type JobStatusPrisma = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);
  private readonly lambdaClient: LambdaClient;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly aiPreviewHandler: AiPreviewHandler,
  ) {
    this.lambdaClient = new LambdaClient({
      region: this.configService.get<string>('AWS_REGION') ?? 'us-east-1',
    });
  }

  /**
   * Create a new job, invoke Worker Lambda (or run locally in dev).
   * Returns the job ID immediately.
   */
  async create(
    type: JobType,
    input: unknown,
    userId: string,
  ): Promise<string> {
    const job = await this.prisma.job.create({
      data: {
        type: type as unknown as import('@prisma/client').$Enums.JobType,
        input: input as object,
        status: 'PENDING' as JobStatusPrisma,
        createdById: userId,
      },
    });

    this.logger.log(`Created job ${job.id} (type=${type})`);

    const environment = this.configService.get<string>('ENVIRONMENT') ?? 'development';

    if (environment === 'development' || environment === 'test') {
      // Run in-process without invoking a real Lambda
      this.executeLocally(job.id).catch((err: Error) =>
        this.logger.error(`Local job execution failed: ${err.message}`, err.stack),
      );
    } else {
      const workerFunctionName = this.configService.get<string>('WORKER_FUNCTION_NAME');
      if (workerFunctionName) {
        await this.lambdaClient.send(
          new InvokeCommand({
            FunctionName: workerFunctionName,
            InvocationType: 'Event',
            Payload: Buffer.from(JSON.stringify({ jobId: job.id })),
          }),
        );
      } else {
        this.logger.warn('WORKER_FUNCTION_NAME not configured; falling back to local execution');
        this.executeLocally(job.id).catch((err: Error) =>
          this.logger.error(`Fallback local execution failed: ${err.message}`, err.stack),
        );
      }
    }

    return job.id;
  }

  /**
   * Poll job status. Validates ownership.
   */
  async findOne(id: string, userId: string): Promise<Job> {
    const job = await this.prisma.job.findUnique({ where: { id } });

    if (!job) {
      throw new NotFoundException(`Job ${id} not found`);
    }

    if (job.createdById !== userId) {
      throw new ForbiddenException('You do not own this job');
    }

    return job;
  }

  /**
   * Update job status (called by worker).
   */
  async updateStatus(
    id: string,
    status: JobStatus,
    result?: unknown,
    error?: string,
  ): Promise<void> {
    await this.prisma.job.update({
      where: { id },
      data: {
        status: status as JobStatusPrisma,
        result: result !== undefined ? (result as object) : undefined,
        error: error ?? null,
        startedAt: status === JobStatus.PROCESSING ? new Date() : undefined,
        completedAt:
          status === JobStatus.COMPLETED || status === JobStatus.FAILED
            ? new Date()
            : undefined,
      },
    });
  }

  /**
   * Route to appropriate handler and manage full status lifecycle.
   */
  async processJob(jobId: string): Promise<void> {
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
      this.logger.error(`Job ${jobId} not found for processing`);
      return;
    }

    await this.updateStatus(jobId, JobStatus.PROCESSING);
    await this.prisma.job.update({
      where: { id: jobId },
      data: { attempts: { increment: 1 } },
    });

    try {
      let result: unknown;

      if (job.type === JobType.AI_PREVIEW) {
        result = await this.aiPreviewHandler.execute(job.input as unknown as Parameters<AiPreviewHandler['execute']>[0]);
      } else {
        throw new Error(`No handler registered for job type: ${job.type}`);
      }

      await this.updateStatus(jobId, JobStatus.COMPLETED, result);
      this.logger.log(`Job ${jobId} completed`);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Job ${jobId} failed: ${errorMsg}`);

      // Check if max attempts reached
      const updatedJob = await this.prisma.job.findUnique({ where: { id: jobId } });
      const maxAttempts = updatedJob?.maxAttempts ?? 3;
      const attempts = updatedJob?.attempts ?? 1;

      if (attempts >= maxAttempts) {
        await this.updateStatus(jobId, JobStatus.FAILED, undefined, errorMsg);
      } else {
        // Reset to PENDING for retry
        await this.updateStatus(jobId, JobStatus.PENDING);
      }
    }
  }

  /**
   * In-process execution for local development.
   */
  async executeLocally(jobId: string): Promise<void> {
    this.logger.log(`Executing job ${jobId} locally`);
    await this.processJob(jobId);
  }
}
