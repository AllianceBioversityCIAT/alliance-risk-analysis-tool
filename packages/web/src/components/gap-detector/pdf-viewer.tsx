'use client';

import { useState } from 'react';
import { ZoomIn, ZoomOut, Maximize2, FileX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PdfViewerProps {
  presignedUrl?: string | null;
  className?: string;
}

export function PdfViewer({ presignedUrl, className }: PdfViewerProps) {
  const [zoom, setZoom] = useState(100);
  const [fitToWidth, setFitToWidth] = useState(false);

  function handleZoomIn() {
    setZoom((z) => Math.min(z + 25, 200));
    setFitToWidth(false);
  }

  function handleZoomOut() {
    setZoom((z) => Math.max(z - 25, 50));
    setFitToWidth(false);
  }

  function handleFitToWidth() {
    setFitToWidth(true);
    setZoom(100);
  }

  if (!presignedUrl) {
    return (
      <div className={cn('flex flex-col items-center justify-center h-full gap-4 text-muted-foreground', className)}>
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
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30 shrink-0">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomOut} disabled={zoom <= 50}>
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs text-muted-foreground w-12 text-center">
            {fitToWidth ? 'Fit' : `${zoom}%`}
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomIn} disabled={zoom >= 200}>
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleFitToWidth} title="Fit to width">
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* PDF iframe */}
      <div className="flex-1 overflow-auto bg-[#525659]">
        <div
          style={{
            width: fitToWidth ? '100%' : `${zoom}%`,
            height: '100%',
            minHeight: '600px',
            transition: 'width 0.2s',
          }}
        >
          <iframe
            src={presignedUrl}
            className="w-full h-full border-0"
            title="Business Plan Document"
            loading="lazy"
          />
        </div>
      </div>
    </div>
  );
}
