'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ZoomIn, ZoomOut, Maximize2, FileX, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Use CDN worker matching pdfjs-dist version bundled with react-pdf@9
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  presignedUrl?: string | null;
  fileName?: string | null;
  highlightKeyword?: string | null;
  className?: string;
}

export function PdfViewer({ presignedUrl, fileName, highlightKeyword, className }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState(1.0);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleDocumentLoadSuccess = useCallback(({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
  }, []);

  function handleZoomIn() {
    setScale((s) => Math.min(s + 0.25, 3.0));
  }

  function handleZoomOut() {
    setScale((s) => Math.max(s - 0.25, 0.5));
  }

  function handleFitToWidth() {
    setScale(1.0);
  }

  // Highlight + scroll to matching text in the text layer
  useEffect(() => {
    if (!highlightKeyword || !scrollRef.current) return;

    // Small delay to let text layers render after page changes
    const timer = setTimeout(() => {
      const container = scrollRef.current;
      if (!container) return;

      // Remove previous highlights
      container.querySelectorAll('.pdf-text-highlight').forEach((el) => {
        el.classList.remove('pdf-text-highlight');
      });

      // Common English stop words that match too many spans
      const STOP_WORDS = new Set([
        'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
        'her', 'was', 'one', 'our', 'out', 'has', 'have', 'been', 'will',
        'with', 'this', 'that', 'from', 'they', 'said', 'each', 'also',
        'which', 'their', 'about', 'would', 'there', 'could', 'other',
        'into', 'more', 'some', 'than', 'them', 'very', 'when', 'what',
        'your', 'through', 'its', 'just', 'over', 'such', 'being',
        'after', 'most', 'only', 'then', 'these', 'does', 'how',
      ]);

      // Extract significant words: ≥4 chars and not a stop word
      const words = highlightKeyword
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length >= 4 && !STOP_WORDS.has(w));

      if (words.length === 0) return;

      // Score each span by number of keyword matches
      const textSpans = Array.from(
        container.querySelectorAll('.react-pdf__Page__textContent span'),
      );
      if (textSpans.length === 0) return;

      const scores = textSpans.map((span) => {
        const text = (span.textContent ?? '').toLowerCase();
        if (!text.trim()) return 0;
        return words.filter((word) => text.includes(word)).length;
      });

      // Find the best cluster using a sliding window approach
      // Only highlight the document region with the highest density of matches
      const WINDOW = Math.min(30, textSpans.length);
      let bestStart = 0;
      let bestScore = 0;
      let windowScore = 0;

      for (let i = 0; i < WINDOW; i++) windowScore += scores[i];
      bestScore = windowScore;

      for (let i = 1; i <= textSpans.length - WINDOW; i++) {
        windowScore -= scores[i - 1];
        windowScore += scores[i + WINDOW - 1];
        if (windowScore > bestScore) {
          bestScore = windowScore;
          bestStart = i;
        }
      }

      if (bestScore === 0) return;

      // Highlight only matching spans within the best cluster
      let scrollTarget: Element | undefined;
      const end = Math.min(bestStart + WINDOW, textSpans.length);
      for (let i = bestStart; i < end; i++) {
        if (scores[i] > 0) {
          textSpans[i].classList.add('pdf-text-highlight');
          if (!scrollTarget) scrollTarget = textSpans[i];
        }
      }

      scrollTarget?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 400);

    return () => clearTimeout(timer);
  }, [highlightKeyword, numPages]);

  if (!presignedUrl) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center h-full gap-4 text-muted-foreground',
          className,
        )}
      >
        <FileX className="h-12 w-12 opacity-40" />
        <div className="text-center">
          <p className="text-sm font-medium">No document uploaded</p>
          <p className="text-xs mt-1">Upload a business plan to view it here.</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn('flex flex-col h-full', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30 shrink-0">
        {fileName && (
          <div className="flex items-center gap-2 min-w-0 mr-3">
            <FileText className="h-4 w-4 text-red-500 shrink-0" />
            <span className="text-xs font-medium text-foreground truncate">{fileName}</span>
          </div>
        )}
        <div className="flex items-center gap-1 ml-auto">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleZoomOut}
            disabled={scale <= 0.5}
            aria-label="Zoom out"
            title="Zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs text-muted-foreground w-10 text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleZoomIn}
            disabled={scale >= 3.0}
            aria-label="Zoom in"
            title="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <div className="w-px h-4 bg-border mx-1" />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleFitToWidth}
            title="Fit to width"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* PDF pages */}
      <div ref={scrollRef} className="flex-1 overflow-auto bg-[#525659]">
        <Document
          file={presignedUrl}
          onLoadSuccess={handleDocumentLoadSuccess}
          loading={
            <div className="flex items-center justify-center h-full py-20">
              <Loader2 className="h-6 w-6 animate-spin text-white/60" />
            </div>
          }
          error={
            <div className="flex flex-col items-center justify-center h-full py-20 text-white/60">
              <FileX className="h-10 w-10 mb-2 opacity-50" />
              <p className="text-sm">Failed to load document</p>
            </div>
          }
        >
          {Array.from({ length: numPages }, (_, i) => (
            <Page
              key={`page_${i + 1}`}
              pageNumber={i + 1}
              scale={scale}
              className="mb-2 mx-auto"
              renderAnnotationLayer
              renderTextLayer
            />
          ))}
        </Document>
      </div>
    </div>
  );
}
