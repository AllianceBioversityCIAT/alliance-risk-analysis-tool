import { GapDetectionHandler } from './gap-detection.handler';
import { GAP_DETECTION_CONFIG } from '../../../domain/gap-detection/gap-detection.config';

function createGapAIResponse() {
  return {
    fields: GAP_DETECTION_CONFIG.core10Fields.map(({ field }) => ({
      field,
      status: 'PARTIAL' as const,
      extractedValue: 'sample',
      confidence: 0.8,
      reasoning: 'Detected in document',
    })),
  };
}

// ─── FR-DDP-001 fixtures (T-002 red baseline) ────────────────────────────────
//
// A minimal in-memory fake for `prisma.job.findMany`, built to answer BOTH the
// query shape `processUploadMode` issues today (filter by `input.assessmentId`
// equals, ignoring which documents still exist) AND the shape design.md §7.1
// specifies for the fix (filter by `id: { in: currentParseJobIds }`). This lets
// the exact same fixture and assertions serve as T-003's green bar without
// rewriting this spec file — only the production query shape changes.
interface FakeParseJob {
  id: string;
  type: 'PARSE_DOCUMENT';
  status: 'COMPLETED';
  input: { assessmentId: string; fileName: string };
  result: { markdownContent: string };
  completedAt: Date;
}

function makeParseJob(
  id: string,
  fileName: string,
  markdownContent: string,
  completedAt: Date,
  assessmentId = 'assessment-1',
): FakeParseJob {
  return {
    id,
    type: 'PARSE_DOCUMENT',
    status: 'COMPLETED',
    input: { assessmentId, fileName },
    result: { markdownContent },
    completedAt,
  };
}

function wireJobFindManyToStore(mockJobFindMany: jest.Mock, jobs: FakeParseJob[]) {
  mockJobFindMany.mockImplementation(
    ({ where, orderBy }: { where?: Record<string, any>; orderBy?: Record<string, string> } = {}) => {
      let filtered = jobs.slice();
      if (where?.type) filtered = filtered.filter((j) => j.type === where.type);
      if (where?.status) filtered = filtered.filter((j) => j.status === where.status);
      if (where?.input?.equals !== undefined) {
        filtered = filtered.filter((j) => j.input.assessmentId === where.input.equals);
      }
      if (where?.id?.in) {
        const idSet = new Set(where.id.in as string[]);
        filtered = filtered.filter((j) => idSet.has(j.id));
      }
      if (orderBy?.completedAt === 'asc') {
        filtered = [...filtered].sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime());
      }
      return Promise.resolve(filtered);
    },
  );
}

