import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { AssessmentsService } from './assessments.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { JobsService } from '../../platform/jobs/jobs.service';
import { IntakeMode, ALLOWED_DOCUMENT_MIME_TYPES } from '@alliance-risk/shared';

const mockAssessment = {
  id: 'assess-1',
  name: 'Test Assessment',
  companyName: 'Test Co',
  companyType: null,
  country: 'Kenya',
  status: 'DRAFT',
  intakeMode: 'UPLOAD',
  progress: 0,
  overallRiskScore: null,
  overallRiskLevel: null,
  userId: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockDocument = {
  id: 'doc-1',
  assessmentId: 'assess-1',
  fileName: 'plan.pdf',
  s3Key: 'assessments/assess-1/documents/doc-1/plan.pdf',
  mimeType: 'application/pdf',
  fileSize: 1024,
  status: 'PENDING_UPLOAD',
  parseJobId: null,
  errorMessage: null,
  uploadedAt: new Date(),
};

// A transaction-scoped client, distinct from mockPrisma, so a delete issued
// through $transaction's callback is observably different from one that
// bypasses it — mirroring prompts.service.spec.ts:13-26's mockTx/mockPrisma
// split (the repo's established form-agnostic $transaction convention).
const mockTx = {
  assessmentDocument: { delete: jest.fn() },
  job: { delete: jest.fn() },
};

const mockPrisma = {
  assessment: {
    create: jest.fn().mockResolvedValue(mockAssessment),
    findMany: jest.fn().mockResolvedValue([mockAssessment]),
    findUnique: jest.fn().mockResolvedValue(mockAssessment),
    update: jest.fn().mockResolvedValue(mockAssessment),
    delete: jest.fn().mockResolvedValue(mockAssessment),
    count: jest.fn().mockResolvedValue(1),
  },
  assessmentDocument: {
    create: jest.fn().mockResolvedValue(mockDocument),
    update: jest.fn().mockResolvedValue(mockDocument),
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(mockDocument),
    delete: jest.fn().mockResolvedValue(mockDocument),
  },
  assessmentComment: {
    create: jest.fn().mockResolvedValue({ id: 'comment-1', content: 'Test' }),
    findMany: jest.fn().mockResolvedValue([]),
  },
  // Not yet consulted/called by production code for these paths (that is
  // exactly what T-002 proves red) — added so T-004 (deleteDocument cleanup,
  // design.md §7.2) and T-005 (getMergedContent withholding, §7.3) can turn
  // these same tests green without touching this spec file again. The
  // $transaction mock below is form-agnostic (see its own comment), so T-004
  // is free to pick either shape without another edit here.
  job: {
    findFirst: jest.fn(),
    delete: jest.fn(),
    // T-009: backs `isAnalysisInFlight`'s two non-terminal-job checks
    // (PARSE_DOCUMENT among current documents, GAP_DETECTION for the
    // assessment). Defaults to 0 so every pre-existing test — none of which
    // anticipates this call — resolves analysisInFlight to `false` without
    // needing its own setup.
    count: jest.fn().mockResolvedValue(0),
  },
  // Exists only to prove BR-DDP-003: getMergedContent() (T-005) is a pure
  // read of a stored snapshot and must never touch an Analyst's own
  // gap-field corrections. Not consulted by any production path this spec
  // adds or changes.
  gapField: {
    deleteMany: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn(),
  },
  // Form-agnostic like prompts.service.spec.ts:46 — supports both the
  // interactive callback form `$transaction(fn)` (7 of 9 $transaction call
  // sites in this repo: prompts.service.ts:34,164,250,266,300,367,
  // comments.service.ts:35) and the array form `$transaction([...])` (2
  // sites, e.g. gap-detection.handler.ts:491). design.md §7.2 mandates one
  // transaction but not a shape, so T-004 must be free to choose either —
  // this mock must not silently favour one. The callback receives `mockTx`,
  // a client distinct from `mockPrisma`, so a delete issued through the
  // transaction is observably different from one that escaped it.
  $transaction: jest.fn((arg: any) =>
    typeof arg === 'function' ? arg(mockTx) : Promise.all(arg),
  ),
};

const mockStorage = {
  buildDocumentKey: jest.fn().mockReturnValue('assessments/assess-1/documents/doc-1/plan.pdf'),
  generatePresignedUploadUrl: jest.fn().mockResolvedValue('https://s3.example.com/upload'),
  deleteObject: jest.fn().mockResolvedValue(undefined),
};

const mockJobs = {
  create: jest.fn().mockResolvedValue('job-1'),
};

describe('AssessmentsService', () => {
  let service: AssessmentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssessmentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StorageService, useValue: mockStorage },
        { provide: JobsService, useValue: mockJobs },
      ],
    }).compile();

    service = module.get<AssessmentsService>(AssessmentsService);
    jest.clearAllMocks();
    mockPrisma.assessment.findUnique.mockResolvedValue(mockAssessment);
  });

  describe('create', () => {
    it('should create an assessment', async () => {
      mockPrisma.assessment.create.mockResolvedValue(mockAssessment);
      const result = await service.create(
        { name: 'Test', companyName: 'Test Co', intakeMode: IntakeMode.UPLOAD },
        'user-1',
      );
      expect(result).toEqual(mockAssessment);
    });
  });

  describe('findOne', () => {
    it('should return assessment when user owns it', async () => {
      const result = await service.findOne('assess-1', 'user-1');
      expect(result).toEqual(mockAssessment);
    });

    it('should throw NotFoundException when not found', async () => {
      mockPrisma.assessment.findUnique.mockResolvedValue(null);
      await expect(service.findOne('bad-id', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user does not own assessment', async () => {
      await expect(service.findOne('assess-1', 'other-user')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findAll', () => {
    it('should filter by country when query param is present', async () => {
      await service.findAll('user-1', { country: 'Nigeria', limit: 10 });
      expect(mockPrisma.assessment.count).toHaveBeenCalledWith({
        where: expect.objectContaining({ userId: 'user-1', country: 'Nigeria' }),
      });
      expect(mockPrisma.assessment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-1', country: 'Nigeria' }),
        }),
      );
    });
  });

  describe('getStats', () => {
    it('should return stats for user', async () => {
      mockPrisma.assessment.count.mockResolvedValue(1);
      const result = await service.getStats('user-1');
      expect(result).toHaveProperty('active');
      expect(result).toHaveProperty('drafts');
      expect(result).toHaveProperty('completed');
      expect(result).toHaveProperty('total');
    });

    it('should filter stats by country when provided', async () => {
      mockPrisma.assessment.count.mockResolvedValue(1);
      await service.getStats('user-1', 'Ethiopia');
      expect(mockPrisma.assessment.count).toHaveBeenCalledWith({
        where: { userId: 'user-1', country: 'Ethiopia', status: 'ANALYZING' },
      });
    });
  });

  describe('update', () => {
    it('should allow country update when assessment is DRAFT', async () => {
      await service.update('assess-1', { country: 'Zambia' }, 'user-1');
      expect(mockPrisma.assessment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ country: 'Zambia' }),
        }),
      );
    });

    it('should reject country update when assessment is not DRAFT', async () => {
      mockPrisma.assessment.findUnique.mockResolvedValue({
        ...mockAssessment,
        status: 'ANALYZING',
      });
      await expect(
        service.update('assess-1', { country: 'Zambia' }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('requestUploadUrl', () => {
    it('should create document record and return presigned URL', async () => {
      mockPrisma.assessmentDocument.create.mockResolvedValue({ id: 'doc-1', s3Key: '' });
      const result = await service.requestUploadUrl(
        'assess-1',
        { fileName: 'plan.pdf', mimeType: 'application/pdf', fileSize: 1024 },
        'user-1',
      );
      expect(result.presignedUrl).toBeTruthy();
      expect(result.documentId).toBe('doc-1');
    });

    it('should accept DOCX mime type', async () => {
      mockPrisma.assessmentDocument.create.mockResolvedValue({ id: 'doc-2', s3Key: '' });
      const result = await service.requestUploadUrl(
        'assess-1',
        {
          fileName: 'plan.docx',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          fileSize: 1024,
        },
        'user-1',
      );
      expect(result.presignedUrl).toBeTruthy();
      expect(result.documentId).toBe('doc-2');
    });

    it('should reject other unsupported mime types with the generic message', async () => {
      await expect(
        service.requestUploadUrl(
          'assess-1',
          { fileName: 'archive.rar', mimeType: 'application/x-rar', fileSize: 1024 },
          'user-1',
        ),
      ).rejects.toThrow(
        new BadRequestException(
          `Unsupported file type: application/x-rar. Allowed: ${ALLOWED_DOCUMENT_MIME_TYPES.join(', ')}`,
        ),
      );
    });

    it('should reject legacy .doc files with a targeted message', async () => {
      await expect(
        service.requestUploadUrl(
          'assess-1',
          { fileName: 'legacy.doc', mimeType: 'application/msword', fileSize: 1024 },
          'user-1',
        ),
      ).rejects.toThrow(
        new BadRequestException(
          'Legacy .doc format is not supported. Please save the document as .docx (Word 2007+) and re-upload.',
        ),
      );
    });
  });

  describe('triggerParseDocument', () => {
    beforeEach(() => {
      mockPrisma.assessmentDocument.findUnique.mockResolvedValue(mockDocument);
      mockPrisma.assessmentDocument.update.mockResolvedValue({ ...mockDocument, status: 'UPLOADED' });
      mockJobs.create.mockResolvedValue('job-1');
    });

    it('should set document status to UPLOADED before creating job', async () => {
      await service.triggerParseDocument('assess-1', 'doc-1', 'user-1');
      const firstUpdate = mockPrisma.assessmentDocument.update.mock.calls[0][0];
      expect(firstUpdate.data.status).toBe('UPLOADED');
    });

    it('should create job with assessmentId, documentId and s3Key', async () => {
      await service.triggerParseDocument('assess-1', 'doc-1', 'user-1');
      expect(mockJobs.create).toHaveBeenCalledWith(
        'PARSE_DOCUMENT',
        expect.objectContaining({
          assessmentId: 'assess-1',
          documentId: 'doc-1',
          s3Key: mockDocument.s3Key,
        }),
        'user-1',
      );
    });

    it('should link parseJobId on the document', async () => {
      await service.triggerParseDocument('assess-1', 'doc-1', 'user-1');
      const linkUpdate = mockPrisma.assessmentDocument.update.mock.calls[1][0];
      expect(linkUpdate.data.parseJobId).toBe('job-1');
    });

    it('should update assessment status to ANALYZING', async () => {
      await service.triggerParseDocument('assess-1', 'doc-1', 'user-1');
      expect(mockPrisma.assessment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'ANALYZING' }) }),
      );
    });

    it('should return the job id', async () => {
      const result = await service.triggerParseDocument('assess-1', 'doc-1', 'user-1');
      expect(result).toBe('job-1');
    });

    it('should throw NotFoundException when document does not exist', async () => {
      mockPrisma.assessmentDocument.findUnique.mockResolvedValue(null);
      await expect(
        service.triggerParseDocument('assess-1', 'bad-doc', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── T-002 RED BASELINE — FR-DDP-004 Sc 1-2 ────────────────────────────────
  //
  // Bug: deleteDocument() (assessments.service.ts:349-382) deletes only the
  // AssessmentDocument row. The PARSE_DOCUMENT job it links to via
  // `parseJobId` is never touched — every deletion leaks one permanent record
  // carrying the document's full extracted text.
  describe('deleteDocument — orphaned parse job cleanup (FR-DDP-004)', () => {
    function mockDeletableDocument(overrides: Record<string, unknown> = {}) {
      mockPrisma.assessmentDocument.findUnique.mockResolvedValue({
        ...mockDocument,
        id: 'doc-1',
        assessmentId: 'assess-1',
        status: 'PARSED',
        parseJobId: 'job-1',
        ...overrides,
      });
    }

    beforeEach(() => {
      // jest.clearAllMocks() in the outer beforeEach only clears call
      // history (mockClear semantics) — it does NOT remove an
      // implementation installed via mockImplementation/mockImplementationOnce.
      // A test in this describe block that installs one (e.g. the
      // "leaves a second document's ... job in place" test below, via
      // mockImplementation(deleteFromStore) closing over its own jobStore)
      // would otherwise leak that implementation into every later test.
      // mockReset() clears both history and implementation, and is safe on
      // every delegate here because none of them carries a baseline
      // implementation worth preserving.
      //
      // Invariant: mockPrisma.job.delete and mockTx's delegates
      // (assessmentDocument.delete, job.delete) are reset symmetrically —
      // whichever client ends up receiving the deletion (mockPrisma under
      // the array $transaction form, mockTx under the callback form) must
      // start each test with no residual implementation from a prior one.
      mockPrisma.job.delete.mockReset();
      mockTx.assessmentDocument.delete.mockReset();
      mockTx.job.delete.mockReset();
      // $transaction is the one delegate that must NOT be mockReset(): its
      // dispatch logic (function arg → invoke with mockTx, array arg →
      // Promise.all) is defined on the object literal above, not installed
      // per-test — mockReset() would wipe that literal-level implementation
      // and break every test in this file that goes through $transaction.
      // mockClear() here only drops call history, which is all this
      // describe block needs reset between tests.
      mockPrisma.$transaction.mockClear();
    });

    it("[FR-DDP-004 Sc1] deletes the document's own parse job, scoped by both id and PARSE_DOCUMENT type", async () => {
      mockDeletableDocument();

      await service.deleteDocument('assess-1', 'doc-1', 'user-1');

      // The job delete may land on mockPrisma (array form) or mockTx
      // (callback form) — neither is prescribed by design.md §7.2, so check
      // both. An unscoped deleteMany, or a delete missing the type filter,
      // must fail this assertion — today job.delete is never called at all
      // on either client, so this fails with "expected mock to have been
      // called".
      const jobDeleteCalls = [...mockPrisma.job.delete.mock.calls, ...mockTx.job.delete.mock.calls];
      expect(jobDeleteCalls).toContainEqual([{ where: { id: 'job-1', type: 'PARSE_DOCUMENT' } }]);
      expect(jobDeleteCalls).toHaveLength(1);

      // FR-DDP-004 Sc1: "both the document record and its parse job record
      // are gone" — an implementation that deletes only the job must fail
      // this too.
      const docDeleteCalls = [
        ...mockPrisma.assessmentDocument.delete.mock.calls,
        ...mockTx.assessmentDocument.delete.mock.calls,
      ];
      expect(docDeleteCalls).toContainEqual([{ where: { id: 'doc-1' } }]);

      // NFR-DDP-011 / BR-DDP-004: deletion is never a trigger for AI work —
      // no job is enqueued on the delete path.
      expect(mockJobs.create).not.toHaveBeenCalled();
    });

    it("[FR-DDP-004 Sc1] leaves a second document's parse job and an unrelated GAP_DETECTION job in place", async () => {
      // In-memory fake standing in for the two jobs that must NOT be
      // affected: job-2 belongs to a different document, job-3 is a
      // different job type entirely (same identity-per-document, but no
      // type guarantee — design.md §7.2).
      const jobStore = new Map<string, { id: string; type: string }>([
        ['job-1', { id: 'job-1', type: 'PARSE_DOCUMENT' }],
        ['job-2', { id: 'job-2', type: 'PARSE_DOCUMENT' }],
        ['job-3', { id: 'job-3', type: 'GAP_DETECTION' }],
      ]);
      const deleteFromStore = ({ where }: { where: { id: string; type?: string } }) => {
        const job = jobStore.get(where.id);
        if (job && (!where.type || job.type === where.type)) {
          jobStore.delete(where.id);
          return Promise.resolve(job);
        }
        return Promise.reject(new Error('Record to delete does not exist.'));
      };
      // Wired to both identities: the fix may issue this delete through
      // mockPrisma (array form) or mockTx (callback form).
      mockPrisma.job.delete.mockImplementation(deleteFromStore);
      mockTx.job.delete.mockImplementation(deleteFromStore);
      mockDeletableDocument();

      await service.deleteDocument('assess-1', 'doc-1', 'user-1');

      expect(jobStore.has('job-1')).toBe(false); // the target document's own job is gone
      expect(jobStore.has('job-2')).toBe(true); // a second document's job survives
      expect(jobStore.has('job-3')).toBe(true); // an unrelated GAP_DETECTION job survives
    });

    it('[FR-DDP-004 Sc2] wraps the document delete and its parse-job delete in a single Prisma transaction', async () => {
      mockDeletableDocument();

      await service.deleteDocument('assess-1', 'doc-1', 'user-1');

      // Today deleteDocument() never calls $transaction at all — the two
      // deletes, once added, must not be issued as separate top-level calls.
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);

      // "Called once" alone would still pass a fix that wraps only one of
      // the two deletes and issues the other outside the transaction — so
      // also prove both deletes are attributable to that single call.
      // Array form: both promises must be handed to the same $transaction
      // call (gap-detection.handler.spec.ts:449-450's length-check pattern).
      // Callback form: both delegates must have been invoked via `tx`
      // (mockTx), never directly on the un-scoped `mockPrisma` client.
      const txArg = mockPrisma.$transaction.mock.calls[0][0];
      if (Array.isArray(txArg)) {
        expect(txArg).toHaveLength(2);
      } else {
        expect(mockTx.assessmentDocument.delete).toHaveBeenCalledWith({
          where: { id: 'doc-1' },
        });
        expect(mockTx.job.delete).toHaveBeenCalledWith({
          where: { id: 'job-1', type: 'PARSE_DOCUMENT' },
        });
        expect(mockPrisma.assessmentDocument.delete).not.toHaveBeenCalled();
        expect(mockPrisma.job.delete).not.toHaveBeenCalled();
      }
    });
  });

  // ─── T-002 RED BASELINE — FR-DDP-002 Sc 1-2 & 4 / BR-DDP-003 ───────────────
  //
  // Bug: getMergedContent() (assessments.service.ts:389-408) serves
  // `gapJob.result.mergedMarkdown` verbatim whenever a COMPLETED GAP_DETECTION
  // job exists. It never checks whether the documents it analysed still
  // exist — there is no `superseded` computation and no `sourceParseJobIds`
  // read at all today. Each fixture below must fail on that missing
  // behaviour (an absent `superseded` key, or content served that must be
  // withheld), never on a thrown error.
  describe('getMergedContent — withholding rule for a deleted document (FR-DDP-002, requirements.md §6 D2)', () => {
    function mockCompletedGapJob(result: Record<string, unknown> | null) {
      mockPrisma.job.findFirst.mockResolvedValue(
        result === null
          ? null
          : {
              id: 'gap-job-1',
              type: 'GAP_DETECTION',
              status: 'COMPLETED',
              result,
              completedAt: new Date('2026-01-01T00:00:00Z'),
            },
      );
    }

    beforeEach(() => {
      mockPrisma.job.findFirst.mockReset();
      // Reset to the shared default (0/0 → analysisInFlight false) so a
      // `mockImplementation` installed by one in-flight test cannot leak
      // into the next — mirrors the `deleteDocument` describe block's own
      // reset discipline above.
      mockPrisma.job.count.mockReset().mockResolvedValue(0);
    });

    it('[D2 fixture 1 / FR-DDP-002 Sc4] serves the analysis when a document was ADDED — recorded [jobA], current documents {A, B}', async () => {
      mockCompletedGapJob({
        mergedMarkdown: '## Document: A.pdf\n\nA content',
        sourceParseJobIds: ['job-A'],
      });
      mockPrisma.assessmentDocument.findMany.mockResolvedValue([
        { id: 'doc-A', parseJobId: 'job-A' },
        { id: 'doc-B', parseJobId: 'job-B' },
      ]);

      const result = await service.getMergedContent('assess-1', 'user-1');

      // BR-DDP-002: an addition is not a removal — nothing the snapshot
      // describes has gone, so it must stay served, not withheld. This is
      // the fixture the v1.x lineage failed three times (judgment.md).
      expect(result.mergedMarkdown).toBe('## Document: A.pdf\n\nA content');
      expect((result as { superseded?: boolean }).superseded).toBe(false);
    });

    it('[D2 fixture 2 / FR-DDP-002 Sc1-2] withholds the analysis when its only source document was DELETED — recorded [jobA], current documents {B}', async () => {
      mockCompletedGapJob({
        mergedMarkdown: '## Document: A.pdf\n\nA content',
        sourceParseJobIds: ['job-A'],
      });
      mockPrisma.assessmentDocument.findMany.mockResolvedValue([
        { id: 'doc-B', parseJobId: 'job-B' },
      ]);

      const result = await service.getMergedContent('assess-1', 'user-1');

      // The reported bug, reproduced directly: today this serves A's
      // content unconditionally, with no notion of "superseded" at all.
      expect(result.mergedMarkdown).toBeNull();
      expect((result as { superseded?: boolean }).superseded).toBe(true);

      // BR-DDP-003: withholding is a pure read of the stored snapshot — it
      // must never touch the Analyst's own gap-field corrections.
      // getMergedContent() has never touched gapField, so this is green
      // today; it is expected to stay green through T-005, which is the
      // correct signature for a "must not change" business rule.
      expect(mockPrisma.gapField.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.gapField.updateMany).not.toHaveBeenCalled();
      expect(mockPrisma.gapField.update).not.toHaveBeenCalled();
    });

    it('[D2 fixture 3] serves — never withholds — a recorded EMPTY sourceParseJobIds, a truthful record of a run with nothing to analyse', async () => {
      mockCompletedGapJob({ mergedMarkdown: '', sourceParseJobIds: [] });
      mockPrisma.assessmentDocument.findMany.mockResolvedValue([
        { id: 'doc-A', parseJobId: 'job-A' },
      ]);

      const result = await service.getMergedContent('assess-1', 'user-1');

      expect((result as { superseded?: boolean }).superseded).toBe(false);
    });

    it('[D2 fixture 4] withholds a pre-fix analysis whose result carries NO sourceParseJobIds key at all — unevaluable, so it fails closed', async () => {
      mockCompletedGapJob({ mergedMarkdown: '## Document: A.pdf\n\nA content' }); // no sourceParseJobIds key
      mockPrisma.assessmentDocument.findMany.mockResolvedValue([
        { id: 'doc-A', parseJobId: 'job-A' },
      ]);

      const result = await service.getMergedContent('assess-1', 'user-1');

      expect(result.mergedMarkdown).toBeNull();
      expect((result as { superseded?: boolean }).superseded).toBe(true);
    });

    it("[D2 fixture 5 / FR-DDP-002 Sc4] serves the analysis when the ADDED document's parse FAILED — recorded [jobA], current documents {A, B(parseJobId='job-B', status='FAILED')}", async () => {
      // Why this fixture exists: a failed parse does NOT null out
      // parseJobId. parseJobId is written at job *creation*
      // (assessments.service.ts:270-273, :330-333); failure only sets
      // status: 'FAILED' and errorMessage (parse-document.handler.ts:59-67),
      // leaving parseJobId populated. An earlier defense of this clause
      // wrongly assumed a failed parse leaves parseJobId null — it does not,
      // so this is NOT the same case as an unparsed document, and it needs
      // its own fixture rather than resting on that false premise.
      mockCompletedGapJob({
        mergedMarkdown: '## Document: A.pdf\n\nA content',
        sourceParseJobIds: ['job-A'],
      });
      mockPrisma.assessmentDocument.findMany.mockResolvedValue([
        { id: 'doc-A', parseJobId: 'job-A' },
        { id: 'doc-B', parseJobId: 'job-B', status: 'FAILED' },
      ]);

      const result = await service.getMergedContent('assess-1', 'user-1');

      // A failed document contributes nothing, so it can neither supersede
      // nor withhold — same verdict as an ordinary addition (fixture 1).
      expect(result.mergedMarkdown).toBe('## Document: A.pdf\n\nA content');
      expect((result as { superseded?: boolean }).superseded).toBe(false);
    });

    // ─── T-009 — analysisInFlight (design.md §7.3 v2.1, §6, DD-DDP-006) ───────
    //
    // History this restores: v1.1 modelled in-flight as a sixth freshness
    // state and blanked valid analyses (finding R-1, Judgment Day round two).
    // v1.2 fixed it as an orthogonal boolean; v2.0 discarded the boolean along
    // with the enum it was wrongly bundled with. These fixtures must fail
    // against both wrong shapes: a v1.1-style implementation that ties
    // analysisInFlight to (or derives it from) `superseded`, and a v2.0-style
    // implementation that never computes it at all (field always `false`/
    // `undefined`).
    describe('getMergedContent — analysisInFlight, computed independently of superseded (T-009)', () => {
      // Differentiates the two `job.count` calls `isAnalysisInFlight` makes by
      // the `type` filter in their `where` clause — a single blanket
      // `mockResolvedValue` cannot distinguish "a PARSE_DOCUMENT job is
      // in flight" from "a GAP_DETECTION job is in flight", and this suite's
      // whole point is to prove each is detected on its own.
      function mockInFlightCounts({
        parseInFlight = 0,
        gapInFlight = 0,
      }: {
        parseInFlight?: number;
        gapInFlight?: number;
      }) {
        mockPrisma.job.count.mockImplementation(
          ({ where }: { where: { type: string } }) => {
            if (where.type === 'PARSE_DOCUMENT') return Promise.resolve(parseInFlight);
            if (where.type === 'GAP_DETECTION') return Promise.resolve(gapInFlight);
            return Promise.resolve(0);
          },
        );
      }

      it('[T-009] is true when a non-terminal PARSE_DOCUMENT job exists for a current document', async () => {
        mockCompletedGapJob(null); // nothing analysed yet
        mockPrisma.assessmentDocument.findMany.mockResolvedValue([
          { id: 'doc-A', parseJobId: 'job-parsing-A' },
        ]);
        mockInFlightCounts({ parseInFlight: 1, gapInFlight: 0 });

        const result = await service.getMergedContent('assess-1', 'user-1');

        expect(result.analysisInFlight).toBe(true);
      });

      it('[T-009] is true when a non-terminal GAP_DETECTION job exists for the assessment', async () => {
        mockCompletedGapJob(null);
        mockPrisma.assessmentDocument.findMany.mockResolvedValue([
          { id: 'doc-A', parseJobId: 'job-A' },
        ]);
        mockInFlightCounts({ parseInFlight: 0, gapInFlight: 1 });

        const result = await service.getMergedContent('assess-1', 'user-1');

        expect(result.analysisInFlight).toBe(true);
      });

      it('[T-009] is false when every related job is terminal', async () => {
        mockCompletedGapJob({
          mergedMarkdown: '## Document: A.pdf\n\nA content',
          sourceParseJobIds: ['job-A'],
        });
        mockPrisma.assessmentDocument.findMany.mockResolvedValue([
          { id: 'doc-A', parseJobId: 'job-A' },
        ]);
        mockInFlightCounts({ parseInFlight: 0, gapInFlight: 0 });

        const result = await service.getMergedContent('assess-1', 'user-1');

        expect(result.analysisInFlight).toBe(false);
      });

      // ─── The disqualifier-proof fixture: analysisInFlight must never
      // suppress content. A v1.1-style implementation that treats in-flight as
      // a freshness value (e.g. forcing mergedMarkdown to null, or forcing
      // superseded to true, whenever analysisInFlight is true) fails this —
      // the stored analysis is still valid (superseded: false) and a second
      // document is merely being added and parsed alongside it. ─────────────
      it('[T-009] does not suppress content: true alongside superseded: false while a valid analysis is still served', async () => {
        mockCompletedGapJob({
          mergedMarkdown: '## Document: A.pdf\n\nA content',
          sourceParseJobIds: ['job-A'],
        });
        mockPrisma.assessmentDocument.findMany.mockResolvedValue([
          { id: 'doc-A', parseJobId: 'job-A' }, // still current — not superseded
          { id: 'doc-B', parseJobId: 'job-parsing-B' }, // newly added, parsing now
        ]);
        mockInFlightCounts({ parseInFlight: 1, gapInFlight: 0 });

        const result = await service.getMergedContent('assess-1', 'user-1');

        expect(result.analysisInFlight).toBe(true);
        expect(result.superseded).toBe(false);
        // The load-bearing assertion: content stays served. An implementation
        // that lets analysisInFlight gate mergedMarkdown (the exact v1.1
        // defect) fails here even though it might pass the true/false
        // fixtures above in isolation.
        expect(result.mergedMarkdown).toBe('## Document: A.pdf\n\nA content');
      });

      // ─── The other pairing: both true at once. Proves the two booleans are
      // read from genuinely independent sources — superseded from the stored
      // snapshot vs. current documents, analysisInFlight from live job state —
      // not derived from one another in either direction. `mergedMarkdown`
      // stays null here, but because `superseded` withheld it under its own
      // pre-existing rule (fixture 2 above), never because analysisInFlight
      // did. ──────────────────────────────────────────────────────────────
      it('[T-009] is independent of superseded in the other direction: true alongside superseded: true (deletion, new run already started)', async () => {
        mockCompletedGapJob({
          mergedMarkdown: '## Document: A.pdf\n\nA content',
          sourceParseJobIds: ['job-A'],
        });
        mockPrisma.assessmentDocument.findMany.mockResolvedValue([
          { id: 'doc-B', parseJobId: 'job-B' }, // A was deleted; only B remains
        ]);
        mockInFlightCounts({ parseInFlight: 0, gapInFlight: 1 });

        const result = await service.getMergedContent('assess-1', 'user-1');

        expect(result.superseded).toBe(true);
        expect(result.analysisInFlight).toBe(true);
        expect(result.mergedMarkdown).toBeNull();
      });

      // ─── T-009 attempt 2 (Leader-promoted from advisory) ───────────────────
      //
      // Nothing in this platform retries a job reset to PENDING (design.md
      // §8.2, DD-DDP-006), and in-flight now outranks `superseded` with no
      // other bound (§8.1). Without an age bound, a job stuck non-terminal
      // reads as "in flight" forever: the panel shows "Analysing your
      // documents…" and "Re-analyse now" is unreachable, even across
      // reloads — a dead end worse than the bug this spec fixes.
      //
      // This fixture plays database for `job.count` by comparing a
      // simulated job's `createdAt` against the `where.createdAt.gte`
      // cutoff the production code is expected to supply. A status-only
      // implementation — the exact regression this test exists to catch —
      // never sends that cutoff, so `where.createdAt` is `undefined`, the
      // mock counts the stuck job regardless of its age, and the first
      // assertion below fails.
      it('[T-009] a non-terminal job stuck past the age bound does not read as in flight, but a fresh one does', async () => {
        mockCompletedGapJob(null);
        mockPrisma.assessmentDocument.findMany.mockResolvedValue([
          { id: 'doc-A', parseJobId: 'job-A' },
        ]);

        function mockGapCountAgainstSimulatedJobCreatedAt(simulatedCreatedAt: Date) {
          mockPrisma.job.count.mockImplementation(
            ({
              where,
            }: {
              where: { type: string; createdAt?: { gte?: Date } };
            }) => {
              if (where.type !== 'GAP_DETECTION') return Promise.resolve(0);
              const cutoff = where.createdAt?.gte;
              // No cutoff sent at all => the age bound was dropped, and this
              // simulated database would (wrongly) count every non-terminal
              // job regardless of age.
              const counted = !cutoff || simulatedCreatedAt >= cutoff;
              return Promise.resolve(counted ? 1 : 0);
            },
          );
        }

        // A GAP_DETECTION job created 10 minutes ago — well past the 4
        // minute bound — but still PENDING/PROCESSING in the DB, exactly
        // the state a job reset to PENDING and never retried is left in.
        mockGapCountAgainstSimulatedJobCreatedAt(
          new Date(Date.now() - 10 * 60 * 1000),
        );
        const stuckResult = await service.getMergedContent('assess-1', 'user-1');
        expect(stuckResult.analysisInFlight).toBe(false);

        // The identical shape of job, freshly created, must still read as
        // in flight — the bound must not overcorrect into "in-flight never
        // fires", which would reproduce the blank-panel-during-a-genuinely-
        // running-analysis defect this whole feature exists to prevent.
        mockGapCountAgainstSimulatedJobCreatedAt(new Date());
        const freshResult = await service.getMergedContent('assess-1', 'user-1');
        expect(freshResult.analysisInFlight).toBe(true);

        // ─── T-009 attempt 3 (Leader-promoted from Reviewer finding) ────────
        //
        // The stuck (10 min)/fresh (~0 min) pair above only constrains the
        // cutoff to somewhere between "now" and 10 minutes — a constant of
        // 30 seconds or 9 minutes keeps both assertions green. The exact
        // value is now load-bearing (ANALYSIS_IN_FLIGHT_MAX_AGE_MS's own
        // comment: it must stay strictly below the client's poll budget,
        // 60 × 5000ms = 300 000ms), so bracket it tightly around the real
        // 4-minute cutoff. A job ~3 minutes old must still read as in
        // flight (a 30s constant would already have expired it); a job ~5
        // minutes old must not (a 9-minute constant would still count it).
        mockGapCountAgainstSimulatedJobCreatedAt(
          new Date(Date.now() - 3 * 60 * 1000),
        );
        const threeMinResult = await service.getMergedContent(
          'assess-1',
          'user-1',
        );
        expect(threeMinResult.analysisInFlight).toBe(true);

        mockGapCountAgainstSimulatedJobCreatedAt(
          new Date(Date.now() - 5 * 60 * 1000),
        );
        const fiveMinResult = await service.getMergedContent(
          'assess-1',
          'user-1',
        );
        expect(fiveMinResult.analysisInFlight).toBe(false);
      });

      // ─── T-009 attempt 3 — the PARSE_DOCUMENT branch had no age gate at
      // all. `mockGapCountAgainstSimulatedJobCreatedAt` above only ever
      // resolves the GAP_DETECTION call from a simulated createdAt; the
      // PARSE_DOCUMENT call always defaulted to 0 in every fixture in this
      // file, so the age spread on that `job.count` call
      // (assessments.service.ts's parse-count query inside
      // `isAnalysisInFlight`) was never exercised — deleting the `notStuck`
      // spread from only that query stays green today. This mirrors the
      // stuck/fresh GAP_DETECTION pair, but against a current document's
      // PARSE_DOCUMENT job, so a document stuck in PARSING cannot read as
      // in flight forever. ─────────────────────────────────────────────────
      it('[T-009] a non-terminal PARSE_DOCUMENT job stuck past the age bound does not read as in flight, but a fresh one does', async () => {
        mockCompletedGapJob(null);
        mockPrisma.assessmentDocument.findMany.mockResolvedValue([
          { id: 'doc-A', parseJobId: 'job-parsing-A' },
        ]);

        function mockParseCountAgainstSimulatedJobCreatedAt(
          simulatedCreatedAt: Date,
        ) {
          mockPrisma.job.count.mockImplementation(
            ({
              where,
            }: {
              where: { type: string; createdAt?: { gte?: Date } };
            }) => {
              if (where.type !== 'PARSE_DOCUMENT') return Promise.resolve(0);
              const cutoff = where.createdAt?.gte;
              const counted = !cutoff || simulatedCreatedAt >= cutoff;
              return Promise.resolve(counted ? 1 : 0);
            },
          );
        }

        // A PARSE_DOCUMENT job created 10 minutes ago — well past the
        // bound — still PENDING/PROCESSING, exactly a document stuck in
        // PARSING forever with nothing to retry it.
        mockParseCountAgainstSimulatedJobCreatedAt(
          new Date(Date.now() - 10 * 60 * 1000),
        );
        const stuckResult = await service.getMergedContent(
          'assess-1',
          'user-1',
        );
        expect(stuckResult.analysisInFlight).toBe(false);

        // The identical shape of job, freshly created, must still read as
        // in flight.
        mockParseCountAgainstSimulatedJobCreatedAt(new Date());
        const freshResult = await service.getMergedContent(
          'assess-1',
          'user-1',
        );
        expect(freshResult.analysisInFlight).toBe(true);
      });

      // ─── Standing advisory, raised twice by the Reviewer: nothing
      // asserted the `where` clause's status set or its `id: { in:
      // currentParseJobIds } }` scope on either `job.count` call. Widening
      // the status filter to `{ not: 'COMPLETED' }` (making FAILED read as
      // in flight) or dropping the id scope (counting parse jobs belonging
      // to already-deleted documents) both stayed green before this test.
      it('[T-009] scopes both job.count calls to the correct status set and id/assessment filters', async () => {
        mockCompletedGapJob(null);
        mockPrisma.assessmentDocument.findMany.mockResolvedValue([
          { id: 'doc-A', parseJobId: 'job-A' },
        ]);
        mockPrisma.job.count.mockReset().mockResolvedValue(0);

        await service.getMergedContent('assess-1', 'user-1');

        expect(mockPrisma.job.count).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              id: { in: ['job-A'] },
              type: 'PARSE_DOCUMENT',
              status: { in: ['PENDING', 'PROCESSING'] },
            }),
          }),
        );
        expect(mockPrisma.job.count).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              type: 'GAP_DETECTION',
              status: { in: ['PENDING', 'PROCESSING'] },
              input: { path: ['assessmentId'], equals: 'assess-1' },
            }),
          }),
        );
      });
    });
  });
});
