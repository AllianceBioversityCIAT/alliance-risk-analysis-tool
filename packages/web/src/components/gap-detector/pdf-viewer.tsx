'use client';

import { useEffect, useMemo, useRef, useCallback } from 'react';
import { Viewer, Worker } from '@react-pdf-viewer/core';
import { searchPlugin } from '@react-pdf-viewer/search';
import { zoomPlugin } from '@react-pdf-viewer/zoom';
import { ZoomIn, ZoomOut, Maximize2, FileX, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/search/lib/styles/index.css';
import '@react-pdf-viewer/zoom/lib/styles/index.css';

const WORKER_URL = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

interface PdfViewerProps {
  presignedUrl?: string | null;
  fileName?: string | null;
  highlightKeyword?: string | null;
  className?: string;
}

export function PdfViewer({ presignedUrl, fileName, highlightKeyword, className }: PdfViewerProps) {
  const searchPluginInstance = useMemo(() => searchPlugin(), []);
  const zoomPluginInstance = useMemo(() => zoomPlugin(), []);

  const { ZoomIn: ZoomInButton, ZoomOut: ZoomOutButton, CurrentScale } = zoomPluginInstance;

  const isDocumentLoaded = useRef(false);
  const prevKeyword = useRef<string | null>(null);

  // Highlight keyword when it changes — use the stable plugin instance directly
  // instead of destructured methods to avoid unstable deps
  useEffect(() => {
    if (!isDocumentLoaded.current) return;

    if (highlightKeyword && highlightKeyword !== prevKeyword.current) {
      prevKeyword.current = highlightKeyword;
      try {
        searchPluginInstance.highlight({ keyword: highlightKeyword, matchCase: false });
      } catch {
        // Plugin not connected to Viewer yet — safe to ignore
      }
    } else if (!highlightKeyword && prevKeyword.current) {
      prevKeyword.current = null;
      try {
        searchPluginInstance.clearHighlights();
      } catch {
        // Plugin not connected to Viewer yet — safe to ignore
      }
    }
  }, [highlightKeyword, searchPluginInstance]);

  // Reset loaded state when URL changes
  useEffect(() => {
    isDocumentLoaded.current = false;
    prevKeyword.current = null;
  }, [presignedUrl]);

  const handleDocumentLoad = useCallback(() => {
    isDocumentLoaded.current = true;
    // If there's already a keyword waiting, highlight it
    if (highlightKeyword) {
      prevKeyword.current = highlightKeyword;
      try {
        searchPluginInstance.highlight({ keyword: highlightKeyword, matchCase: false });
      } catch {
        // Ignore — highlight will retry on next keyword change
      }
    }
  }, [highlightKeyword, searchPluginInstance]);

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
    <div className={cn('flex flex-col h-full', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30 shrink-0">
        {fileName && (
          <div className="flex items-center gap-2 min-w-0 mr-3">
            <FileText className="h-4 w-4 text-red-500 shrink-0" />
            <span className="text-xs font-medium text-foreground truncate">{fileName}</span>
          </div>
        )}
        <div className="flex items-center gap-1 ml-auto">
          <ZoomOutButton>
            {(props) => (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={props.onClick}
                aria-label="Zoom out"
                title="Zoom out"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
            )}
          </ZoomOutButton>
          <CurrentScale>
            {(props) => (
              <span className="text-xs text-muted-foreground w-10 text-center">
                {Math.round(props.scale * 100)}%
              </span>
            )}
          </CurrentScale>
          <ZoomInButton>
            {(props) => (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={props.onClick}
                aria-label="Zoom in"
                title="Zoom in"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
            )}
          </ZoomInButton>
          <div className="w-px h-4 bg-border mx-1" />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => zoomPluginInstance.zoomTo(1)}
            title="Fit to width"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* PDF Viewer */}
      <div className="flex-1 overflow-hidden bg-[#525659]">
        <Worker workerUrl={WORKER_URL}>
          <Viewer
            fileUrl={presignedUrl}
            plugins={[searchPluginInstance, zoomPluginInstance]}
            onDocumentLoad={handleDocumentLoad}
            defaultScale={1}
          />
        </Worker>
      </div>
    </div>
  );
}