describe('GapDetectionHandler', () => {
  const mockPrisma = {
    job: { findMany: jest.fn() },
    // Not yet consulted by production code (that is exactly what T-002 proves
    // red) — added here so the merge-scoping fix (T-003, design.md §7.1) can
    // turn these same tests green without touching this spec file again.
    // (This file's own $transaction mock below, exercised only by the
    // pre-existing re-analyze tests further down, is unaffected by the
    // array-vs-callback mock-form gap found in assessments.service.spec.ts —
    // gap-detection.handler.ts only ever calls the array form, at :491.)
    assessmentDocument: { findMany: jest.fn() },
    prompt: { findFirst: jest.fn() },
    gapField: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    assessment: { findUniqueOrThrow: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  };
  const mockBedrock = { invokeModel: jest.fn() };

  let handler: GapDetectionHandler;

  beforeEach(() => {
    jest.resetAllMocks();
    handler = new GapDetectionHandler(mockPrisma as never, mockBedrock as never);
  });

  it('injects assessment country into Bedrock prompts during upload mode', async () => {
    mockPrisma.job.findMany.mockResolvedValue([
      {
        input: { assessmentId: 'assessment-1', fileName: 'brief.pdf' },
        result: { markdownContent: 'Company operates in East Africa.' },
      },
    ]);
    mockPrisma.prompt.findFirst.mockResolvedValue({
      systemPrompt: 'You are a gap detector for {{country}} agriculture.',
      userPromptTemplate: 'Extract Core 10 fields for {{country}}:\n{{extracted_data}}',
    });
    mockPrisma.gapField.createMany.mockResolvedValue({ count: 10 });
    mockBedrock.invokeModel.mockResolvedValue({
      output: JSON.stringify(createGapAIResponse()),
      tokensUsed: 512,
    });

    await (handler as any).processUploadMode('assessment-1', 'Zambia', false);

    expect(mockBedrock.invokeModel).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining('Zambia'),
        userPrompt: expect.stringContaining('Zambia'),
      }),
    );
    expect(mockBedrock.invokeModel.mock.calls[0][0].systemPrompt).not.toContain('{{country}}');
  });

  describe('execute() — detectedCountry fold-in write (DD-CMV-006)', () => {
    function mockUploadAssessment(overrides: Record<string, unknown> = {}) {
      mockPrisma.assessment.findUniqueOrThrow.mockResolvedValue({
        id: 'assessment-1',
        intakeMode: 'UPLOAD',
        country: 'Kenya',
        ...overrides,
      });
    }

    beforeEach(() => {
      mockPrisma.gapField.deleteMany.mockResolvedValue({ count: 10 });
      mockPrisma.gapField.createMany.mockResolvedValue({ count: 10 });
      mockPrisma.assessment.update.mockResolvedValue({});
      mockPrisma.prompt.findFirst.mockResolvedValue({
        systemPrompt: 'System prompt for {{country}}.',
        userPromptTemplate: 'User prompt for {{country}}: {{extracted_data}}',
      });
      mockPrisma.job.findMany.mockResolvedValue([
        {
          input: { assessmentId: 'assessment-1', fileName: 'plan.pdf' },
          result: { markdownContent: 'The business operates in Zambia.' },
        },
      ]);
    });

    it('persists a normalized detectedCountry when it is a supported country at confidence >= 0.7', async () => {
      mockUploadAssessment();
      mockBedrock.invokeModel.mockResolvedValue({
        output: JSON.stringify({
          detectedCountry: 'Zambia',
          detectedCountryConfidence: 0.85,
          ...createGapAIResponse(),
        }),
        tokensUsed: 400,
      });

      await handler.execute({ assessmentId: 'assessment-1' });

      expect(mockPrisma.assessment.update).toHaveBeenCalledTimes(1);
      expect(mockPrisma.assessment.update).toHaveBeenCalledWith({
        where: { id: 'assessment-1' },
        data: { status: 'ACTION_REQUIRED', progress: 50, detectedCountry: 'Zambia' },
      });
    });

    it('persists a confidently-detected country outside the 4-country allowlist instead of normalizing it to null (DD-CMV-007 / BR-CMV-001 revised)', async () => {
      mockUploadAssessment({ country: 'Nigeria' });
      mockBedrock.invokeModel.mockResolvedValue({
        output: JSON.stringify({
          detectedCountry: 'Malawi',
          detectedCountryConfidence: 0.95,
          ...createGapAIResponse(),
        }),
        tokensUsed: 400,
      });

      await handler.execute({ assessmentId: 'assessment-1' });

      // Malawi is not one of the 4 supported countries, but it's a real,
      // confidently-detected value — it must be persisted as-is, not discarded.
      expect(mockPrisma.assessment.update).toHaveBeenCalledWith({
        where: { id: 'assessment-1' },
        data: { status: 'ACTION_REQUIRED', progress: 50, detectedCountry: 'Malawi' },
      });
    });

    it('accepts a detectedCountry at exactly the 100-character length boundary (inclusive)', async () => {
      mockUploadAssessment();
      const exactly100Chars = 'A'.repeat(100);
      mockBedrock.invokeModel.mockResolvedValue({
        output: JSON.stringify({
          detectedCountry: exactly100Chars,
          detectedCountryConfidence: 0.95,
          ...createGapAIResponse(),
        }),
        tokensUsed: 400,
      });

      await handler.execute({ assessmentId: 'assessment-1' });

      // Mirrors the existing 0.7/0.699999 confidence-boundary pair — 100 chars
      // must be accepted, 101 (already tested below) must be rejected.
      expect(mockPrisma.assessment.update).toHaveBeenCalledWith({
        where: { id: 'assessment-1' },
        data: { status: 'ACTION_REQUIRED', progress: 50, detectedCountry: exactly100Chars },
      });
    });

    it.each([
      ['the literal "unclear"', 'unclear', 0.95],
      ['the literal "unclear" in different casing', 'UnClear', 0.95],
      ['an empty string after trimming', '   ', 0.95],
      ['an oversized string (>100 chars)', 'A'.repeat(101), 0.95],
      ['a missing detectedCountry key', undefined, 0.95],
      ['confidence below 0.7', 'Zambia', 0.5],
    ])('normalizes %s to null and logs a debug line', async (_label, detectedCountry, confidence) => {
      mockUploadAssessment();
      const debugSpy = jest
        .spyOn((handler as any).logger, 'debug')
        .mockImplementation(() => undefined);

      mockBedrock.invokeModel.mockResolvedValue({
        output: JSON.stringify({
          ...(detectedCountry === undefined ? {} : { detectedCountry }),
          detectedCountryConfidence: confidence,
          ...createGapAIResponse(),
        }),
        tokensUsed: 400,
      });

      await handler.execute({ assessmentId: 'assessment-1' });

      expect(mockPrisma.assessment.update).toHaveBeenCalledWith({
        where: { id: 'assessment-1' },
        data: { status: 'ACTION_REQUIRED', progress: 50, detectedCountry: null },
      });
      expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('detectedCountry rejected'));
    });

    it('does not break Core-10 field parsing when detectedCountry is missing/malformed', async () => {
      mockUploadAssessment();
      mockBedrock.invokeModel.mockResolvedValue({
        output: JSON.stringify(createGapAIResponse()), // no detectedCountry/detectedCountryConfidence at all
        tokensUsed: 400,
      });

      await expect(handler.execute({ assessmentId: 'assessment-1' })).resolves.toBeDefined();

      expect(mockPrisma.gapField.createMany).toHaveBeenCalledTimes(1);
      const createdData = mockPrisma.gapField.createMany.mock.calls[0][0].data;
      expect(createdData).toHaveLength(GAP_DETECTION_CONFIG.core10Fields.length);
      expect(mockPrisma.assessment.update).toHaveBeenCalledWith({
        where: { id: 'assessment-1' },
        data: { status: 'ACTION_REQUIRED', progress: 50, detectedCountry: null },
      });
    });

    it('clears detectedCountry to null when a re-analyze run hits a Bedrock failure', async () => {
      mockUploadAssessment();
      mockPrisma.gapField.findMany.mockResolvedValue([]); // no existing corrections
      mockBedrock.invokeModel.mockRejectedValue(new Error('Bedrock unavailable'));

      await handler.execute({ assessmentId: 'assessment-1', reAnalyze: true });

      expect(mockPrisma.assessment.update).toHaveBeenCalledWith({
        where: { id: 'assessment-1' },
        data: { status: 'ACTION_REQUIRED', progress: 50, detectedCountry: null },
      });
      // Re-analyze + Bedrock failure preserves existing fields — createErrorFields()
      // (which calls gapField.createMany) must not run on this branch.
      expect(mockPrisma.gapField.createMany).not.toHaveBeenCalled();
    });

    // Retargeted 2026-08-21 (T-003 Pivot Record, execution.md) — this test used to
    // call execute({ reAnalyze: true }) with zero jobs. Design.md §7.1's skeleton
    // guard (`if (!isReAnalyze) { await this.createSkeletonFields(...) }`) now skips
    // createSkeletonFields() entirely on that exact input, which would have made the
    // `gapField.createMany` assertion below false for the wrong reason. That
    // assertion was only ever this test's *precondition* — proof the helper ran, so
    // the assertion after it (that createSkeletonFields() performs no Assessment
    // write of its own, inherited from the archived country-match spec) is
    // meaningful. Moving to a non-re-analyze run restores the precondition:
    // `!isReAnalyze` is true, so createSkeletonFields() still executes, and the
    // real claim under test is exercised exactly as before.
    it('[T-003 guard / NFR-DDP-012] clears detectedCountry to null on zero completed parse jobs during a non-re-analyze run, without createSkeletonFields() touching prisma.assessment', async () => {
      mockUploadAssessment();
      mockPrisma.job.findMany.mockResolvedValue([]); // zero completed PARSE_DOCUMENT jobs

      await handler.execute({ assessmentId: 'assessment-1' }); // non-re-analyze: !isReAnalyze holds, so createSkeletonFields() still runs

      // createSkeletonFields() ran (GapField-only helper) ...
      expect(mockPrisma.gapField.createMany).toHaveBeenCalledTimes(1);
      // ... but the ONLY prisma.assessment.update call is the single execute()-level
      // fold-in write — createSkeletonFields() performs no Assessment write of its own.
      expect(mockPrisma.assessment.update).toHaveBeenCalledTimes(1);
      expect(mockPrisma.assessment.update).toHaveBeenCalledWith({
        where: { id: 'assessment-1' },
        data: { status: 'ACTION_REQUIRED', progress: 50, detectedCountry: null },
      });
    });

    // NEW (T-003, design.md §7.1) — the skeleton guard itself. Without
    // `!isReAnalyze`, a re-analyze that resolves zero parse jobs would call
    // createSkeletonFields() on top of the ten GapField rows execute() leaves in
    // place when isReAnalyze is true (it only deletes existing fields when
    // !isReAnalyze), duplicating the Core-10 list to twenty. GapField carries only
    // `@@index([assessmentId, category])` and no unique constraint on
    // (assessmentId, field) (schema.prisma:309-329), so nothing at the database
    // level would collapse that duplicate.
    it('[T-003 guard / NFR-DDP-012] does not call gapField.createMany on a re-analyze run that resolves zero completed parse jobs', async () => {
      mockUploadAssessment();
      mockPrisma.job.findMany.mockResolvedValue([]); // zero completed PARSE_DOCUMENT jobs

      await handler.execute({ assessmentId: 'assessment-1', reAnalyze: true });

      expect(mockPrisma.gapField.createMany).not.toHaveBeenCalled();
    });

    it('invokes Bedrock exactly once per gap-detection run (NFR-CMV-010)', async () => {
      mockUploadAssessment();
      mockBedrock.invokeModel.mockResolvedValue({
        output: JSON.stringify({
          detectedCountry: 'Kenya',
          detectedCountryConfidence: 0.9,
          ...createGapAIResponse(),
        }),
        tokensUsed: 400,
      });

      await handler.execute({ assessmentId: 'assessment-1' });

      expect(mockBedrock.invokeModel).toHaveBeenCalledTimes(1);
    });

    it('does NOT let a thrown error from assessment.update() get caught by the Bedrock-failure catch block or trigger createErrorFields (DD-CMV-006)', async () => {
      mockUploadAssessment();
      mockBedrock.invokeModel.mockResolvedValue({
        output: JSON.stringify({
          detectedCountry: 'Kenya',
          detectedCountryConfidence: 0.9,
          ...createGapAIResponse(),
        }),
        tokensUsed: 400,
      });
      mockPrisma.assessment.update.mockRejectedValue(new Error('transient DB error'));

      await expect(handler.execute({ assessmentId: 'assessment-1' })).rejects.toThrow(
        'transient DB error',
      );

      // createFieldsFromAIResponse() already succeeded once (Core-10 fields written
      // from the successful Bedrock parse) — this call happens inside
      // processUploadMode()'s try block, which resolves BEFORE the fold-in write
      // that then throws. If the assessment.update() failure were (wrongly) caught
      // by the Bedrock try/catch and treated as a Bedrock failure, createErrorFields()
      // would ALSO call gapField.createMany, making this count 2 instead of 1.
      expect(mockPrisma.gapField.createMany).toHaveBeenCalledTimes(1);
    });

    it('accepts a detectedCountry at exactly the 0.7 confidence boundary (BR-CMV-003 inclusive threshold)', async () => {
      mockUploadAssessment();
      mockBedrock.invokeModel.mockResolvedValue({
        output: JSON.stringify({
          detectedCountry: 'Zambia',
          detectedCountryConfidence: 0.7,
          ...createGapAIResponse(),
        }),
        tokensUsed: 400,
      });

      await handler.execute({ assessmentId: 'assessment-1' });

      // >= 0.7 must include the boundary value itself, not just values strictly above it.
      expect(mockPrisma.assessment.update).toHaveBeenCalledWith({
        where: { id: 'assessment-1' },
        data: { status: 'ACTION_REQUIRED', progress: 50, detectedCountry: 'Zambia' },
      });
    });

    it('rejects a detectedCountry just below the 0.7 confidence boundary (0.699999)', async () => {
      mockUploadAssessment();
      mockBedrock.invokeModel.mockResolvedValue({
        output: JSON.stringify({
          detectedCountry: 'Zambia',
          detectedCountryConfidence: 0.699999,
          ...createGapAIResponse(),
        }),
        tokensUsed: 400,
      });

      await handler.execute({ assessmentId: 'assessment-1' });

      expect(mockPrisma.assessment.update).toHaveBeenCalledWith({
        where: { id: 'assessment-1' },
        data: { status: 'ACTION_REQUIRED', progress: 50, detectedCountry: null },
      });
    });

    it('[A1 / FR-CMV-001 Sc3] leaves detectedCountry null and never calls Bedrock for a non-UPLOAD intake mode', async () => {
      mockPrisma.assessment.findUniqueOrThrow.mockResolvedValue({
        id: 'assessment-1',
        intakeMode: 'GUIDED_INTERVIEW',
        country: 'Kenya',
      });
      mockPrisma.gapField.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.gapField.createMany.mockResolvedValue({ count: 10 });
      mockPrisma.assessment.update.mockResolvedValue({});

      await handler.execute({ assessmentId: 'assessment-1' });

      // The `let detectedCountry: string | null = null` initializer must survive
      // this branch untouched — no widening to `undefined`, no accidental leak
      // of a stale/other value. This branch never talks to Bedrock at all.
      expect(mockBedrock.invokeModel).not.toHaveBeenCalled();
      expect(mockPrisma.assessment.update).toHaveBeenCalledTimes(1);
      expect(mockPrisma.assessment.update).toHaveBeenCalledWith({
        where: { id: 'assessment-1' },
        data: { status: 'ACTION_REQUIRED', progress: 50, detectedCountry: null },
      });
      // createSkeletonFields() ran instead (GapField-only, no Bedrock call, no
      // assessment write of its own).
      expect(mockPrisma.gapField.createMany).toHaveBeenCalledTimes(1);
    });

    it('[A1 / FR-CMV-001 Sc3] same guarantee holds for MANUAL_ENTRY intake mode', async () => {
      mockPrisma.assessment.findUniqueOrThrow.mockResolvedValue({
        id: 'assessment-1',
        intakeMode: 'MANUAL_ENTRY',
        country: 'Nigeria',
      });
      mockPrisma.gapField.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.gapField.createMany.mockResolvedValue({ count: 10 });
      mockPrisma.assessment.update.mockResolvedValue({});

      await handler.execute({ assessmentId: 'assessment-1' });

      expect(mockBedrock.invokeModel).not.toHaveBeenCalled();
      expect(mockPrisma.assessment.update).toHaveBeenCalledWith({
        where: { id: 'assessment-1' },
        data: { status: 'ACTION_REQUIRED', progress: 50, detectedCountry: null },
      });
    });

    it('[A2 / FR-CMV-006 Sc1] re-analyze success path: refreshes detectedCountry and runs updateFieldsFromAIResponse via $transaction', async () => {
      mockUploadAssessment(); // intakeMode UPLOAD, country Kenya
      const existingFields = GAP_DETECTION_CONFIG.core10Fields.map((def, i) => ({
        id: `field-${i}`,
        field: def.field,
        correctedValue: i === 0 ? 'user-provided correction' : null,
      }));
      // Same underlying table backs both the re-analyze corrections lookup
      // (processUploadMode step 4b) and updateFieldsFromAIResponse()'s own fetch.
      mockPrisma.gapField.findMany.mockResolvedValue(existingFields);
      mockPrisma.gapField.update.mockImplementation((args: unknown) => args);
      mockPrisma.$transaction.mockResolvedValue(undefined);
      mockBedrock.invokeModel.mockResolvedValue({
        output: JSON.stringify({
          detectedCountry: 'Zambia',
          detectedCountryConfidence: 0.9,
          ...createGapAIResponse(),
        }),
        tokensUsed: 300,
      });

      await handler.execute({ assessmentId: 'assessment-1', reAnalyze: true });

      // updateFieldsFromAIResponse() ran (not createFieldsFromAIResponse) —
      // the re-analyze branch never calls gapField.createMany.
      expect(mockPrisma.gapField.createMany).not.toHaveBeenCalled();

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      const txArg = mockPrisma.$transaction.mock.calls[0][0] as unknown[];
      expect(txArg).toHaveLength(existingFields.length);

      // Field 0 has a user correction: only AI metadata refreshes, status/value untouched.
      const correctedCallArgs = mockPrisma.gapField.update.mock.calls.find(
        (call) => call[0].where.id === 'field-0',
      )?.[0];
      expect(correctedCallArgs.data).not.toHaveProperty('extractedValue');
      expect(correctedCallArgs.data).not.toHaveProperty('status');
      expect(correctedCallArgs.data).toEqual(
        expect.objectContaining({ confidence: expect.any(Number), aiReasoning: expect.any(String) }),
      );

      // A non-corrected field gets the full AI-driven update.
      const uncorrectedCallArgs = mockPrisma.gapField.update.mock.calls.find(
        (call) => call[0].where.id === 'field-1',
      )?.[0];
      expect(uncorrectedCallArgs.data).toHaveProperty('extractedValue');
      expect(uncorrectedCallArgs.data).toHaveProperty('status');

      // The single execute()-level fold-in write reflects the freshly-detected country.
      expect(mockPrisma.assessment.update).toHaveBeenCalledTimes(1);
      expect(mockPrisma.assessment.update).toHaveBeenCalledWith({
        where: { id: 'assessment-1' },
        data: { status: 'ACTION_REQUIRED', progress: 50, detectedCountry: 'Zambia' },
      });
    });

    describe('[FR-CMV-006 Sc3 / DD-CMV-010] manual country_of_operation correction overrides re-detection', () => {
      function mockCorrectedCountryOfOperation(correctedValue: string | null) {
        const existingFields = GAP_DETECTION_CONFIG.core10Fields.map((def, i) => ({
          id: `field-${i}`,
          field: def.field,
          correctedValue: def.field === 'country_of_operation' ? correctedValue : null,
        }));
        mockPrisma.gapField.findMany.mockResolvedValue(existingFields);
        mockPrisma.gapField.update.mockImplementation((args: unknown) => args);
        mockPrisma.$transaction.mockResolvedValue(undefined);
      }

      it('uses the user correction over the model’s own re-detected country', async () => {
        mockUploadAssessment();
        mockCorrectedCountryOfOperation('Nigeria');
        mockBedrock.invokeModel.mockResolvedValue({
          output: JSON.stringify({
            detectedCountry: 'Zambia',
            detectedCountryConfidence: 0.95,
            ...createGapAIResponse(),
          }),
          tokensUsed: 300,
        });

        await handler.execute({ assessmentId: 'assessment-1', reAnalyze: true });

        // The correction is read from the same gapField.findMany() call already made
        // in step 4b to build the "USER-PROVIDED CORRECTIONS" prompt text — no new
        // query is added for this. (updateFieldsFromAIResponse() makes its own,
        // separate, pre-existing findMany() call for the Core-10 field update itself.)
        expect(mockPrisma.assessment.update).toHaveBeenCalledWith({
          where: { id: 'assessment-1' },
          data: { status: 'ACTION_REQUIRED', progress: 50, detectedCountry: 'Nigeria' },
        });
      });

      it('falls back to the model’s response when there is no correction to country_of_operation', async () => {
        mockUploadAssessment();
        mockCorrectedCountryOfOperation(null);
        mockBedrock.invokeModel.mockResolvedValue({
          output: JSON.stringify({
            detectedCountry: 'Zambia',
            detectedCountryConfidence: 0.95,
            ...createGapAIResponse(),
          }),
          tokensUsed: 300,
        });

        await handler.execute({ assessmentId: 'assessment-1', reAnalyze: true });

        expect(mockPrisma.assessment.update).toHaveBeenCalledWith({
          where: { id: 'assessment-1' },
          data: { status: 'ACTION_REQUIRED', progress: 50, detectedCountry: 'Zambia' },
        });
      });

      it.each([
        ['an empty string after trimming', '   '],
        ['the literal "unclear"', 'unclear'],
        ['the literal "unclear" in different casing', 'UnClear'],
      ])('falls back to the model’s response when the correction fails the sanity check (%s)', async (_label, correctedValue) => {
        mockUploadAssessment();
        mockCorrectedCountryOfOperation(correctedValue);
        mockBedrock.invokeModel.mockResolvedValue({
          output: JSON.stringify({
            detectedCountry: 'Zambia',
            detectedCountryConfidence: 0.95,
            ...createGapAIResponse(),
          }),
          tokensUsed: 300,
        });

        await handler.execute({ assessmentId: 'assessment-1', reAnalyze: true });

        expect(mockPrisma.assessment.update).toHaveBeenCalledWith({
          where: { id: 'assessment-1' },
          data: { status: 'ACTION_REQUIRED', progress: 50, detectedCountry: 'Zambia' },
        });
      });
    });
  });

  // ─── T-002 RED BASELINE — FR-DDP-001 Sc 1-3 ────────────────────────────────
  //
  // Bug: processUploadMode() merges every COMPLETED PARSE_DOCUMENT job whose
  // `input.assessmentId` matches, regardless of whether the document that
  // produced it still exists (gap-detection.handler.ts:124-131). Deleting a
  // document never removes its job, so deleted content re-enters every future
  // merge. BR-DDP-001: "current documents" means the assessment's existing
  // AssessmentDocument records — never the historical set of jobs ever created.
  describe('processUploadMode — merge input scoped to current documents (FR-DDP-001)', () => {
    beforeEach(() => {
      mockPrisma.prompt.findFirst.mockResolvedValue({
        systemPrompt: 'System prompt for {{country}}.',
        userPromptTemplate: 'User prompt for {{country}}: {{extracted_data}}',
      });
      mockPrisma.gapField.createMany.mockResolvedValue({ count: 10 });
      mockBedrock.invokeModel.mockResolvedValue({
        output: JSON.stringify(createGapAIResponse()),
        tokensUsed: 100,
      });
    });

    it("[FR-DDP-001 Sc1] excludes deleted document A's completed parse job from the merge, keeping only current document B's content", async () => {
      const t1 = new Date('2026-01-01T00:00:00Z');
      const t2 = new Date('2026-01-02T00:00:00Z');
      wireJobFindManyToStore(mockPrisma.job.findMany, [
        makeParseJob('job-A', 'A.pdf', "A's confidential content", t1),
        makeParseJob('job-B', 'B.pdf', "B's content", t2),
      ]);
      // A was deleted — only B is a current AssessmentDocument.
      mockPrisma.assessmentDocument.findMany.mockResolvedValue([
        { id: 'doc-B', assessmentId: 'assessment-1', parseJobId: 'job-B' },
      ]);

      const result = await (handler as any).processUploadMode('assessment-1', 'Kenya', false);

      // The specific behaviour under test: deleted A's text must not survive
      // into the merge, no matter that its job record still exists.
      expect(result.mergedMarkdown).not.toContain("A's confidential content");
      expect(result.mergedMarkdown).not.toContain('A.pdf');
      expect(result.mergedMarkdown).toContain("B's content");
      expect(result.mergedMarkdown).toContain('## Document: B.pdf');

      // BR-DDP-001: resolution must go through the assessment's current
      // document records, never solely through job.findMany's own
      // assessmentId filter.
      expect(mockPrisma.assessmentDocument.findMany).toHaveBeenCalled();
    });

    it('[FR-DDP-001 Sc2] excludes the middle document B of three when B is deleted, preserving oldest-first order of A and C', async () => {
      const t1 = new Date('2026-01-01T00:00:00Z');
      const t2 = new Date('2026-01-02T00:00:00Z');
      const t3 = new Date('2026-01-03T00:00:00Z');
      wireJobFindManyToStore(mockPrisma.job.findMany, [
        makeParseJob('job-A', 'A.pdf', "A's content", t1),
        makeParseJob('job-B', 'B.pdf', "B's content", t2),
        makeParseJob('job-C', 'C.pdf', "C's content", t3),
      ]);
      // B was deleted — only A and C are current AssessmentDocuments.
      mockPrisma.assessmentDocument.findMany.mockResolvedValue([
        { id: 'doc-A', assessmentId: 'assessment-1', parseJobId: 'job-A' },
        { id: 'doc-C', assessmentId: 'assessment-1', parseJobId: 'job-C' },
      ]);

      const result = await (handler as any).processUploadMode('assessment-1', 'Kenya', false);

      expect(result.mergedMarkdown).not.toContain("B's content");
      expect(result.mergedMarkdown).not.toContain('B.pdf');

      // Oldest-first order preserved for the surviving documents: A before C.
      const indexA = result.mergedMarkdown.indexOf("A's content");
      const indexC = result.mergedMarkdown.indexOf("C's content");
      expect(indexA).toBeGreaterThanOrEqual(0);
      expect(indexC).toBeGreaterThan(indexA);
    });

    it('[FR-DDP-001 Sc3] leaves the two-document merge with no deletions unchanged in content, order and separator format, resolved through current documents (BR-DDP-001)', async () => {
      const t1 = new Date('2026-01-01T00:00:00Z');
      const t2 = new Date('2026-01-02T00:00:00Z');
      wireJobFindManyToStore(mockPrisma.job.findMany, [
        makeParseJob('job-A', 'A.pdf', "A's content", t1),
        makeParseJob('job-B', 'B.pdf', "B's content", t2),
      ]);
      // Nothing deleted — both A and B are current AssessmentDocuments.
      mockPrisma.assessmentDocument.findMany.mockResolvedValue([
        { id: 'doc-A', assessmentId: 'assessment-1', parseJobId: 'job-A' },
        { id: 'doc-B', assessmentId: 'assessment-1', parseJobId: 'job-B' },
      ]);

      const result = await (handler as any).processUploadMode('assessment-1', 'Kenya', false);

      // Today's exact separator/header format (gap-detection.handler.ts:146,150),
      // reproduced by hand as an independent expected value — must be unchanged.
      const expectedMerge =
        "## Document: A.pdf\n\nA's content\n\n---\n\n## Document: B.pdf\n\nB's content";
      expect(result.mergedMarkdown).toBe(expectedMerge);

      // BR-DDP-001: even when the outcome is unchanged, resolution must go
      // through the assessment's current document records — today it never
      // does, so this fails even though the merge content above is correct.
      expect(mockPrisma.assessmentDocument.findMany).toHaveBeenCalled();
    });
  });

  // ─── T-009 INDEPENDENT GATE — FR-DDP-001 / BR-DDP-001 ──────────────────────
  //
  // Authored by the /akili-test Tester, deliberately NOT derived from the three
  // T-002 fixtures above. /akili-validate found those three to be the *sole*
  // automated gate on the bug this spec exists to fix: every other test in this
  // file stubs `job.findMany` with a bare `mockResolvedValue(...)` that ignores
  // the `where` clause, so it is structurally blind to the merge-scoping fix.
  // Any future edit to those three would leave the reported bug uncovered. This
  // block is a second gate that does not depend on them surviving — it carries
  // its own fixtures, its own Prisma fake, and its own seam.
  //
  // Three deliberate differences from the block above:
  //
  //  1. **Different seam.** It drives the public `execute()`, not the private
  //     `processUploadMode()`. That also proves `sourceParseJobIds` reaches the
  //     value persisted as the GAP_DETECTION job's result — the record
  //     `AssessmentsService.getMergedContent` later subtracts against
  //     (design.md §7.3 / DD-DDP-002).
  //  2. **Permissive fake.** Its `job.findMany` fake honours only the query
  //     shape design.md §7.1 specifies (`id: { in: … }` + type + status +
  //     `orderBy.completedAt`) and silently *ignores* an `input.assessmentId`
  //     filter. A reversion to the pre-fix query therefore does not merely fail
  //     an equality — every orphaned job leaks back into the merge and these
  //     tests fail loudly, on content.
  //  3. **Different properties.** The query issued, the document→job traversal
  //     itself, zero current documents, a null `parseJobId`, a non-COMPLETED
  //     job, and ordering across four documents — none of which the three
  //     fixtures above touch.
  describe('execute() — merge input resolved through current documents, independent gate (FR-DDP-001 / BR-DDP-001)', () => {
    interface StoredJob {
      id: string;
      type: string;
      status: string;
      input: { assessmentId: string; fileName: string };
      result: { markdownContent: string };
      completedAt: Date;
    }

    function storedJob(
      id: string,
      fileName: string,
      markdownContent: string,
      completedAt: Date,
      status: 'COMPLETED' | 'FAILED' | 'PENDING' | 'PROCESSING' = 'COMPLETED',
    ): StoredJob {
      return {
        id,
        type: 'PARSE_DOCUMENT',
        status,
        input: { assessmentId: 'assessment-1', fileName },
        result: { markdownContent },
        completedAt,
      };
    }

    /**
     * Honours ONLY the §7.1 query shape. An `input`-scoped filter is ignored on
     * purpose: the pre-fix query must leak, not quietly return nothing.
     */
    function seedJobStore(jobs: StoredJob[]) {
      mockPrisma.job.findMany.mockImplementation(
        ({
          where = {},
          orderBy,
        }: { where?: Record<string, any>; orderBy?: Record<string, string> } = {}) => {
          let rows = jobs.slice();
          if (where.id?.in !== undefined) {
            const ids = new Set(where.id.in as unknown[]);
            rows = rows.filter((j) => ids.has(j.id));
          }
          if (where.type !== undefined) rows = rows.filter((j) => j.type === where.type);
          if (where.status !== undefined) rows = rows.filter((j) => j.status === where.status);
          if (orderBy?.completedAt === 'asc') {
            rows = [...rows].sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime());
          }
          return Promise.resolve(rows);
        },
      );
    }

    function seedCurrentDocuments(docs: Array<{ id: string; parseJobId: string | null }>) {
      mockPrisma.assessmentDocument.findMany.mockResolvedValue(
        docs.map((d) => ({ ...d, assessmentId: 'assessment-1' })),
      );
    }

    function jobFindManyWhere(): Record<string, any> {
      return mockPrisma.job.findMany.mock.calls[0][0].where;
    }

    beforeEach(() => {
      mockPrisma.assessment.findUniqueOrThrow.mockResolvedValue({
        id: 'assessment-1',
        intakeMode: 'UPLOAD',
        country: 'Kenya',
      });
      mockPrisma.assessment.update.mockResolvedValue({});
      mockPrisma.gapField.deleteMany.mockResolvedValue({ count: 10 });
      mockPrisma.gapField.createMany.mockResolvedValue({ count: 10 });
      mockPrisma.prompt.findFirst.mockResolvedValue({
        systemPrompt: 'System prompt for {{country}}.',
        userPromptTemplate: 'User prompt for {{country}}: {{extracted_data}}',
      });
      mockBedrock.invokeModel.mockResolvedValue({
        output: JSON.stringify(createGapAIResponse()),
        tokensUsed: 100,
      });
    });

    it("[FR-DDP-001 / BR-DDP-001] issues exactly one job query, scoped by the current documents' parse job ids and by nothing else", async () => {
      seedJobStore([
        storedJob('job-A', 'A.pdf', "A's deleted content", new Date('2026-01-01T00:00:00Z')),
        storedJob('job-B', 'B.pdf', "B's content", new Date('2026-01-02T00:00:00Z')),
      ]);
      seedCurrentDocuments([{ id: 'doc-B', parseJobId: 'job-B' }]); // A was deleted

      await handler.execute({ assessmentId: 'assessment-1' });

      // The traversal happens at all, and against this assessment's documents.
      expect(mockPrisma.assessmentDocument.findMany).toHaveBeenCalledWith({
        where: { assessmentId: 'assessment-1' },
      });

      // `toHaveBeenCalledWith` is a recursive equality, so an extra surviving
      // `input`-scoped clause (the pre-fix query), a widened id set, or a
      // dropped type / status / order filter all fail here — on the QUERY the
      // handler issues, not on the merged output. The three fixtures above
      // assert only the output, so none of them can fail on this.
      expect(mockPrisma.job.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.job.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['job-B'] },
          type: 'PARSE_DOCUMENT',
          status: 'COMPLETED',
        },
        orderBy: { completedAt: 'asc' },
      });
    });

    it('[FR-DDP-001 Sc1 / BR-DDP-001] resolves nothing when no documents remain — the orphaned job never reaches the model, and sourceParseJobIds is an empty array rather than an absent key', async () => {
      seedJobStore([
        storedJob('job-A', 'A.pdf', "A's deleted content", new Date('2026-01-01T00:00:00Z')),
      ]);
      seedCurrentDocuments([]); // the only document was deleted, nothing uploaded

      const result = await handler.execute({ assessmentId: 'assessment-1' });

      // Not short-circuited and not fallen back on: the job query is still
      // issued, scoped to the (empty) current set.
      expect(jobFindManyWhere().id).toEqual({ in: [] });
      expect(result.mergedMarkdown).toBe('');
      // The strongest available form of "A's content does not appear": it never
      // reached Bedrock at all.
      expect(mockBedrock.invokeModel).not.toHaveBeenCalled();

      // design.md §7.3 — an empty array is a complete record of a run that
      // genuinely had nothing to analyse and is NEVER superseded; an ABSENT key
      // is a pre-fix snapshot and fails closed. getMergedContent cannot tell
      // those apart if this run records the wrong one, so the distinction is
      // asserted here and not merely the value.
      expect('sourceParseJobIds' in result).toBe(true);
      expect(result.sourceParseJobIds).toEqual([]);
    });

    it('[FR-DDP-001 / BR-DDP-001] drops a current document whose parseJobId is null instead of passing null into the job id filter', async () => {
      seedJobStore([
        storedJob('job-B', 'B.pdf', "B's content", new Date('2026-01-02T00:00:00Z')),
      ]);
      seedCurrentDocuments([
        { id: 'doc-A', parseJobId: null }, // uploaded, parse not yet linked
        { id: 'doc-B', parseJobId: 'job-B' },
      ]);

      const result = await handler.execute({ assessmentId: 'assessment-1' });

      // `.map(d => d.parseJobId)` without the null filter yields
      // `in: [null, 'job-B']`, which real Prisma rejects for a String column —
      // a runtime failure of every UPLOAD analysis that has an unparsed
      // document, which is the normal state moments after any upload.
      expect(jobFindManyWhere().id).toEqual({ in: ['job-B'] });
      expect(result.mergedMarkdown).toBe("## Document: B.pdf\n\nB's content");
    });

    it('[FR-DDP-001 / BR-DDP-002] excludes a current document whose parse job never completed, and records only the RESOLVED job ids in sourceParseJobIds', async () => {
      seedJobStore([
        storedJob(
          'job-A',
          'A.pdf',
          "A's half-parsed text",
          new Date('2026-01-01T00:00:00Z'),
          'FAILED',
        ),
        storedJob('job-B', 'B.pdf', "B's content", new Date('2026-01-02T00:00:00Z')),
      ]);
      seedCurrentDocuments([
        { id: 'doc-A', parseJobId: 'job-A' },
        { id: 'doc-B', parseJobId: 'job-B' },
      ]);

      const result = await handler.execute({ assessmentId: 'assessment-1' });

      // All three fixtures above use only COMPLETED jobs, so none of them can
      // fail on a dropped `status: 'COMPLETED'` filter. This one can.
      expect(result.mergedMarkdown).not.toContain("A's half-parsed text");
      expect(result.mergedMarkdown).not.toContain('A.pdf');
      expect(result.mergedMarkdown).toBe("## Document: B.pdf\n\nB's content");

      // Recording `currentParseJobIds` instead of the resolved jobs would put
      // job-A into the snapshot. Re-parsing A then repoints doc-A at a new job,
      // job-A stops being any document's parseJobId, and §7.3's subtraction
      // marks SUPERSEDED a snapshot that never contained a word of A — the
      // false-withhold class BR-DDP-002 exists to forbid.
      expect(result.sourceParseJobIds).toEqual(['job-B']);
    });

    it('[FR-DDP-001 Sc2 / Sc3] orders four surviving documents by parse completion time, not by the order the document rows come back in', async () => {
      // Store order is deliberately neither completion order nor document-row
      // order, so an implementation that drops `orderBy` fails here too.
      seedJobStore([
        storedJob('job-3', 'Third.pdf', 'third content', new Date('2026-03-01T00:00:00Z')),
        storedJob('job-1', 'First.pdf', 'first content', new Date('2026-01-01T00:00:00Z')),
        storedJob('job-4', 'Fourth.pdf', 'fourth content', new Date('2026-04-01T00:00:00Z')),
        storedJob('job-2', 'Second.pdf', 'second content', new Date('2026-02-01T00:00:00Z')),
      ]);
      seedCurrentDocuments([
        { id: 'doc-4', parseJobId: 'job-4' },
        { id: 'doc-2', parseJobId: 'job-2' },
        { id: 'doc-1', parseJobId: 'job-1' },
        { id: 'doc-3', parseJobId: 'job-3' },
      ]);

      const result = await handler.execute({ assessmentId: 'assessment-1' });

      // A per-document lookup (`currentDocuments.map(d => findJob(d.parseJobId))`)
      // is a plausible reading of §7.1 step 2 and produces document-row order.
      // The Sc2 fixture above cannot catch it: there the document rows happen to
      // be in completion order already. Here they deliberately are not.
      expect(result.mergedMarkdown).toBe(
        '## Document: First.pdf\n\nfirst content\n\n---\n\n' +
          '## Document: Second.pdf\n\nsecond content\n\n---\n\n' +
          '## Document: Third.pdf\n\nthird content\n\n---\n\n' +
          '## Document: Fourth.pdf\n\nfourth content',
      );
      expect(result.sourceParseJobIds).toEqual(['job-1', 'job-2', 'job-3', 'job-4']);
    });
  });
});
