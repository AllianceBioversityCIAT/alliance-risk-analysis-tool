'use client';

import { cn } from '@/lib/utils';

interface GapSummaryBarProps {
  total: number;
  verified: number;
  missing: number;
}

export function GapSummaryBar({ total, verified, missing }: GapSummaryBarProps) {
  const partial = total - verified - missing;
  const progressPct = total > 0 ? Math.round((verified / total) * 100) : 0;

  return (
    <div className="flex flex-wrap items-center gap-4 px-6 py-3 bg-muted/30 border-b border-border text-sm">
      <div className="flex items-center gap-1.5">
        <span className="font-medium text-foreground">{total}</span>
        <span className="text-muted-foreground">total fields</span>
      </div>
      <div className="w-px h-4 bg-border hidden sm:block" />
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />
        <span className="font-medium text-foreground">{verified}</span>
        <span className="text-muted-foreground">verified</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-yellow-400 inline-block" />
        <span className="font-medium text-foreground">{partial}</span>
        <span className="text-muted-foreground">partial</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-destructive inline-block" />
        <span className="font-medium text-foreground">{missing}</span>
        <span className="text-muted-foreground">missing</span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <div className="h-1.5 w-24 rounded-full bg-muted overflow-hidden hidden sm:block">
          <div
            className="h-full rounded-full bg-green-500 transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span className="text-xs font-semibold text-foreground">{progressPct}%</span>
      </div>
    </div>
  );
}

interface GapLayoutProps {
  leftPanel: React.ReactNode;
  rightPanel: React.ReactNode;
  hasDocument: boolean;
  summaryBar?: React.ReactNode;
}

export function GapLayout({ leftPanel, rightPanel, hasDocument, summaryBar }: GapLayoutProps) {
  return (
    <div className="flex flex-col h-full">
      {summaryBar}

      <div
        className={cn(
          'flex flex-1 min-h-0',
          hasDocument ? 'grid-cols-2' : 'flex-col',
        )}
        style={hasDocument ? { display: 'grid', gridTemplateColumns: '1fr 1fr' } : undefined}
      >
        {/* Left: Gap field list */}
        <div className="overflow-y-auto p-4 space-y-3 border-r border-border min-h-0">
          {leftPanel}
        </div>

        {/* Right: PDF viewer (only when document exists) */}
        {hasDocument && (
          <div className="flex flex-col min-h-0">
            {rightPanel}
          </div>
        )}
      </div>
    </div>
  );
}
