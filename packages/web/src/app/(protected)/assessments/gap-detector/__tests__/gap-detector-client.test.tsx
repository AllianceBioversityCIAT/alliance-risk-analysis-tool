import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GapDetectorClient from '../gap-detector-client';
import { GapFieldStatus, JobStatus } from '@alliance-risk/shared';
import type { AssessmentDetail } from '@alliance-risk/shared';

// ─── Module mocks ─────────────────────────────────────────────────────────────

const mockPost = jest.fn();
jest.mock('@/lib/api-client', () => ({
  __esModule: true,
  default: {
    post: (...args: unknown[]) => mockPost(...args),
    get: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

const sileoSuccess = jest.fn();
const sileoError = jest.fn();
const sileoWarning = jest.fn();
jest.mock('sileo', () => ({
  sileo: {
    success: (...args: unknown[]) => sileoSuccess(...args),
    error: (...args: unknown[]) => sileoError(...args),
    warning: (...args: unknown[]) => sileoWarning(...args),
    info: jest.fn(),
    promise: jest.fn(),
    action: jest.fn(),
  },
}));

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: () => 'assessment-1' }),
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

// next/dynamic — replace the lazily-imported DocumentViewer with a stub so we
// never touch the real (markdown-heavy) component. The stub renders enough
// of the real "Re-analyse now" contract (an onClick trigger gated by a
// disabled prop) that T-007 Gap 2's in-flight wiring — computed in
// gap-detector-client.tsx and passed down as a prop, exactly like
// `documentsLoading` — can be exercised without rendering the real,
// markdown-heavy DocumentViewer.
jest.mock('next/dynamic', () => () => {
  function DocumentViewerStub(props: {
    onReAnalyze?: () => void;
    reAnalyzeInFlight?: boolean;
  }) {
    return (
      <div data-testid="document-viewer-stub">
        {props.onReAnalyze && (
          <button
            type="button"
            onClick={props.onReAnalyze}
            disabled={!!props.reAnalyzeInFlight}
          >
            {props.reAnalyzeInFlight ? 'Re-analysing…' : 'Re-analyse now'}
          </button>
        )}
      </div>
    );
  }
  DocumentViewerStub.displayName = 'DocumentViewerStub';
  return DocumentViewerStub;
});

// SidebarTrigger requires a SidebarProvider context we don't render here.
jest.mock('@/components/ui/sidebar', () => ({
  SidebarTrigger: () => <button type="button" aria-label="Toggle sidebar" />,
}));

// Radix Tooltip isn't part of the `__mocks__/radix-ui.js` bundle mock —
// stub it as simple passthroughs (not under test here; the Dialog is).
jest.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockInvalidateQueries = jest.fn();
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

let mockAssessment: Partial<AssessmentDetail> | undefined;
let mockAssessmentLoading = false;
const mockUpdateAssessment = jest.fn().mockResolvedValue(undefined);
jest.mock('@/hooks/use-assessments', () => ({
  useAssessment: () => ({ data: mockAssessment, isLoading: mockAssessmentLoading }),
  useUpdateAssessment: () => ({ mutateAsync: mockUpdateAssessment, isPending: false }),
}));

let mockGapData: {
  data: Array<{
    id: string;
    field: string;
    label: string;
    category: string;
    correctedValue: string | null;
    extractedValue: string | null;
    status: GapFieldStatus;
    isMandatory: boolean;
    confidence: number | null;
    aiReasoning: string | null;
    validationFeedback: string | null;
  }>;
  total: number;
  verifiedCount: number;
  allMandatoryComplete: boolean;
} = {
  data: [
    {
      id: 'field-1',
      field: 'country_of_operation',
      label: 'Country of Operation',
      category: 'Company Profile',
      correctedValue: 'Kenya',
      extractedValue: 'Kenya',
      status: GapFieldStatus.VERIFIED,
      isMandatory: true,
      confidence: 0.9,
      aiReasoning: null,
      validationFeedback: null,
    },
  ],
  // Starts at 0 to mirror useGapFields()'s real poll-until-populated behavior
  // (data is undefined/total 0 until the async GAP_DETECTION job completes) —
  // this is also the correct baseline for the DD-CMV-008 cache-invalidation
  // tests below, which assert on the 0 -> positive transition specifically.
  total: 0,
  verifiedCount: 1,
  allMandatoryComplete: true,
};
const mockUpdateFields = jest.fn().mockResolvedValue(undefined);
const mockReAnalyze = jest.fn().mockResolvedValue({ jobId: 'job-1' });
jest.mock('@/hooks/use-gap-detection', () => ({
  useGapFields: () => ({ data: mockGapData, isLoading: false }),
  useUpdateGapFields: () => ({ mutateAsync: mockUpdateFields }),
  useReAnalyzeGaps: () => ({ mutateAsync: mockReAnalyze }),
}));

let mockJobStatus: JobStatus | null = null;
const mockStartPolling = jest.fn();
jest.mock('@/hooks/use-job-polling', () => ({
  useJobPolling: () => ({
    startPolling: mockStartPolling,
    isProcessing: false,
    status: mockJobStatus,
  }),
}));

jest.mock('@/hooks/use-merged-content', () => ({
  useMergedContent: () => ({ data: { mergedMarkdown: null } }),
}));

jest.mock('@/hooks/use-multi-document-status', () => ({
  useMultiDocumentStatus: () => ({
    documents: [],
    allParsed: true,
    isProcessing: false,
  }),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function baseAssessment(overrides: Partial<AssessmentDetail> = {}): Partial<AssessmentDetail> {
  return {
    id: 'assessment-1',
    name: 'Test Assessment',
    companyName: 'Acme Co',
    companyType: null,
    country: 'Kenya',
    detectedCountry: null,
    status: 'ACTION_REQUIRED' as AssessmentDetail['status'],
    intakeMode: 'UPLOAD' as AssessmentDetail['intakeMode'],
    progress: 50,
    version: 1,
    overallRiskScore: null,
    overallRiskLevel: null,
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

async function clickAnalyzeRisks() {
  const user = userEvent.setup();
  const button = screen.getByRole('button', { name: /analyze risks/i });
  await user.click(button);
  return user;
}

describe('GapDetectorClient — country mismatch validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAssessmentLoading = false;
    mockJobStatus = null;
    mockPost.mockResolvedValue({ data: {} });
    mockGapData = {
      ...mockGapData,
      allMandatoryComplete: true,
    };
  });

  describe('dialog visibility (BR-CMV-001)', () => {
    it('does NOT show the dialog when detectedCountry matches assessment.country', async () => {
      mockAssessment = baseAssessment({ country: 'Kenya', detectedCountry: 'Kenya' });
      render(<GapDetectorClient />);

      await clickAnalyzeRisks();

      expect(screen.queryByText(/double-check the country/i)).not.toBeInTheDocument();
      await waitFor(() => expect(mockPost).toHaveBeenCalledWith(
        '/api/assessments/assessment-1/gap-fields/submit',
      ));
    });

    it('does NOT show the dialog when detectedCountry is null', async () => {
      mockAssessment = baseAssessment({ country: 'Kenya', detectedCountry: null });
      render(<GapDetectorClient />);

      await clickAnalyzeRisks();

      expect(screen.queryByText(/double-check the country/i)).not.toBeInTheDocument();
      await waitFor(() => expect(mockPost).toHaveBeenCalled());
    });

    it('shows the dialog on a true mismatch (supported country, different from assessment.country)', async () => {
      mockAssessment = baseAssessment({ country: 'Kenya', detectedCountry: 'Zambia' });
      render(<GapDetectorClient />);

      await clickAnalyzeRisks();

      expect(await screen.findByText(/double-check the country/i)).toBeInTheDocument();
      // No submit call should have fired yet — dialog blocks it until a choice is made.
      expect(mockPost).not.toHaveBeenCalled();
    });

    // Revised 2026-08-19 (BR-CMV-001 widened, DD-CMV-007): the backend no
    // longer restricts `detectedCountry` to the 4-country allowlist — any
    // confidently-detected country is a valid mismatch signal, including one
    // outside the 4 supported countries. Previously this scenario (using
    // "Atlantis") asserted the dialog was SKIPPED; that assumption is now
    // wrong per FR-CMV-002 Scenario 1b. Using "Malawi" to mirror the real
    // bug report (a document describing Malawi against a selected
    // Nigeria/Kenya) for consistency with the backend Implementer's test
    // choice (gap-detection.handler.spec.ts).
    it('SHOWS the dialog when detectedCountry is a confidently-detected country outside the 4-country allowlist (FR-CMV-002 Sc1b)', async () => {
      mockAssessment = baseAssessment({ country: 'Kenya', detectedCountry: 'Malawi' });
      render(<GapDetectorClient />);

      await clickAnalyzeRisks();

      expect(await screen.findByText(/double-check the country/i)).toBeInTheDocument();
      // No submit call should have fired yet — dialog blocks it until a choice is made.
      expect(mockPost).not.toHaveBeenCalled();
    });
  });

  describe('"Continue anyway" (FR-CMV-003)', () => {
    it('calls the exact same submit endpoint as the no-mismatch path', async () => {
      mockAssessment = baseAssessment({ country: 'Kenya', detectedCountry: 'Zambia' });
      render(<GapDetectorClient />);

      const user = await clickAnalyzeRisks();
      await screen.findByText(/double-check the country/i);

      await user.click(screen.getByRole('button', { name: /continue anyway/i }));

      await waitFor(() =>
        expect(mockPost).toHaveBeenCalledWith('/api/assessments/assessment-1/gap-fields/submit'),
      );
      expect(mockPush).toHaveBeenCalledWith('/assessments/risk-scorecard?id=assessment-1');
    });
  });

  describe('"Cancel" (FR-CMV-004)', () => {
    it('fires zero apiClient calls, closes the dialog, and shows the hint banner with both countries and both remediation paths', async () => {
      mockAssessment = baseAssessment({ country: 'Kenya', detectedCountry: 'Zambia' });
      render(<GapDetectorClient />);

      const user = await clickAnalyzeRisks();
      await screen.findByText(/double-check the country/i);

      await user.click(screen.getByRole('button', { name: /^cancel$/i }));

      expect(screen.queryByText(/double-check the country/i)).not.toBeInTheDocument();
      expect(mockPost).not.toHaveBeenCalled();

      // Hint banner shows both countries and both remediation paths.
      const hint = within(await screen.findByTestId('country-mismatch-hint'));
      expect(hint.getByText(/kenya/i)).toBeInTheDocument();
      expect(hint.getByText(/zambia/i)).toBeInTheDocument();
      expect(hint.getByText(/manage documents/i)).toBeInTheDocument();
      expect(hint.getByText(/start a new assessment/i)).toBeInTheDocument();
    });

    it('re-shows the dialog on a subsequent "Analyze Risks" click while the mismatch is still unresolved (FR-CMV-004 Sc2)', async () => {
      mockAssessment = baseAssessment({ country: 'Kenya', detectedCountry: 'Zambia' });
      render(<GapDetectorClient />);

      const user = await clickAnalyzeRisks();
      await screen.findByText(/double-check the country/i);
      await user.click(screen.getByRole('button', { name: /^cancel$/i }));
      expect(screen.queryByText(/double-check the country/i)).not.toBeInTheDocument();

      // Click "Analyze Risks" again — the dialog must reappear, not be
      // permanently suppressed.
      await user.click(screen.getByRole('button', { name: /analyze risks/i }));
      expect(await screen.findByText(/double-check the country/i)).toBeInTheDocument();
    });
  });

  describe('hint banner dismiss button (FR-CMV-005 Sc1 — "dismissible")', () => {
    it('hides the hint banner when its own Dismiss button is clicked', async () => {
      mockAssessment = baseAssessment({ country: 'Kenya', detectedCountry: 'Zambia' });
      render(<GapDetectorClient />);

      const user = await clickAnalyzeRisks();
      await screen.findByText(/double-check the country/i);
      await user.click(screen.getByRole('button', { name: /^cancel$/i }));

      const hint = await screen.findByTestId('country-mismatch-hint');
      const dismissButton = within(hint).getByRole('button', { name: /dismiss/i });

      await user.click(dismissButton);

      expect(screen.queryByTestId('country-mismatch-hint')).not.toBeInTheDocument();
    });
  });

  describe('hint banner auto-clear', () => {
    it('clears the hint banner once a re-fetched assessment.detectedCountry no longer mismatches', async () => {
      mockAssessment = baseAssessment({ country: 'Kenya', detectedCountry: 'Zambia' });
      const { rerender } = render(<GapDetectorClient />);

      const user = await clickAnalyzeRisks();
      await screen.findByText(/double-check the country/i);
      await user.click(screen.getByRole('button', { name: /^cancel$/i }));
      expect(await screen.findByTestId('country-mismatch-hint')).toBeInTheDocument();

      // Simulate the query cache refreshing with a resolved mismatch.
      mockAssessment = baseAssessment({ country: 'Kenya', detectedCountry: 'Kenya' });
      rerender(<GapDetectorClient />);

      await waitFor(() =>
        expect(screen.queryByTestId('country-mismatch-hint')).not.toBeInTheDocument(),
      );
    });
  });

  describe('cache invalidation on re-analysis completion (FR-CMV-006 Sc1)', () => {
    it('invalidates the ["assessment", id] query when jobStatus transitions to COMPLETED', () => {
      mockAssessment = baseAssessment({ country: 'Kenya', detectedCountry: 'Kenya' });
      mockJobStatus = JobStatus.COMPLETED;
      render(<GapDetectorClient />);

      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ['assessment', 'assessment-1'],
      });
    });

    it('does not invalidate when jobStatus is not COMPLETED', () => {
      mockAssessment = baseAssessment({ country: 'Kenya', detectedCountry: 'Kenya' });
      mockJobStatus = null;
      render(<GapDetectorClient />);

      expect(mockInvalidateQueries).not.toHaveBeenCalled();
    });
  });

  describe('"Re-analyse now" in-flight guard (T-007 Gap 2)', () => {
    // Catches the naive fix: a guard keyed only on the re-analyze mutation's
    // own pending state. `mockReAnalyze` resolves immediately (it is a
    // `mockResolvedValue`, not a pending promise), so by the time this test
    // asserts, the mutation itself has long since settled — exactly the
    // "resolved but the job has not terminated" window the naive guard
    // misses, since `mockJobStatus` (the mocked useJobPolling `status`) is
    // still `null`, i.e. not yet COMPLETED or FAILED. A guard based only on
    // the mutation's pending flag would already read as idle here and
    // re-enable the button; the fix must not.
    it('disables the button after the kickoff mutation resolves but before the job reaches a terminal state', async () => {
      mockAssessment = baseAssessment({ country: 'Kenya', detectedCountry: 'Kenya' });
      mockJobStatus = null;
      const user = userEvent.setup();
      const { rerender } = render(<GapDetectorClient />);

      const initialButton = screen.getByRole('button', { name: /re-analyse now/i });
      expect(initialButton).not.toBeDisabled();

      await user.click(initialButton);

      // The kickoff mutation has resolved and startPolling was called with
      // its jobId — but no job status has arrived yet (mockJobStatus is
      // still null, matching the mocked useJobPolling's fixed `status`).
      await waitFor(() => expect(mockStartPolling).toHaveBeenCalledWith('job-1'));
      rerender(<GapDetectorClient />);

      expect(screen.getByRole('button', { name: /re-analysing/i })).toBeDisabled();

      // A second click while disabled must not enqueue a second run.
      expect(mockReAnalyze).toHaveBeenCalledTimes(1);
    });

    it('re-enables the button once the job reaches a terminal state (COMPLETED)', async () => {
      mockAssessment = baseAssessment({ country: 'Kenya', detectedCountry: 'Kenya' });
      mockJobStatus = null;
      const user = userEvent.setup();
      const { rerender } = render(<GapDetectorClient />);

      await user.click(screen.getByRole('button', { name: /re-analyse now/i }));
      await waitFor(() => expect(mockStartPolling).toHaveBeenCalledWith('job-1'));
      rerender(<GapDetectorClient />);
      expect(screen.getByRole('button', { name: /re-analysing/i })).toBeDisabled();

      mockJobStatus = JobStatus.COMPLETED;
      rerender(<GapDetectorClient />);

      expect(screen.getByRole('button', { name: /^re-analyse now$/i })).not.toBeDisabled();
    });

    it('re-enables the button if the job instead reaches a terminal state (FAILED)', async () => {
      mockAssessment = baseAssessment({ country: 'Kenya', detectedCountry: 'Kenya' });
      mockJobStatus = null;
      const user = userEvent.setup();
      const { rerender } = render(<GapDetectorClient />);

      await user.click(screen.getByRole('button', { name: /re-analyse now/i }));
      await waitFor(() => expect(mockStartPolling).toHaveBeenCalledWith('job-1'));
      rerender(<GapDetectorClient />);
      expect(screen.getByRole('button', { name: /re-analysing/i })).toBeDisabled();

      mockJobStatus = JobStatus.FAILED;
      rerender(<GapDetectorClient />);

      expect(screen.getByRole('button', { name: /^re-analyse now$/i })).not.toBeDisabled();
    });
  });

  // ─── QA Tester independent completeness pass ─────────────────────────────────
  // The 10 tests above (implementer + reviewer authored) were re-checked against
  // every FR-CMV-002..006/BR-CMV-001 scenario in requirements.md. The tests below
  // close the gaps found during that re-check; they do not duplicate the above.

  describe('dialog content completeness (FR-CMV-002 Sc1)', () => {
    // Gap: the existing "shows the dialog on a true mismatch" test only asserts
    // the dialog's title text appears — it never asserts the two country names
    // or the "non-blocking" statement the requirement explicitly mandates
    // ("AND IT MUST name both... AND IT MUST state the check does not block
    // analysis"). Scoped with getByRole('dialog') per the UX Testing Guidance
    // (accessible query over brittle text/class selectors).
    it('names both countries and states the check is non-blocking, inside role="dialog"', async () => {
      mockAssessment = baseAssessment({ country: 'Kenya', detectedCountry: 'Zambia' });
      render(<GapDetectorClient />);

      await clickAnalyzeRisks();

      const dialog = within(await screen.findByRole('dialog'));
      expect(dialog.getByText(/kenya/i)).toBeInTheDocument();
      expect(dialog.getByText(/zambia/i)).toBeInTheDocument();
      expect(dialog.getByText(/won.t block your analysis/i)).toBeInTheDocument();
    });
  });

  describe('"Cancel" does not navigate away (FR-CMV-004 Sc1 completeness)', () => {
    // Gap: the existing Cancel test asserts zero apiClient calls but never
    // asserts the Analyst stays on the gap detector screen ("BUT it must NOT
    // navigate the Analyst away").
    it('does not call router.push when Cancel is clicked', async () => {
      mockAssessment = baseAssessment({ country: 'Kenya', detectedCountry: 'Zambia' });
      render(<GapDetectorClient />);

      const user = await clickAnalyzeRisks();
      await screen.findByRole('dialog');
      await user.click(screen.getByRole('button', { name: /^cancel$/i }));

      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe('dismiss via the dialog\'s built-in Close (X) control — documents accepted behavior (T-005 Reviewer ADVISORY #1)', () => {
    // The Reviewer flagged (non-blocking) that dismissing via Escape/overlay-click/X
    // doesn't set showCountryMismatchHint, unlike the Cancel button — judged
    // conformant to design.md's literal Cancel-triggered wording, not a defect.
    // This test does not assert that behavior is *ideal*; it pins the CURRENT,
    // accepted behavior so a future change can't silently flip it unnoticed.
    it('closing via the dialog\'s Close control does NOT show the hint banner, unlike Cancel; the dialog still reappears next click', async () => {
      mockAssessment = baseAssessment({ country: 'Kenya', detectedCountry: 'Zambia' });
      render(<GapDetectorClient />);

      const user = await clickAnalyzeRisks();
      await screen.findByRole('dialog');

      await user.click(screen.getByRole('button', { name: /close/i }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(mockPost).not.toHaveBeenCalled();
      // Accepted current behavior: unlike Cancel, the built-in Close control
      // does not surface the remediation hint.
      expect(screen.queryByTestId('country-mismatch-hint')).not.toBeInTheDocument();

      // Same non-suppression guarantee as Cancel (FR-CMV-004 Sc2): the dialog
      // is not permanently dismissed for the assessment/session.
      await user.click(screen.getByRole('button', { name: /analyze risks/i }));
      expect(await screen.findByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('happy-path flow clarity — no mismatch ever occurred', () => {
    // State-transition check: when detectedCountry has always matched
    // assessment.country, neither the dialog nor the hint banner should ever
    // appear, before or after a successful submit.
    it('never shows the dialog or the hint banner when there was never a mismatch', async () => {
      mockAssessment = baseAssessment({ country: 'Kenya', detectedCountry: 'Kenya' });
      render(<GapDetectorClient />);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.queryByTestId('country-mismatch-hint')).not.toBeInTheDocument();

      await clickAnalyzeRisks();

      await waitFor(() =>
        expect(mockPost).toHaveBeenCalledWith('/api/assessments/assessment-1/gap-fields/submit'),
      );
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.queryByTestId('country-mismatch-hint')).not.toBeInTheDocument();
    });
  });

  describe('cache invalidation on the initial (non-re-analyze) gap-detection run (FR-CMV-006 Sc2 / DD-CMV-008)', () => {
    // This is the fix for the real bug: the very first, automatic
    // GAP_DETECTION job never touches `jobStatus` (useJobPolling is only
    // started for the re-analyze flow), so the screen must independently
    // invalidate ['assessment', id] when useGapFields()'s own
    // poll-until-populated signal (gapData.total) transitions from 0 to a
    // positive count.
    it('invalidates ["assessment", id], ["merged-content", id], and ["gap-fields", id] when gapData.total transitions from 0 to positive', () => {
      mockAssessment = baseAssessment({ country: 'Kenya', detectedCountry: 'Kenya' });
      mockGapData = { ...mockGapData, total: 0, data: [] };
      const { rerender } = render(<GapDetectorClient />);

      // No fields yet — the transition hasn't happened, so no invalidation.
      expect(mockInvalidateQueries).not.toHaveBeenCalled();

      // Simulate the automatic GAP_DETECTION job completing: useGapFields()'s
      // poll-until-populated behavior now returns a positive total.
      mockGapData = { ...mockGapData, total: 1 };
      rerender(<GapDetectorClient />);

      // design.md §8.3: this completion effect now invalidates THREE keys per
      // firing (assessment, merged-content, gap-fields), not one — the count
      // moved from 1 to 3 because the fix's surface grew, not because the
      // one-shot guarantee weakened. The next test isolates that guarantee.
      expect(mockInvalidateQueries).toHaveBeenCalledTimes(3);
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ['assessment', 'assessment-1'],
      });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ['merged-content', 'assessment-1'],
      });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ['gap-fields', 'assessment-1'],
      });
    });

    it('does NOT invalidate ["assessment", id] again once total is already positive and stays positive across further re-renders (ref-based one-shot)', () => {
      mockAssessment = baseAssessment({ country: 'Kenya', detectedCountry: 'Kenya' });
      mockGapData = { ...mockGapData, total: 0, data: [] };
      const { rerender } = render(<GapDetectorClient />);

      // Count firings of the ['assessment', id] invalidation specifically,
      // not raw invalidateQueries call totals. design.md §8.3 made one
      // firing of this effect invalidate three keys instead of one, so a
      // raw-count assertion breaks every time a key is added even though
      // the one-shot property it was meant to express still holds — that
      // is exactly what happened to this test before this retarget.
      const assessmentInvalidations = () =>
        mockInvalidateQueries.mock.calls.filter(
          ([arg]) =>
            JSON.stringify(arg?.queryKey) === JSON.stringify(['assessment', 'assessment-1']),
        );

      // Trigger the one, legitimate 0 -> positive transition.
      mockGapData = { ...mockGapData, total: 1 };
      rerender(<GapDetectorClient />);
      expect(assessmentInvalidations()).toHaveLength(1);

      // Re-render with the same positive total — proves the ref actually
      // gates on the transition itself, not merely "total is truthy".
      mockGapData = { ...mockGapData, total: 1 };
      rerender(<GapDetectorClient />);
      expect(assessmentInvalidations()).toHaveLength(1);

      // Re-render with a different, still-positive total — a positive ->
      // positive change must not be mistaken for a new 0 -> positive
      // transition either.
      mockGapData = { ...mockGapData, total: 2 };
      rerender(<GapDetectorClient />);
      expect(assessmentInvalidations()).toHaveLength(1);
    });
  });

  // ─── T-009 — `prevGapTotalRef = useRef(0)` (gap-detector-client.tsx:247)
  // resets on every mount, so the 0 -> positive effect above fires once per
  // *mount*, not once per assessment lifetime. This is undocumented but
  // load-bearing: it is why navigation-based journeys (leave the Gap
  // Detector, come back) mostly self-heal today even without T-009's other
  // fixes. T-009 explicitly must NOT seed this ref from cached data — doing
  // so reads like the obviously-correct change and would silently remove
  // this refresh path, since a re-mount on an already-analysed assessment
  // would then see the ref pre-seeded to the same positive total and never
  // observe a 0 -> positive transition. This test exists because no test
  // covered this before T-009. ────────────────────────────────────────────
  describe('mount-time refresh — prevGapTotalRef re-arms on every fresh mount (undocumented, load-bearing; T-009)', () => {
    it('fires the 0 -> positive invalidation again on a fresh mount of an assessment that already has fields, not only on the first mount ever', () => {
      mockAssessment = baseAssessment({ country: 'Kenya', detectedCountry: 'Kenya' });
      // Simulate returning to an assessment that was already analysed in a
      // prior visit — gapData.total starts positive from the very first
      // render this component instance ever does.
      mockGapData = { ...mockGapData, total: 5 };

      const assessmentInvalidations = () =>
        mockInvalidateQueries.mock.calls.filter(
          ([arg]) =>
            JSON.stringify(arg?.queryKey) === JSON.stringify(['assessment', 'assessment-1']),
        );

      const first = render(<GapDetectorClient />);
      // useRef(0) starts at 0 on this fresh mount, and total (5) is already
      // positive on the very first render, so the transition fires
      // immediately — this is the "fires once per mount for any assessment
      // with fields" behaviour the task description calls out.
      expect(assessmentInvalidations()).toHaveLength(1);

      first.unmount();
      mockInvalidateQueries.mockClear();

      // A second, independent mount — e.g. the Analyst navigated away and
      // back. `mockGapData.total` is unchanged (still 5, still positive).
      // An implementation that seeds `prevGapTotalRef` from a cached value
      // (the exact "obviously correct" change T-009 forbids) would start
      // this ref already at 5, never observe 0 -> positive, and this
      // assertion would fail with zero invalidations. `useRef(0)`
      // re-initializing on every mount is what makes it pass.
      render(<GapDetectorClient />);
      expect(assessmentInvalidations()).toHaveLength(1);
    });
  });
});
