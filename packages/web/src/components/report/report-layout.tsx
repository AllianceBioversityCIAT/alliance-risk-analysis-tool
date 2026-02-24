'use client';

import { ReportTocSidebar, type TocItem } from './report-toc-sidebar';

interface ReportLayoutProps {
  tocItems: TocItem[];
  children: React.ReactNode;
  toolbar?: React.ReactNode;
}

export function ReportLayout({ tocItems, children, toolbar }: ReportLayoutProps) {
  return (
    <div className="flex flex-col min-h-full">
      {/* Toolbar */}
      {toolbar && (
        <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-white print:hidden shrink-0">
          {toolbar}
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto py-8 px-6 bg-card">
            {children}
          </div>
        </div>

        {/* TOC sidebar */}
        <ReportTocSidebar items={tocItems} />
      </div>
    </div>
  );
}
