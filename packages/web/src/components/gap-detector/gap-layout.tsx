'use client';

import { cn } from '@/lib/utils';

interface GapLayoutProps {
  documentPanel: React.ReactNode;
  fieldsPanel: React.ReactNode;
  hasDocument: boolean;
}

export function GapLayout({ documentPanel, fieldsPanel, hasDocument }: GapLayoutProps) {
  return (
    <div
      className={cn(
        'flex-1 min-h-0',
        hasDocument ? 'grid grid-cols-2' : 'flex flex-col',
      )}
    >
      {/* Left: PDF viewer (only when document exists) */}
      {hasDocument && (
        <aside
          className="flex flex-col min-h-0 border-r border-border overflow-hidden"
          aria-label="Document preview"
        >
          {documentPanel}
        </aside>
      )}

      {/* Right: Gap fields */}
      <main className="flex flex-col min-h-0 overflow-y-auto">
        {fieldsPanel}
      </main>
    </div>
  );
}
