import { JobType } from '@alliance-risk/shared';

const mockCreateApplicationContext = jest.fn();

jest.mock('@nestjs/core', () => ({
  NestFactory: {
    createApplicationContext: (...args: unknown[]) => mockCreateApplicationContext(...args),
  },
}));

jest.mock('./app.module', () => ({
  AppModule: class MockAppModule {},
}));

import { handler } from './worker';
import { JobsService } from './platform/jobs/jobs.service';
import { PrismaService } from './infrastructure/database/prisma.service';

describe('worker reprocess-failed-docx action', () => {
  const findManyMock = jest.fn();
  const findUniqueMock = jest.fn();
  const updateMock = jest.fn();
  const createJobMock = jest.fn();

  const mockJobsService = {
    create: createJobMock,
  } as unknown as JobsService;

  const mockPrisma = {
    assessmentDocument: {
      findMany: findManyMock,
      findUnique: findUniqueMock,
      update: updateMock,
    },
  } as unknown as PrismaService;

  const mockApp = {
    get: jest.fn((token: unknown) => {
      if (token === PrismaService) return mockPrisma;
      if (token === JobsService) return mockJobsService;
      throw new Error(`Unknown provider: ${String(token)}`);
    }),
  };

  const context = { callbackWaitsForEmptyEventLoop: true };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.WORKER_ADMIN_TOKEN = 'secret-token';
    mockCreateApplicationContext.mockResolvedValue(mockApp);
  });

  it('dry-run mode does not create parse jobs and returns matched rows only for word documents', async () => {
    findManyMock.mockResolvedValue([
      {
        id: 'doc-1',
        assessmentId: 'assess-1',
        fileName: 'needs-reprocess.docx',
        s3Key: 'docs/doc-1',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        status: 'FAILED',
        errorMessage: 'mammoth exploded',
        assessment: { userId: 'user-1' },
      },
    ] as never);

    const result = await handler(
      { action: 'reprocess-failed-docx', authToken: 'secret-token', dryRun: true },
      context,
    );

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'FAILED',
          mimeType: {
            in: [
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'application/msword',
            ],
          },
        }),
      }),
    );
    expect(createJobMock).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        matched: 1,
        requeued: 0,
        results: [
          {
            id: 'doc-1',
            fileName: 'needs-reprocess.docx',
            action: 'dry-run-matched',
          },
        ],
      }),
    );
  });

  it('skips rows that are no longer FAILED at re-check time', async () => {
    findManyMock.mockResolvedValue([
      {
        id: 'doc-2',
        assessmentId: 'assess-2',
        fileName: 'already-parsing.docx',
        s3Key: 'docs/doc-2',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        status: 'FAILED',
        errorMessage: 'timeout while extracting',
        assessment: { userId: 'user-2' },
      },
    ] as never);
    findUniqueMock.mockResolvedValue({
      id: 'doc-2',
      assessmentId: 'assess-2',
      fileName: 'already-parsing.docx',
      s3Key: 'docs/doc-2',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      status: 'PARSING',
      errorMessage: 'timeout while extracting',
      assessment: { userId: 'user-2' },
    } as never);

    const result = await handler(
      { action: 'reprocess-failed-docx', authToken: 'secret-token' },
      context,
    );

    expect(createJobMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        matched: 1,
        requeued: 0,
        results: [
          {
            id: 'doc-2',
            fileName: 'already-parsing.docx',
            action: 'skipped',
          },
        ],
      }),
    );
  });

  it('requeues matching failed word documents and supports assessment filtering', async () => {
    findManyMock.mockResolvedValue([
      {
        id: 'doc-3',
        assessmentId: 'assess-3',
        fileName: 'legacy.doc',
        s3Key: 'docs/doc-3',
        mimeType: 'application/msword',
        status: 'FAILED',
        errorMessage: null,
        assessment: { userId: 'user-3' },
      },
    ] as never);
    findUniqueMock.mockResolvedValue({
      id: 'doc-3',
      assessmentId: 'assess-3',
      fileName: 'legacy.doc',
      s3Key: 'docs/doc-3',
      mimeType: 'application/msword',
      status: 'FAILED',
      errorMessage: null,
      assessment: { userId: 'user-3' },
    } as never);
    createJobMock.mockResolvedValue('job-123');

    const result = await handler(
      {
        action: 'reprocess-failed-docx',
        authToken: 'secret-token',
        assessmentId: 'assess-3',
      },
      context,
    );

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          assessmentId: 'assess-3',
        }),
      }),
    );
    expect(createJobMock).toHaveBeenCalledWith(
      JobType.PARSE_DOCUMENT,
      {
        assessmentId: 'assess-3',
        documentId: 'doc-3',
        s3Key: 'docs/doc-3',
        mimeType: 'application/msword',
        fileName: 'legacy.doc',
      },
      'user-3',
    );
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 'doc-3' },
      data: {
        status: 'UPLOADED',
        parseJobId: 'job-123',
        errorMessage: null,
      },
    });
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        matched: 1,
        requeued: 1,
        results: [
          {
            id: 'doc-3',
            fileName: 'legacy.doc',
            action: 'requeued',
          },
        ],
      }),
    );
  });
});
