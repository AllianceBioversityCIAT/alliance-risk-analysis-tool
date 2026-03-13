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

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function handleParameterizedSql(
  prisma: PrismaService,
  sql: string,
  params: unknown[],
  logger: Logger,
): Promise<{ success: boolean; executed: number; error?: string; statement?: string }> {
  try {
    await prisma.$executeRawUnsafe(sql, ...params);
    logger.log('Parameterized SQL complete');
    return { success: true, executed: 1 };
  } catch (err: unknown) {
    const msg = getErrorMessage(err);
    logger.error(`Parameterized SQL failed: ${msg}`);
    return { success: false, executed: 0, error: msg, statement: sql.substring(0, 200) };
  }
}

async function handleBatchSql(
  prisma: PrismaService,
  sql: string,
  logger: Logger,
): Promise<{ success: boolean; executed: number; error?: string; statement?: string }> {
  const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
  let executed = 0;
  for (const stmt of statements) {
    try {
      await prisma.$executeRawUnsafe(stmt);
      executed++;
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      logger.error(`SQL statement ${executed + 1} failed: ${msg}`);
      return { success: false, executed, error: msg, statement: stmt.substring(0, 200) };
    }
  }
  logger.log(`SQL complete: ${executed} statements`);
  return { success: true, executed };
}

async function handleRunSql(
  event: WorkerEvent,
  logger: Logger,
): Promise<{ success: boolean; executed?: number; error?: string; statement?: string }> {
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params = (event as any).params;
  if (params && Array.isArray(params)) {
    return handleParameterizedSql(prisma, event.sql, params, logger);
  }

  return handleBatchSql(prisma, event.sql, logger);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const handler = async (event: WorkerEvent, context: any) => {
  context.callbackWaitsForEmptyEventLoop = false;
  const logger = new Logger('WorkerHandler');

  if (event.action === 'run-sql') {
    return handleRunSql(event, logger);
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
