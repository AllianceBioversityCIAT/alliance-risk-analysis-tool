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
// never touch the real (markdown-heavy) component.
jest.mock('next/dynamic', () => () => {
  function DocumentViewerStub() {
    return <div data-testid="document-viewer-stub" />;
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
  total: 1,
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

    it('does NOT show the dialog when detectedCountry is an unsupported string', async () => {
      mockAssessment = baseAssessment({ country: 'Kenya', detectedCountry: 'Atlantis' });
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
});
