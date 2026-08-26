import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, type AxiosResponse } from 'axios';
import { sileo } from 'sileo';
import { UploadBusinessPlanModal } from '../upload-business-plan-modal';
import { DocumentStatus, type DocumentInfo } from '@alliance-risk/shared';

/**
 * FR-DDP-004 Scenario 3 — "A failed deletion is not reported as success"
 *
 *   GIVEN a deletion that fails server-side for any reason other than the
 *         document already being gone
 *   WHEN  the Analyst removes the document in the UI
 *   THEN  the failure is surfaced and the document remains listed
 *   BUT it must NOT disappear from the list, since that reproduces this very
 *         bug with a stronger illusion of success
 *
 * This suite is about what the *modal* does to its own file list. The cache
 * invalidation that `useDeleteDocument` performs on a 404 is a different seam
 * and is covered by `use-multi-document-status.test.ts` — it is deliberately
 * not re-asserted here.
 */

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockDeleteDocument = jest.fn();
const mockTriggerParseAll = jest.fn();
const mockRequestUploadUrl = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

jest.mock('sileo', () => ({
  sileo: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

jest.mock('@/hooks/use-assessments', () => ({
  useRequestUploadUrl: () => ({ mutateAsync: mockRequestUploadUrl }),
}));

jest.mock('@/hooks/use-multi-document-status', () => ({
  useMultiDocumentStatus: (assessmentId: string, enabled: boolean) =>
    mockMultiDocumentStatus(enabled),
  useTriggerParseAll: () => ({ mutateAsync: mockTriggerParseAll }),
  useDeleteDocument: () => ({ mutateAsync: mockDeleteDocument }),
}));

const ASSESSMENT_ID = 'assessment-1';

const DOC_A: DocumentInfo = {
  id: 'doc-a',
  fileName: 'business-plan-a.pdf',
  mimeType: 'application/pdf',
  fileSize: 2048,
  status: DocumentStatus.PARSED,
  parseJobId: 'job-a',
  errorMessage: null,
  uploadedAt: '2026-08-01T00:00:00.000Z',
};

const DOC_B: DocumentInfo = {
  id: 'doc-b',
  fileName: 'budget-b.pdf',
  mimeType: 'application/pdf',
  fileSize: 4096,
  status: DocumentStatus.PARSED,
  parseJobId: 'job-b',
  errorMessage: null,
  uploadedAt: '2026-08-02T00:00:00.000Z',
};

/**
 * Stable array identities — the modal's load-existing-documents effect depends
 * on the array reference, so returning fresh literals per render would churn.
 */
const EXISTING_DOCS: DocumentInfo[] = [DOC_A, DOC_B];
const NO_DOCS: DocumentInfo[] = [];

/**
 * The modal calls `useMultiDocumentStatus` twice — once for parse polling
 * (disabled while selecting) and once to load already-uploaded documents
 * (enabled while selecting). Honouring `enabled` keeps the mock faithful to
 * that split.
 */
function mockMultiDocumentStatus(enabled: boolean) {
  const documents = enabled ? EXISTING_DOCS : NO_DOCS;
  return {
    documents,
    allParsed: documents.length > 0,
    anyFailed: false,
    isProcessing: false,
    isLoading: false,
    isSettled: enabled,
    refetch: jest.fn(),
  };
}

/** An error carrying an HTTP response, as axios produces for a 4xx/5xx. */
function axiosErrorWithStatus(status: number, message: string): AxiosError {
  const response = {
    status,
    statusText: String(status),
    data: { message },
    headers: {},
    config: { headers: {} },
  } as unknown as AxiosResponse;

  return new AxiosError(
    message,
    status === 404 ? 'ERR_BAD_REQUEST' : 'ERR_BAD_RESPONSE',
    undefined,
    {},
    response,
  );
}

/**
 * A transport-level failure: axios rejects with an AxiosError that has **no**
 * `response` at all. `err.response?.status` is `undefined`, which is not 404.
 */
function axiosNetworkError(): AxiosError {
  return new AxiosError('Network Error', AxiosError.ERR_NETWORK, undefined, {});
}

/** Renders the modal with DOC_A and DOC_B already listed as parsed documents. */
async function renderWithTwoExistingDocuments() {
  render(<UploadBusinessPlanModal assessmentId={ASSESSMENT_ID} />);
  expect(await screen.findByText(DOC_A.fileName)).toBeInTheDocument();
  expect(screen.getByText(DOC_B.fileName)).toBeInTheDocument();
}

/** Clicks the remove (×) button on the row for DOC_A (the first row). */
async function removeFirstDocument() {
  const user = userEvent.setup();
  const removeButtons = await screen.findAllByRole('button', {
    name: /remove file/i,
  });
  await user.click(removeButtons[0]);
}

describe('UploadBusinessPlanModal — removing a document', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDeleteDocument.mockResolvedValue(undefined);
  });

  // ── Control ────────────────────────────────────────────────────────────
  // Without this, every "the row stays listed" assertion below would also
  // pass against a modal that can never remove a row at all.

  it('[FR-DDP-004 Sc 3 control] removes the document from the list when the deletion succeeds', async () => {
    await renderWithTwoExistingDocuments();

    await removeFirstDocument();

    await waitFor(() => {
      expect(screen.queryByText(DOC_A.fileName)).not.toBeInTheDocument();
    });
    expect(mockDeleteDocument).toHaveBeenCalledWith({
      assessmentId: ASSESSMENT_ID,
      documentId: DOC_A.id,
    });
    expect(sileo.error).not.toHaveBeenCalled();
    // The untargeted row is untouched.
    expect(screen.getByText(DOC_B.fileName)).toBeInTheDocument();
  });

  // ── THEN "the failure is surfaced and the document remains listed" ─────

  it('[FR-DDP-004 Sc 3] surfaces the failure and keeps the document listed when the server returns 500', async () => {
    mockDeleteDocument.mockRejectedValue(
      axiosErrorWithStatus(500, 'Internal Server Error'),
    );
    await renderWithTwoExistingDocuments();

    await removeFirstDocument();

    // THEN the failure is surfaced.
    await waitFor(() => {
      expect(sileo.error).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Failed to remove document',
          description: expect.stringContaining('Internal Server Error'),
        }),
      );
    });

    // BUT it must NOT disappear from the list.
    expect(screen.getByText(DOC_A.fileName)).toBeInTheDocument();
    expect(screen.getByText(DOC_B.fileName)).toBeInTheDocument();
  });

  it('[FR-DDP-004 Sc 3] keeps the document listed when a 403 is returned — any non-404 status, not just 500', async () => {
    mockDeleteDocument.mockRejectedValue(
      axiosErrorWithStatus(403, 'Forbidden'),
    );
    await renderWithTwoExistingDocuments();

    await removeFirstDocument();

    await waitFor(() => {
      expect(sileo.error).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Failed to remove document' }),
      );
    });
    expect(screen.getByText(DOC_A.fileName)).toBeInTheDocument();
  });

  it('[FR-DDP-004 Sc 3] keeps the document listed when the request fails with no response at all', async () => {
    // An AxiosError whose `response` is undefined — offline, DNS failure, or a
    // dropped connection. The server state is unknown, so this is emphatically
    // not "the document is already gone".
    mockDeleteDocument.mockRejectedValue(axiosNetworkError());
    await renderWithTwoExistingDocuments();

    await removeFirstDocument();

    await waitFor(() => {
      expect(sileo.error).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Failed to remove document',
          description: expect.stringContaining('Network Error'),
        }),
      );
    });
    expect(screen.getByText(DOC_A.fileName)).toBeInTheDocument();
    expect(screen.getByText(DOC_B.fileName)).toBeInTheDocument();
  });

  it('[FR-DDP-004 Sc 3] keeps the document listed when the rejection is not an AxiosError', async () => {
    mockDeleteDocument.mockRejectedValue(new Error('Something else broke'));
    await renderWithTwoExistingDocuments();

    await removeFirstDocument();

    await waitFor(() => {
      expect(sileo.error).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Failed to remove document',
          description: expect.stringContaining('Something else broke'),
        }),
      );
    });
    expect(screen.getByText(DOC_A.fileName)).toBeInTheDocument();
  });

  it('[FR-DDP-004 Sc 3] leaves the failed row removable, so the Analyst can retry', async () => {
    mockDeleteDocument.mockRejectedValue(
      axiosErrorWithStatus(500, 'Internal Server Error'),
    );
    await renderWithTwoExistingDocuments();

    await removeFirstDocument();
    await waitFor(() => expect(sileo.error).toHaveBeenCalledTimes(1));

    // A row that "remains listed" but lost its affordance would strand the
    // Analyst with a document they cannot remove.
    mockDeleteDocument.mockResolvedValue(undefined);
    await removeFirstDocument();

    await waitFor(() => {
      expect(screen.queryByText(DOC_A.fileName)).not.toBeInTheDocument();
    });
    expect(mockDeleteDocument).toHaveBeenCalledTimes(2);
    expect(mockDeleteDocument).toHaveBeenLastCalledWith({
      assessmentId: ASSESSMENT_ID,
      documentId: DOC_A.id,
    });
  });

  // ── GIVEN "for any reason other than the document already being gone" ──
  // The scenario's exclusion. A 404 is the one failure that is not a failure:
  // the server already agrees the document is gone, so the Analyst's intent
  // is satisfied and the row must go.

  it('[FR-DDP-004 Sc 3 boundary] removes the document and raises no failure when the server returns 404', async () => {
    mockDeleteDocument.mockRejectedValue(
      axiosErrorWithStatus(404, 'Document not found'),
    );
    await renderWithTwoExistingDocuments();

    await removeFirstDocument();

    await waitFor(() => {
      expect(screen.queryByText(DOC_A.fileName)).not.toBeInTheDocument();
    });
    expect(sileo.error).not.toHaveBeenCalled();
    expect(screen.getByText(DOC_B.fileName)).toBeInTheDocument();
  });
});
