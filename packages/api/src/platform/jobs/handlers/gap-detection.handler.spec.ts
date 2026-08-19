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

describe('GapDetectionHandler', () => {
  const mockPrisma = {
    job: { findMany: jest.fn() },
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

    it('clears detectedCountry to null on zero completed parse jobs during a re-run, without createSkeletonFields() touching prisma.assessment', async () => {
      mockUploadAssessment();
      mockPrisma.job.findMany.mockResolvedValue([]); // zero completed PARSE_DOCUMENT jobs

      await handler.execute({ assessmentId: 'assessment-1', reAnalyze: true });

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
});
