'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { ZoomIn, ZoomOut, Maximize2, FileX, FileText, FileSpreadsheet, File, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DocumentMeta {
  id: string;
  fileName: string;
  mimeType: string;
}

interface DocumentViewerProps {
  /** Compiled Markdown content from one or more extracted documents */
  markdownContent?: string | null;
  /** Keyword to highlight and scroll to */
  highlightKeyword?: string | null;
  /** Document metadata for section badges and navigation */
  documents?: DocumentMeta[];
  className?: string;
}

// Stop words excluded from highlight matching (too generic to be useful)
const STOP_WORDS = new Set([
  'the', 'and', 'for', 'that', 'with', 'this', 'from', 'have', 'are',
  'not', 'but', 'all', 'can', 'each', 'which', 'their', 'will', 'been',
  'more', 'also', 'into', 'than', 'then', 'when', 'has', 'its', 'was',
]);

// Font size steps (rem)
const FONT_SIZES = [0.75, 0.8125, 0.875, 1, 1.125, 1.25];
const DEFAULT_FONT_IDX = 0; // 0.75rem = 75%

// File type → badge color config
function getFileTypeConfig(fileName: string): { color: string; bg: string; border: string; Icon: typeof FileText } {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'xlsx':
    case 'xls':
    case 'csv':
      return { color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', Icon: FileSpreadsheet };
    case 'pdf':
      return { color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', Icon: FileText };
    case 'docx':
    case 'doc':
      return { color: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-200', Icon: FileText };
    case 'html':
    case 'htm':
      return { color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', Icon: File };
    default:
      return { color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200', Icon: File };
  }
}

// Extract document names from markdown content (## Document: {filename} pattern)
function extractDocumentNames(content: string): string[] {
  const matches = content.match(/^## Document: (.+)$/gm);
  if (!matches) return [];
  return matches.map((m) => m.replace('## Document: ', ''));
}

export function DocumentViewer({
  markdownContent,
  highlightKeyword,
  documents,
  className,
}: DocumentViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [fontIdx, setFontIdx] = useState(DEFAULT_FONT_IDX);
  const [currentDocName, setCurrentDocName] = useState<string | null>(null);
  const [jumpToOpen, setJumpToOpen] = useState(false);
  const jumpToRef = useRef<HTMLDivElement>(null);

  // Parse document names from content
  const docNames = useMemo(
    () => (markdownContent ? extractDocumentNames(markdownContent) : []),
    [markdownContent],
  );

  const hasMultipleDocs = docNames.length > 1;

  const handleZoomIn = useCallback(() => {
    setFontIdx((i) => Math.min(i + 1, FONT_SIZES.length - 1));
  }, []);

  const handleZoomOut = useCallback(() => {
    setFontIdx((i) => Math.max(i - 1, 0));
  }, []);

  const handleFitToWidth = useCallback(() => {
    setFontIdx(DEFAULT_FONT_IDX);
  }, []);

  // Close jump-to dropdown on outside click
  useEffect(() => {
    if (!jumpToOpen) return;
    const handler = (e: MouseEvent) => {
      if (jumpToRef.current && !jumpToRef.current.contains(e.target as Node)) {
        setJumpToOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [jumpToOpen]);

  // Jump to a document section
  const scrollToDocument = useCallback((docName: string) => {
    if (!scrollRef.current) return;
    const badges = scrollRef.current.querySelectorAll('[data-doc-section]');
    for (const badge of badges) {
      if (badge.getAttribute('data-doc-section') === docName) {
        badge.scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
      }
    }
    setJumpToOpen(false);
  }, []);

  // ─── Sticky document indicator via IntersectionObserver ─────────────
  useEffect(() => {
    if (!scrollRef.current || !hasMultipleDocs) return;

    const container = scrollRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        // Find the topmost visible section badge
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const name = entry.target.getAttribute('data-doc-section');
            if (name) setCurrentDocName(name);
          }
        }
      },
      {
        root: container,
        rootMargin: '-10px 0px -80% 0px', // Trigger when badge is near the top
        threshold: 0,
      },
    );

    // Observe after a short delay to ensure DOM is rendered
    const timer = setTimeout(() => {
      const badges = container.querySelectorAll('[data-doc-section]');
      badges.forEach((badge) => observer.observe(badge));
      // Set initial current doc
      if (docNames.length > 0) setCurrentDocName(docNames[0]);
    }, 500);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [markdownContent, hasMultipleDocs, docNames]);

  // ─── Highlight + scroll to matching text in rendered Markdown ───────
  useEffect(() => {
    if (!scrollRef.current) return;

    const container = scrollRef.current;

    // Clear previous highlights
    container.querySelectorAll('.doc-text-highlight').forEach((el) => {
      el.classList.remove('doc-text-highlight');
    });

    if (!highlightKeyword) return;

    const timer = setTimeout(() => {
      // Extract significant keywords (>=4 chars, not stop words)
      const allKeywords = highlightKeyword
        .toLowerCase()
        .replace(/[(),:;""']/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 4 && !STOP_WORDS.has(w));

      if (allKeywords.length === 0) return;

      // Gather all text-bearing elements.
      // Use `tr` for table rows (not individual td/th) so entire rows score
      // as one unit — a row like "COGS | 4800 | 6000" matches keywords better.
      const textElements = Array.from(
        container.querySelectorAll('p, li, tr, h1, h2, h3, h4, h5, h6'),
      );

      if (textElements.length === 0) return;

      // Count keyword frequency across ALL elements to find discriminating terms
      const docFrequency = new Map<string, number>();
      for (const kw of allKeywords) {
        let count = 0;
        for (const el of textElements) {
          if ((el.textContent ?? '').toLowerCase().includes(kw)) count++;
        }
        docFrequency.set(kw, count);
      }

      // Keep only keywords that appear in <30% of elements (discriminating)
      const threshold = Math.max(3, textElements.length * 0.3);
      let keywords = allKeywords.filter((kw) => (docFrequency.get(kw) ?? 0) < threshold);

      if (keywords.length === 0) {
        keywords = [...new Set(allKeywords)]
          .sort((a, b) => (docFrequency.get(a) ?? 0) - (docFrequency.get(b) ?? 0))
          .slice(0, 6);
      }

      keywords = [...new Set(keywords)].slice(0, 12);

      // Score each element
      const scores = textElements.map((el) => {
        const text = (el.textContent ?? '').toLowerCase();
        return keywords.reduce((acc, kw) => acc + (text.includes(kw) ? 1 : 0), 0);
      });

      // ─── Per-document-section highlighting ─────────────────────────────
      // Split elements into sections delimited by [data-doc-section] badges.
      // Find the best cluster in EACH section so multi-doc fields get
      // highlights in every document that contributed.
      const sectionBadges = container.querySelectorAll('[data-doc-section]');
      type Section = { startIdx: number; endIdx: number };
      const sections: Section[] = [];

      if (sectionBadges.length > 1) {
        // Build section ranges based on which badge each element follows
        for (let b = 0; b < sectionBadges.length; b++) {
          const badgeEl = sectionBadges[b];
          const nextBadgeEl = sectionBadges[b + 1] ?? null;

          let startIdx = -1;
          let endIdx = textElements.length;
          for (let i = 0; i < textElements.length; i++) {
            if (startIdx === -1 && badgeEl.compareDocumentPosition(textElements[i]) & Node.DOCUMENT_POSITION_FOLLOWING) {
              startIdx = i;
            }
            if (nextBadgeEl && nextBadgeEl.compareDocumentPosition(textElements[i]) & Node.DOCUMENT_POSITION_FOLLOWING) {
              endIdx = i;
              break;
            }
          }
          if (startIdx >= 0) sections.push({ startIdx, endIdx });
        }
      }

      // Fallback: treat entire content as one section
      if (sections.length === 0) {
        sections.push({ startIdx: 0, endIdx: textElements.length });
      }

      // Find best window in each section and highlight.
      // For sections with only low scores (e.g. spreadsheets), we still
      // highlight the best matches as long as there is at least 1 hit.
      const WINDOW = 5;
      const MAX_HIGHLIGHTS_PER_SECTION = 3;
      let firstMatch: Element | null = null;

      // Track which sections got keyword hits vs not
      const sectionHasHits: boolean[] = [];
      const sectionFirstHeading: (Element | null)[] = [];

      for (let si = 0; si < sections.length; si++) {
        const section = sections[si];
        const len = section.endIdx - section.startIdx;
        if (len === 0) { sectionHasHits.push(false); sectionFirstHeading.push(null); continue; }

        // Find first heading in this section (for fallback highlighting)
        let heading: Element | null = null;
        for (let i = section.startIdx; i < section.endIdx; i++) {
          if (/^H[1-6]$/.test(textElements[i].tagName)) { heading = textElements[i]; break; }
        }
        sectionFirstHeading.push(heading);

        // Check if this section has ANY scoring elements at all
        const sectionScores = scores.slice(section.startIdx, section.endIdx);
        const hasScoringElements = sectionScores.some((s) => s > 0);
        sectionHasHits.push(hasScoringElements);
        if (!hasScoringElements) continue;

        const w = Math.min(WINDOW, len);

        let bestStart = 0;
        let bestScore = 0;
        let windowScore = sectionScores.slice(0, w).reduce((a, b) => a + b, 0);

        if (windowScore > bestScore) {
          bestScore = windowScore;
          bestStart = 0;
        }

        for (let i = w; i < sectionScores.length; i++) {
          windowScore += sectionScores[i] - (sectionScores[i - w] ?? 0);
          if (windowScore > bestScore) {
            bestScore = windowScore;
            bestStart = i - w + 1;
          }
        }

        if (bestScore === 0) continue;

        // Highlight best matches in this section
        const absStart = section.startIdx + bestStart;
        const absEnd = Math.min(absStart + w, section.endIdx);
        let highlighted = 0;

        // For low-scoring sections (spreadsheets), also scan beyond the window
        // to highlight any scoring elements (up to MAX_HIGHLIGHTS_PER_SECTION)
        const scanEnd = bestScore <= 2
          ? section.endIdx  // Scan entire section for sparse matches
          : absEnd;         // Normal: only scan within best window

        for (let i = absStart; i < scanEnd && highlighted < MAX_HIGHLIGHTS_PER_SECTION; i++) {
          if (scores[i] > 0) {
            textElements[i].classList.add('doc-text-highlight');
            if (!firstMatch) firstMatch = textElements[i];
            highlighted++;
          }
        }
      }

      // Fallback: if some sections have hits but others don't (multi-doc),
      // highlight the first heading in zero-match sections as a navigational
      // anchor so the user knows the section is also relevant.
      const anyHits = sectionHasHits.some(Boolean);
      if (anyHits && sections.length > 1) {
        for (let si = 0; si < sections.length; si++) {
          if (!sectionHasHits[si] && sectionFirstHeading[si]) {
            sectionFirstHeading[si]!.classList.add('doc-text-highlight');
          }
        }
      }

      firstMatch?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);

    return () => clearTimeout(timer);
  }, [highlightKeyword, markdownContent]);

  // Custom renderers
  const components = useMemo<Components>(
    () => ({
      h2: ({ children }) => {
        const text = String(children);
        // Detect document section headers: "Document: filename.ext"
        const match = text.match(/^Document:\s*(.+)$/);
        if (match) {
          const fileName = match[1];
          const config = getFileTypeConfig(fileName);
          const { Icon } = config;
          return (
            <div
              className="doc-section-badge-wrapper"
              data-doc-section={fileName}
            >
              <div className={cn(
                'doc-section-badge',
                config.bg,
                config.border,
                config.color,
              )}>
                <Icon className="h-4 w-4 shrink-0" />
                <span className="font-semibold text-sm truncate">{fileName}</span>
              </div>
              <div className="doc-section-divider" />
            </div>
          );
        }
        // Regular h2
        return <h2>{children}</h2>;
      },
      // Wrap tables in a horizontally-scrollable container for wide spreadsheets
      table: ({ children, ...props }) => (
        <div className="overflow-x-auto -mx-1 px-1 my-4">
          <table {...props}>{children}</table>
        </div>
      ),
      a: ({ children, href, ...props }) => {
        const text = String(children);
        if (/^\[\d+\]$/.test(text)) {
          return (
            <sup className="doc-citation" title={href}>
              {text.replace(/[[\]]/g, '')}
            </sup>
          );
        }
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="doc-link"
            {...props}
          >
            {children}
          </a>
        );
      },
    }),
    [],
  );

  if (!markdownContent) {
    return (
      <div
        className={cn(
          'flex flex-col h-full items-center justify-center text-muted-foreground',
          className,
        )}
      >
        <FileX className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm">No document content available</p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30 shrink-0">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <FileText className="h-3.5 w-3.5" />
          <span>Document Preview</span>
          {hasMultipleDocs && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold">
              {docNames.length} docs
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 ml-auto">
          {/* Jump-to dropdown */}
          {hasMultipleDocs && (
            <div className="relative" ref={jumpToRef}>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs gap-1"
                onClick={() => setJumpToOpen(!jumpToOpen)}
              >
                Jump to
                <ChevronDown className="h-3 w-3" />
              </Button>
              {jumpToOpen && (
                <div className="absolute right-0 top-full mt-1 z-50 min-w-[220px] bg-popover border border-border rounded-lg shadow-lg py-1">
                  {docNames.map((name) => {
                    const config = getFileTypeConfig(name);
                    const { Icon } = config;
                    return (
                      <button
                        key={name}
                        className={cn(
                          'flex items-center gap-2 w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors',
                          currentDocName === name && 'bg-accent/50 font-medium',
                        )}
                        onClick={() => scrollToDocument(name)}
                      >
                        <Icon className={cn('h-3.5 w-3.5 shrink-0', config.color)} />
                        <span className="truncate">{name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {hasMultipleDocs && <div className="w-px h-4 bg-border mx-1" />}

          {/* Font size controls */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleZoomOut}
            disabled={fontIdx <= 0}
            aria-label="Decrease font size"
            title="Decrease font size"
          >
            <span className="text-[10px] font-bold leading-none">A-</span>
          </Button>
          <span className="text-xs text-muted-foreground w-10 text-center">
            {Math.round(FONT_SIZES[fontIdx] * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleZoomIn}
            disabled={fontIdx >= FONT_SIZES.length - 1}
            aria-label="Increase font size"
            title="Increase font size"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <div className="w-px h-4 bg-border mx-1" />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleFitToWidth}
            title="Reset font size"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Sticky document indicator */}
      {hasMultipleDocs && currentDocName && (
        <div className="sticky-doc-indicator">
          {(() => {
            const config = getFileTypeConfig(currentDocName);
            const { Icon } = config;
            return (
              <>
                <Icon className={cn('h-3 w-3 shrink-0', config.color)} />
                <span className="text-[11px] font-medium text-foreground/80 truncate">
                  {currentDocName}
                </span>
              </>
            );
          })()}
        </div>
      )}

      {/* Markdown content */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto px-6 py-4"
        style={{ fontSize: `${FONT_SIZES[fontIdx]}rem` }}
      >
        <div
          className={cn(
            'doc-viewer-prose prose prose-sm max-w-none',
            'prose-headings:font-semibold prose-headings:text-foreground',
            'prose-h1:text-xl prose-h1:mt-8 prose-h1:mb-3 prose-h1:pb-2 prose-h1:border-b prose-h1:border-border',
            'prose-h2:text-lg prose-h2:mt-6 prose-h2:mb-2',
            'prose-h3:text-base prose-h3:mt-4 prose-h3:mb-1.5',
            'prose-p:text-foreground prose-p:leading-relaxed prose-p:mb-3',
            /* table styles handled by .doc-viewer-prose in globals.css */
            'prose-li:text-foreground prose-li:my-0.5',
            'prose-ul:my-2 prose-ol:my-2',
            'prose-hr:border-border prose-hr:my-8',
            'prose-code:bg-muted prose-code:px-1 prose-code:rounded prose-code:text-sm',
            'prose-strong:text-foreground prose-strong:font-semibold',
            'prose-em:text-foreground/80',
            'prose-blockquote:border-l-2 prose-blockquote:border-primary/30 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-muted-foreground',
          )}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
            {markdownContent}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
