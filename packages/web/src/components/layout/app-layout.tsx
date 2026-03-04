'use client';

import { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { AppSidebar } from './app-sidebar';
import { AppHeader } from './app-header';

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  onStartAssessment?: () => void;
  searchQuery?: string;
  onSearch?: (value: string) => void;
}

export function AppLayout({
  children,
  title = 'Dashboard',
  onStartAssessment,
  searchQuery,
  onSearch,
}: AppLayoutProps) {
  const pathname = usePathname();
  // Assessment flow pages use their own teal sub-header instead of the standard AppHeader
  const isAssessmentFlow =
    pathname?.startsWith('/assessments/') &&
    pathname !== '/assessments';

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden bg-[#F8FAFC]">
        <Suspense>
          <AppSidebar />
        </Suspense>
        <SidebarInset className="flex flex-col flex-1 min-w-0">
          {isAssessmentFlow ? null : (
            <AppHeader
              title={title}
              onStartAssessment={onStartAssessment}
              searchQuery={searchQuery}
              onSearch={onSearch}
            />
          )}
          <main
            className={cn(
              'flex-1 min-h-0',
              isAssessmentFlow
                ? 'flex flex-col overflow-hidden'
                : 'overflow-y-auto p-6',
            )}
          >
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
