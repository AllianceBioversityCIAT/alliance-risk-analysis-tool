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
    it('states the analysis is out of date, without asserting a cause', () => {
      render(
        <DocumentViewer markdownContent={null} documents={DOCS} superseded />,
      );

      expect(
        screen.getByText(/this analysis is out of date/i),
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

  // ─── T-009 — analysisInFlight, and its precedence over superseded
  // (design.md §8.1 v2.1: zero-documents → in-flight → superseded → content
  // → empty). History: v1.1 modelled in-flight as a sixth freshness state
  // and blanked valid content (finding R-1); v2.0 discarded the signal
  // entirely. These tests must fail against both: a v2.0-style component
  // that never reads `analysisInFlight` at all (falls through to the
  // superseded/empty branches unchanged), and a superseded-first ordering
  // that renders "out of date" even while a run is visibly in progress —
  // exactly what T-008 found in the browser. ────────────────────────────────
  describe('analysisInFlight — the "analysing" state and its precedence (FR-DDP-003 in-flight clause)', () => {
    it('shows an "Analysing your documents…" notice when in flight with no content yet', () => {
      render(
        <DocumentViewer
          markdownContent={null}
          documents={DOCS}
          superseded={false}
          analysisInFlight
        />,
      );

      expect(screen.getByTestId('document-analysing-notice')).toBeInTheDocument();
      expect(screen.getByText(/analysing your documents/i)).toBeInTheDocument();
    });

    it('is distinguishable from the withheld-content notice and the ordinary empty state', () => {
      render(
        <DocumentViewer
          markdownContent={null}
          documents={DOCS}
          superseded={false}
          analysisInFlight
        />,
      );

      expect(screen.queryByTestId('document-withheld-notice')).not.toBeInTheDocument();
      expect(screen.queryByTestId('document-empty-state')).not.toBeInTheDocument();
      expect(
        screen.queryByText(/this analysis is out of date/i),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText('No document content available'),
      ).not.toBeInTheDocument();
    });

    // ─── The disqualifier-proof test: this fixture sets BOTH
    // `analysisInFlight` and `superseded` to true. A superseded-first
    // implementation (or the pre-T-009 component, which does not know about
    // `analysisInFlight` at all and falls straight through to the
    // `superseded` branch) renders the withheld notice here; only an
    // in-flight-first precedence renders the analysing notice instead. ─────
    it('wins over superseded when both are true — the exact case T-008 found in the browser', () => {
      render(
        <DocumentViewer
          markdownContent={null}
          documents={DOCS}
          superseded
          analysisInFlight
          onReAnalyze={jest.fn()}
        />,
      );

      expect(screen.getByTestId('document-analysing-notice')).toBeInTheDocument();
      expect(screen.queryByTestId('document-withheld-notice')).not.toBeInTheDocument();
      expect(
        screen.queryByText(/this analysis is out of date/i),
      ).not.toBeInTheDocument();
      // The remedy button belongs to the withheld notice only — the
      // analysing state offers no action, since the "remedy" is already
      // running.
      expect(
        screen.queryByRole('button', { name: /re-analyse now/i }),
      ).not.toBeInTheDocument();
    });

    it('does not win over the zero-documents state — re-analysing with nothing to analyse is still impossible', () => {
      render(
        <DocumentViewer
          markdownContent={null}
          documents={[]}
          superseded
          analysisInFlight
          onManageDocuments={jest.fn()}
        />,
      );

      expect(screen.getByTestId('no-documents-notice')).toBeInTheDocument();
      expect(screen.queryByTestId('document-analysing-notice')).not.toBeInTheDocument();
    });

    // ─── Content must never be suppressed by analysisInFlight (Judgment Day
    // round two, finding R-1 — the v1.1 defect this whole design restores
    // v1.2's fix for). ──────────────────────────────────────────────────────
    it('does not suppress already-present content — renders the real content plus an unobtrusive indicator instead of the full-screen notice', () => {
      render(
        <DocumentViewer
          markdownContent="## Document: plan.pdf\n\nSome extracted text"
          documents={DOCS}
          superseded={false}
          analysisInFlight
        />,
      );

      // The load-bearing assertion: content stays on screen. An
      // implementation that lets `analysisInFlight` gate content (the exact
      // v1.1 defect) fails this even though it might pass the no-content
      // fixtures above in isolation.
      expect(screen.getByTestId('markdown-content')).toBeInTheDocument();
      expect(screen.queryByTestId('document-analysing-notice')).not.toBeInTheDocument();
      expect(screen.queryByTestId('document-withheld-notice')).not.toBeInTheDocument();
      // The unobtrusive indicator is present, distinct from the full-screen
      // blocking notice above.
      expect(screen.getByTestId('document-analysing-indicator')).toBeInTheDocument();
    });

    it('shows no in-flight indicator when analysisInFlight is false (default) with content present', () => {
      render(
        <DocumentViewer
          markdownContent="## Document: plan.pdf\n\nSome extracted text"
          documents={DOCS}
        />,
      );

      expect(screen.queryByTestId('document-analysing-indicator')).not.toBeInTheDocument();
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
    it('states no documents on this assessment and offers Manage Documents', () => {
      render(
        <DocumentViewer
          markdownContent={null}
          documents={[]}
          superseded
          onReAnalyze={jest.fn()}
        />,
      );

      expect(
        screen.getByText(/no documents on this assessment/i),
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
        screen.queryByText(/this analysis is out of date/i),
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
        screen.queryByText(/no documents on this assessment/i),
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

  // ─── T-007 Reviewer advisory, Gap 2: the "Re-analyse now" button had no
  // disabled state at all while a run was in flight, so repeated clicks
  // could enqueue repeated Bedrock runs. `DocumentViewer` stays purely
  // presentational — the in-flight signal arrives as a `reAnalyzeInFlight`
  // prop, exactly like `documentsLoading` and `superseded` already do; the
  // parent (`gap-detector-client.tsx`) owns computing when that span starts
  // and ends. ─────────────────────────────────────────────────────────────
  describe('reAnalyzeInFlight — the "Re-analyse now" button disables during a run (T-007 Gap 2)', () => {
    it('is enabled and reads "Re-analyse now" when no run is in flight', () => {
      render(
        <DocumentViewer
          markdownContent={null}
          documents={DOCS}
          superseded
          onReAnalyze={jest.fn()}
          reAnalyzeInFlight={false}
        />,
      );

      const button = screen.getByRole('button', { name: /re-analyse now/i });
      expect(button).not.toBeDisabled();
    });

    // Catches the wrong implementation this gap actually shipped with: a
    // button with no `disabled` prop wired at all (so it stays clickable
    // for the whole run), or one gated only on a boolean that happens to
    // already be false by this point. Either wrong implementation renders
    // an enabled, "Re-analyse now" button here; the fix must render it
    // disabled and visibly busy.
    it('disables the button and shows an in-flight affordance while a run is in flight', async () => {
      const onReAnalyze = jest.fn();
      render(
        <DocumentViewer
          markdownContent={null}
          documents={DOCS}
          superseded
          onReAnalyze={onReAnalyze}
          reAnalyzeInFlight
        />,
      );

      const button = screen.getByRole('button', { name: /re-analysing/i });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('aria-busy', 'true');
      // The stale "Re-analyse now" label must not still be present —
      // otherwise the control reads as clickable when it is not.
      expect(
        screen.queryByRole('button', { name: /^re-analyse now$/i }),
      ).not.toBeInTheDocument();

      // A disabled native <button> does not fire its click handler even if
      // something (e.g. a stray event) tries — confirms this is a real,
      // enforced disabled state and not merely a relabeled enabled button.
      const user = userEvent.setup();
      await user.click(button);
      expect(onReAnalyze).not.toHaveBeenCalled();
    });
  });
});
