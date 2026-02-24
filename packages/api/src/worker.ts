import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { JobsService } from './jobs/jobs.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedApp: any;

async function bootstrap() {
  if (cachedApp) return cachedApp;
  cachedApp = await NestFactory.createApplicationContext(AppModule);
  return cachedApp;
}

export const handler = async (event: { jobId: string }) => {
  const logger = new Logger('WorkerHandler');
  logger.log(`Processing job: ${event.jobId}`);

  const app = await bootstrap();
  const jobsService = app.get(JobsService);
  await jobsService.processJob(event.jobId);

  logger.log(`Job ${event.jobId} processed`);
  return { success: true, jobId: event.jobId };
};
