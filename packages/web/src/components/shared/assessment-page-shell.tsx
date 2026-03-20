'use client';

import { SidebarTrigger } from '@/components/ui/sidebar';
import { BreadcrumbTrail } from '@/components/shared/breadcrumb-trail';
import { AssessmentTopBar } from '@/components/shared/assessment-top-bar';
import type { BreadcrumbItem } from '@/components/shared/breadcrumb-trail';
import type { AssessmentDetail } from '@alliance-risk/shared';

export interface AssessmentPageShellProps {
  /** Breadcrumb items (always starts with Dashboard) */
  breadcrumbs: BreadcrumbItem[];
  /** Assessment data for the teal sub-header. Hidden while loading. */
  assessment?: AssessmentDetail | null;
  /** Page title */
  title: string;
  /** Page description shown below the title */
  description: string;
  /** Optional action buttons rendered to the right of the title */
  actions?: React.ReactNode;
  /** Optional extra content rendered below the description (e.g. re-analyzing indicator) */
  titleExtra?: React.ReactNode;
  /** Main page content */
  children: React.ReactNode;
  /** Additional class name on the outer wrapper */
  className?: string;
  /** Whether to hide in print mode (breadcrumb + top bar). Default false. */
  printHidden?: boolean;
}

export function AssessmentPageShell({
  breadcrumbs,
  assessment,
  title,
  description,
  actions,
  titleExtra,
  children,
  className,
  printHidden = false,
}: Readonly<AssessmentPageShellProps>) {
  const printClass = printHidden ? 'print:hidden' : '';

  return (
    <div className={`flex flex-col h-full overflow-hidden ${className ?? ''}`}>
      {/* Fixed Header Area */}
      <div className="flex-none bg-background z-10 border-b pb-4">
        {/* Breadcrumb bar */}
        <div className={`flex items-center gap-2 px-4 pt-3 pb-2 ${printClass}`}>
          <SidebarTrigger className="shrink-0" />
          <BreadcrumbTrail items={breadcrumbs} />
        </div>

        {/* Teal sub-header */}
        {assessment && (
          <div className={printClass}>
            <AssessmentTopBar
              name={assessment.name}
              shortId={assessment.id.substring(0, 8).toUpperCase()}
              progress={assessment.progress ?? 0}
              status={assessment.status}
            />
          </div>
        )}

        {/* Page heading */}
        <div className="px-6 pt-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">{title}</h1>
              <p className="text-sm text-muted-foreground mt-1.5">{description}</p>
              {titleExtra}
            </div>
            {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
          </div>
        </div>
      </div>

      {/* Scrollable Page Content */}
      <div className="flex-1 overflow-y-auto bg-[#F8FAFC]">
        <div className="pt-6">
          {children}
        </div>
      </div>
    </div>
  );
}
