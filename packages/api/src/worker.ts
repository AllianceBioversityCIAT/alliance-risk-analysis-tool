import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { JobsService } from './platform/jobs/jobs.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedApp: any;

async function bootstrap() {
  if (cachedApp) return cachedApp;
  cachedApp = await NestFactory.createApplicationContext(AppModule);
  return cachedApp;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface WorkerEvent {
  jobId?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const handler = async (event: WorkerEvent, context: any) => {
  context.callbackWaitsForEmptyEventLoop = false;
  const logger = new Logger('WorkerHandler');

  // Security: run-sql action was removed — it allowed unauthenticated arbitrary SQL execution.
  // Use proper CI/CD migration tools (pnpm migrate:remote) instead.

  if (!event.jobId || !UUID_REGEX.test(event.jobId)) {
    logger.error(`Invalid jobId format: ${event.jobId}`);
    return { success: false, error: 'Invalid jobId format' };
  }

  logger.log(`Processing job: ${event.jobId}`);

  const app = await bootstrap();
  const jobsService = app.get(JobsService);
  await jobsService.processJob(event.jobId);

  logger.log(`Job ${event.jobId} processed`);
  return { success: true, jobId: event.jobId };
};
