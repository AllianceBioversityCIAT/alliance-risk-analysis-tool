import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DocumentViewer } from '../document-viewer';

// react-markdown / remark-gfm are ESM-only and pull in a large unified/mdast
// dependency tree that Jest cannot transform out of the box. None of the
// states this suite exercises reach <ReactMarkdown> (they all return early
// on absent content), but the module is still imported unconditionally at
// the top of document-viewer.tsx, so it must be mocked regardless of which
// branch a given test exercises.
jest.mock('react-markdown', () => {
  return function ReactMarkdownMock({ children }: { children: string }) {
    return <div data-testid="markdown-content">{children}</div>;
  };
});
jest.mock('remark-gfm', () => () => undefined);

const DOCS = [
  { id: 'doc-1', fileName: 'plan.pdf', mimeType: 'application/pdf' },
];

describe('DocumentViewer — withheld content and empty states (FR-DDP-003)', () => {
  // ─── D6: the notice renders but must be legible and actionable, and must
  // be distinguishable from the ordinary empty state — not proven by mere
  // presence of *some* text. ─────────────────────────────────────────────

  describe('superseded — the withheld-content notice (FR-DDP-003 Sc 1)', () => {
    it('states the analysis no longer matches the current documents, without asserting a cause', () => {
      render(
        <DocumentViewer markdownContent={null} documents={DOCS} superseded />,
      );

      expect(
        screen.getByText(/this analysis no longer matches the current documents/i),
      ).toBeInTheDocument();
      // The copy must not assert deletion specifically — it covers deletion,
      // re-parsing, and pre-fix analyses alike (design.md §7.3, §8.1).
      expect(screen.queryByText(/deleted/i)).not.toBeInTheDocument();
    });

    it('is distinguishable from the ordinary "never analysed" empty state', () => {
      render(
        <DocumentViewer markdownContent={null} documents={DOCS} superseded />,
      );

      // The withheld notice must not reuse the empty-state copy — a reader
      // (or a test) checking only "some text rendered" could not tell these
      // apart; the exact strings must differ.
      expect(
        screen.queryByText('No document content available'),
      ).not.toBeInTheDocument();
      expect(screen.queryByTestId('document-empty-state')).not.toBeInTheDocument();
      expect(screen.getByTestId('document-withheld-notice')).toBeInTheDocument();
    });

    it('does not render any of the withheld document\'s text', () => {
      render(
        <DocumentViewer markdownContent={null} documents={DOCS} superseded />,
      );

      expect(screen.queryByTestId('markdown-content')).not.toBeInTheDocument();
    });

    it('offers a "Re-analyse now" action that calls onReAnalyze when clicked', async () => {
      const user = userEvent.setup();
      const onReAnalyze = jest.fn();
      render(
        <DocumentViewer
          markdownContent={null}
          documents={DOCS}
          superseded
          onReAnalyze={onReAnalyze}
        />,
      );

      const button = screen.getByRole('button', { name: /re-analyse now/i });
      await user.click(button);

      expect(onReAnalyze).toHaveBeenCalledTimes(1);
    });

    it('renders no re-analyse affordance when onReAnalyze is not provided', () => {
      render(
        <DocumentViewer markdownContent={null} documents={DOCS} superseded />,
      );

      expect(
        screen.queryByRole('button', { name: /re-analyse now/i }),
      ).not.toBeInTheDocument();
    });

    // ─── Rework (attempt 3): the withheld notice must carry a working remedy
    // even during the window where the caller's documents count is not yet
    // settled — `documents=[]` here stands in for "unknown", not "zero",
    // exactly as `documentsLoading` distinguishes it below. A caller that
    // withholds `onReAnalyze` until its own count settles (as the prior
    // attempt did, unconditionally on `documents.length > 0`) reproduces the
    // FR-DDP-003 violation one level up: an honest notice with no action for
    // the entire cold-load window. ─────────────────────────────────────────
    it('still offers a working "Re-analyse now" action while the documents count is unsettled', async () => {
      const user = userEvent.setup();
      const onReAnalyze = jest.fn();
      render(
        <DocumentViewer
          markdownContent={null}
          documents={[]}
          documentsLoading
          superseded
          onReAnalyze={onReAnalyze}
        />,
      );

      // Unsettled zero must not be mistaken for confirmed zero (FR-DDP-003
      // Sc 3's remedy — Manage Documents, no re-analyse — must not appear).
      expect(screen.queryByTestId('no-documents-notice')).not.toBeInTheDocument();
      expect(screen.getByTestId('document-withheld-notice')).toBeInTheDocument();

      const button = screen.getByRole('button', { name: /re-analyse now/i });
      await user.click(button);

      expect(onReAnalyze).toHaveBeenCalledTimes(1);
    });
  });

  describe('not superseded, no content, documents exist — the ordinary empty state (unchanged)', () => {
    it('shows "No document content available" with no re-analyse affordance', () => {
      render(
        <DocumentViewer
          markdownContent={null}
          documents={DOCS}
          superseded={false}
          onReAnalyze={jest.fn()}
        />,
      );

      expect(screen.getByText('No document content available')).toBeInTheDocument();
      expect(screen.getByTestId('document-empty-state')).toBeInTheDocument();
      expect(screen.queryByTestId('document-withheld-notice')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /re-analyse now/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe('zero documents remain — offers Manage Documents, not re-analysis (FR-DDP-003 Sc 3)', () => {
    it('states no documents remain and offers Manage Documents', () => {
      render(
        <DocumentViewer
          markdownContent={null}
          documents={[]}
          superseded
          onReAnalyze={jest.fn()}
        />,
      );

      expect(
        screen.getByText(/no documents remain on this assessment/i),
      ).toBeInTheDocument();
      expect(screen.getByTestId('no-documents-notice')).toBeInTheDocument();
    });

    it('takes priority over the superseded notice even when superseded is true', () => {
      render(
        <DocumentViewer
          markdownContent={null}
          documents={[]}
          superseded
          onReAnalyze={jest.fn()}
        />,
      );

      // Zero documents must never offer re-analysis — re-analysing with
      // nothing to analyse cannot produce content.
      expect(screen.queryByTestId('document-withheld-notice')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /re-analyse now/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(/this analysis no longer matches the current documents/i),
      ).not.toBeInTheDocument();
    });

    it('calls onManageDocuments when its button is clicked', async () => {
      const user = userEvent.setup();
      const onManageDocuments = jest.fn();
      render(
        <DocumentViewer
          markdownContent={null}
          documents={[]}
          onManageDocuments={onManageDocuments}
        />,
      );

      const button = screen.getByRole('button', { name: /manage documents/i });
      await user.click(button);

      expect(onManageDocuments).toHaveBeenCalledTimes(1);
    });

    it('renders no Manage Documents affordance when the callback is not provided', () => {
      render(<DocumentViewer markdownContent={null} documents={[]} />);

      expect(
        screen.queryByRole('button', { name: /manage documents/i }),
      ).not.toBeInTheDocument();
    });

    it('treats an omitted documents prop the same as an empty list', () => {
      render(<DocumentViewer markdownContent={null} onManageDocuments={jest.fn()} />);

      expect(screen.getByTestId('no-documents-notice')).toBeInTheDocument();
    });

    // ─── D7 (rework): the empty `documents` array is also what an
    // *unresolved* documents query reports (still disabled, still fetching,
    // or permanently errored) — not just a confirmed, truly-empty list. The
    // component must not assert "no documents remain" while that is merely
    // unknown; it must render the ordinary neutral empty state instead until
    // the caller confirms (via `documentsLoading={false}`) that zero is a
    // settled answer. ────────────────────────────────────────────────────
    it('while the documents query has not resolved, shows the ordinary empty state instead of asserting documents are gone', () => {
      render(
        <DocumentViewer
          markdownContent={null}
          documents={[]}
          documentsLoading
          onManageDocuments={jest.fn()}
        />,
      );

      expect(screen.getByTestId('document-empty-state')).toBeInTheDocument();
      expect(screen.queryByTestId('no-documents-notice')).not.toBeInTheDocument();
      expect(
        screen.queryByText(/no documents remain on this assessment/i),
      ).not.toBeInTheDocument();
    });
  });

  describe('content present — real content always takes priority', () => {
    it('renders the actual content even if documents is empty or superseded is true', () => {
      render(
        <DocumentViewer
          markdownContent="## Document: plan.pdf\n\nSome extracted text"
          documents={[]}
          superseded
        />,
      );

      // A caller that forgets to pass `documents`, or a stale `superseded`
      // flag alongside content the server contract says should not coexist
      // with it, must never hide content that is actually present.
      expect(screen.getByTestId('markdown-content')).toBeInTheDocument();
      expect(screen.queryByTestId('no-documents-notice')).not.toBeInTheDocument();
      expect(screen.queryByTestId('document-withheld-notice')).not.toBeInTheDocument();
    });
  });
});
