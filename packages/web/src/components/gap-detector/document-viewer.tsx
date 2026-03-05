'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { ZoomIn, ZoomOut, Maximize2, FileX, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DocumentViewerProps {
  /** Compiled Markdown content from one or more extracted documents */
  markdownContent?: string | null;
  /** Keyword to highlight and scroll to */
  highlightKeyword?: string | null;
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
const DEFAULT_FONT_IDX = 3; // 1rem

export function DocumentViewer({
  markdownContent,
  highlightKeyword,
  className,
}: DocumentViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [fontIdx, setFontIdx] = useState(DEFAULT_FONT_IDX);

  const handleZoomIn = useCallback(() => {
    setFontIdx((i) => Math.min(i + 1, FONT_SIZES.length - 1));
  }, []);

  const handleZoomOut = useCallback(() => {
    setFontIdx((i) => Math.max(i - 1, 0));
  }, []);

  const handleFitToWidth = useCallback(() => {
    setFontIdx(DEFAULT_FONT_IDX);
  }, []);

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
      // Extract significant keywords (≥4 chars, not stop words)
      const allKeywords = highlightKeyword
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length >= 4 && !STOP_WORDS.has(w));

      if (allKeywords.length === 0) return;

      // Gather all text-bearing elements
      const textElements = Array.from(
        container.querySelectorAll('p, li, td, th, h1, h2, h3, h4, h5, h6'),
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
      // If that leaves nothing, fall back to the least frequent 6 keywords
      const threshold = Math.max(3, textElements.length * 0.3);
      let keywords = allKeywords.filter((kw) => (docFrequency.get(kw) ?? 0) < threshold);

      if (keywords.length === 0) {
        // Fall back: pick the 6 rarest keywords
        keywords = [...new Set(allKeywords)]
          .sort((a, b) => (docFrequency.get(a) ?? 0) - (docFrequency.get(b) ?? 0))
          .slice(0, 6);
      }

      // Cap at 10 keywords to avoid overly broad matching
      keywords = [...new Set(keywords)].slice(0, 10);

      // Score each element: how many keywords appear in its text?
      const scores = textElements.map((el) => {
        const text = (el.textContent ?? '').toLowerCase();
        return keywords.reduce((acc, kw) => acc + (text.includes(kw) ? 1 : 0), 0);
      });

      // Sliding window of 5 elements — find best cluster (tight focus)
      const WINDOW = 5;
      let bestStart = 0;
      let bestScore = 0;
      let windowScore = scores.slice(0, WINDOW).reduce((a, b) => a + b, 0);

      if (windowScore > bestScore) {
        bestScore = windowScore;
        bestStart = 0;
      }

      for (let i = WINDOW; i < scores.length; i++) {
        windowScore += scores[i] - (scores[i - WINDOW] ?? 0);
        if (windowScore > bestScore) {
          bestScore = windowScore;
          bestStart = i - WINDOW + 1;
        }
      }

      if (bestScore === 0) return;

      // Highlight only elements in the best window that actually match (max 5)
      const windowEnd = Math.min(bestStart + WINDOW, textElements.length);
      let firstMatch: Element | null = null;
      let highlighted = 0;
      const MAX_HIGHLIGHTS = 5;

      for (let i = bestStart; i < windowEnd && highlighted < MAX_HIGHLIGHTS; i++) {
        if (scores[i] > 0) {
          textElements[i].classList.add('doc-text-highlight');
          if (!firstMatch) firstMatch = textElements[i];
          highlighted++;
        }
      }

      // Scroll first match into view
      firstMatch?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);

    return () => clearTimeout(timer);
  }, [highlightKeyword, markdownContent]);

  // Custom renderers — style citation links [1], [2] as superscript badges
  const components = useMemo<Components>(
    () => ({
      a: ({ children, href, ...props }) => {
        const text = String(children);
        // Detect citation-style links: [1], [2], [10], etc.
        if (/^\[\d+\]$/.test(text)) {
          return (
            <sup className="doc-citation" title={href}>
              {text.replace(/[[\]]/g, '')}
            </sup>
          );
        }
        // Regular links — subtle styling, open in new tab
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
        </div>

        <div className="flex items-center gap-1 ml-auto">
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

      {/* Markdown content */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto px-6 py-4"
        style={{ fontSize: `${FONT_SIZES[fontIdx]}rem` }}
      >
        <div
          className={cn(
            'doc-viewer-prose prose prose-sm max-w-none',
            // Heading styles — clear section breaks
            'prose-headings:font-semibold prose-headings:text-foreground',
            'prose-h1:text-xl prose-h1:mt-8 prose-h1:mb-3 prose-h1:pb-2 prose-h1:border-b prose-h1:border-border',
            'prose-h2:text-lg prose-h2:mt-6 prose-h2:mb-2',
            'prose-h3:text-base prose-h3:mt-4 prose-h3:mb-1.5',
            // Paragraph + text — better readability
            'prose-p:text-foreground prose-p:leading-relaxed prose-p:mb-3',
            // Tables
            'prose-table:border-collapse prose-table:w-full prose-table:my-4',
            'prose-th:border prose-th:border-border prose-th:bg-muted prose-th:px-3 prose-th:py-1.5 prose-th:text-left prose-th:font-semibold prose-th:text-xs',
            'prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-1.5 prose-td:text-sm',
            // Lists — better spacing
            'prose-li:text-foreground prose-li:my-0.5',
            'prose-ul:my-2 prose-ol:my-2',
            // HR separators (used between document sections)
            'prose-hr:border-border prose-hr:my-8',
            // Inline code
            'prose-code:bg-muted prose-code:px-1 prose-code:rounded prose-code:text-sm',
            // Strong/Bold
            'prose-strong:text-foreground prose-strong:font-semibold',
            // Emphasis
            'prose-em:text-foreground/80',
            // Blockquotes
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
