'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { AppLayout } from '@/components/layout/app-layout';
import { StartAssessmentModal } from '@/components/assessment/start-assessment-modal';
import { SearchProvider, useSearch } from '@/providers/search-provider';

function ProtectedLayoutInner({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const { searchQuery, setSearchQuery } = useSearch();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // Always render AppLayout shell to avoid white screen on navigation.
  // The spinner renders inside the shell while auth resolves; redirect
  // happens via useEffect so we never return null here.
  return (
    <AppLayout
      onStartAssessment={() => setModalOpen(true)}
      searchQuery={searchQuery}
      onSearch={setSearchQuery}
    >
      {isLoading ? (
        <div className="flex h-full items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        children
      )}
      <StartAssessmentModal open={modalOpen} onOpenChange={setModalOpen} />
    </AppLayout>
  );
}

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SearchProvider>
      <ProtectedLayoutInner>{children}</ProtectedLayoutInner>
    </SearchProvider>
  );
}
