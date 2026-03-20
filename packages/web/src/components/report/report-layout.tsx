'use client';

import { ReportTocSidebar, type TocItem } from './report-toc-sidebar';

interface ReportLayoutProps {
  tocItems: TocItem[];
  children: React.ReactNode;
}

export function ReportLayout({ tocItems, children }: ReportLayoutProps) {
  return (
    <div className="flex flex-1 min-h-0 bg-[#F8FAFC]">
      {/* Content — this is the scroll container */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto py-8 px-6 lg:px-8">
          <div className="bg-card border border-border/80 shadow-sm rounded-xl p-8 lg:p-12 mb-12">
            {children}
          </div>
        </div>
      </div>

      {/* TOC sidebar — sits beside content, scrolls independently */}
      <ReportTocSidebar items={tocItems} />
    </div>
  );
}
