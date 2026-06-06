import * as crypto from 'crypto';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { JobsService } from './platform/jobs/jobs.service';
import { PrismaService } from './infrastructure/database/prisma.service';
import { JobType } from '@alliance-risk/shared';

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
  dryRun?: boolean;
  assessmentId?: string;
}

interface WorkerAdminActionResult {
  success: boolean;
  error?: string;
}

type ReprocessDocxAction = 'requeued' | 'skipped' | 'dry-run-matched';

interface ReprocessDocxResultRow {
  id: string;
  fileName: string;
  action: ReprocessDocxAction;
}

const DOCX_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
];

const DOCX_REPROCESS_ERROR_PATTERNS = [
  'mammoth',
  'turndown',
  'timeout',
  "Cannot find module 'mammoth'",
  "Cannot find module 'turndown'",
];

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function isWorkerAdminAuthorized(event: WorkerEvent, logger: Logger): boolean {
  const expectedToken = process.env.WORKER_ADMIN_TOKEN;
  if (!expectedToken || !event.authToken) {
    logger.error(`Unauthorized ${event.action ?? 'worker'} attempt`);
    return false;
  }

  // SECURITY: Use timingSafeEqual with SHA-256 hashes to prevent timing attacks
  // Hashing first ensures both buffers are the same length, preventing TypeErrors from timingSafeEqual
  const expectedHash = crypto.createHash('sha256').update(expectedToken).digest();
  const providedHash = crypto.createHash('sha256').update(event.authToken).digest();

  if (!crypto.timingSafeEqual(expectedHash, providedHash)) {
    logger.error(`Unauthorized ${event.action ?? 'worker'} attempt`);
    return false;
  }

  return true;
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
  if (!isWorkerAdminAuthorized(event, logger)) {
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

async function handleReprocessFailedDocx(
  event: WorkerEvent,
  logger: Logger,
): Promise<WorkerAdminActionResult & { matched?: number; requeued?: number; results?: ReprocessDocxResultRow[] }> {
  if (!isWorkerAdminAuthorized(event, logger)) {
    return { success: false, error: 'Unauthorized' };
  }

  const app = await bootstrap();
  const prisma = app.get(PrismaService);
  const jobsService = app.get(JobsService);

  const documents = await prisma.assessmentDocument.findMany({
    where: {
      status: 'FAILED',
      ...(event.assessmentId ? { assessmentId: event.assessmentId } : {}),
      mimeType: { in: DOCX_MIME_TYPES },
      OR: [
        { errorMessage: null },
        ...DOCX_REPROCESS_ERROR_PATTERNS.map((pattern) => ({
          errorMessage: { contains: pattern, mode: 'insensitive' as const },
        })),
      ],
    },
    include: {
      assessment: {
        select: {
          userId: true,
        },
      },
    },
    orderBy: { uploadedAt: 'asc' },
  });

  const results: ReprocessDocxResultRow[] = [];

  if (event.dryRun) {
    logger.log(`DOCX reprocess dry run matched ${documents.length} failed document(s)`);
    for (const document of documents) {
      results.push({
        id: document.id,
        fileName: document.fileName,
        action: 'dry-run-matched',
      });
    }

    return {
      success: true,
      matched: documents.length,
      requeued: 0,
      results,
    };
  }

  let requeued = 0;

  for (const document of documents) {
    const currentDocument = await prisma.assessmentDocument.findUnique({
      where: { id: document.id },
      include: {
        assessment: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!currentDocument || currentDocument.status !== 'FAILED') {
      results.push({
        id: document.id,
        fileName: document.fileName,
        action: 'skipped',
      });
      continue;
    }

    logger.log(
      `Reprocessing DOCX document ${currentDocument.id}; previous error: ${currentDocument.errorMessage ?? 'null'}`,
    );

    const jobId = await jobsService.create(
      JobType.PARSE_DOCUMENT,
      {
        assessmentId: currentDocument.assessmentId,
        documentId: currentDocument.id,
        s3Key: currentDocument.s3Key,
        mimeType: currentDocument.mimeType,
        fileName: currentDocument.fileName,
      },
      currentDocument.assessment.userId,
    );

    await prisma.assessmentDocument.update({
      where: { id: currentDocument.id },
      data: {
        status: 'UPLOADED',
        parseJobId: jobId,
        errorMessage: null,
      },
    });

    results.push({
      id: currentDocument.id,
      fileName: currentDocument.fileName,
      action: 'requeued',
    });
    requeued++;
  }

  logger.log(`DOCX reprocess queued ${requeued} document(s)`);

  return {
    success: true,
    matched: documents.length,
    requeued,
    results,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const handler = async (event: WorkerEvent, context: any) => {
  context.callbackWaitsForEmptyEventLoop = false;
  const logger = new Logger('WorkerHandler');

  if (event.action === 'run-sql') {
    return handleRunSql(event, logger);
  }

  if (event.action === 'reprocess-failed-docx') {
    return handleReprocessFailedDocx(event, logger);
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
