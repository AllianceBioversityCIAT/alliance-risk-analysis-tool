import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { JobsService } from './platform/jobs/jobs.service';
import { PrismaService } from './infrastructure/database/prisma.service';

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
  action?: string;
  authToken?: string;
  sql?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const handler = async (event: WorkerEvent, context: any) => {
  context.callbackWaitsForEmptyEventLoop = false;
  const logger = new Logger('WorkerHandler');

  // Admin: run raw SQL (for migrations/seeding from outside VPC)
  // Requires WORKER_ADMIN_TOKEN authentication
  if (event.action === 'run-sql') {
    const expectedToken = process.env.WORKER_ADMIN_TOKEN;
    if (!expectedToken || event.authToken !== expectedToken) {
      logger.error('Unauthorized run-sql attempt');
      return { success: false, error: 'Unauthorized' };
    }

    if (!event.sql) {
      return { success: false, error: 'Missing sql payload' };
    }

    logger.log('Running authenticated SQL...');
    const app = await bootstrap();
    const prisma = app.get(PrismaService);
    const statements = event.sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
    let executed = 0;
    for (const stmt of statements) {
      try {
        await prisma.$executeRawUnsafe(stmt);
        executed++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`SQL statement ${executed + 1} failed: ${msg}`);
        return { success: false, executed, error: msg, statement: stmt.substring(0, 200) };
      }
    }
    logger.log(`SQL complete: ${executed} statements`);
    return { success: true, executed };
  }

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
