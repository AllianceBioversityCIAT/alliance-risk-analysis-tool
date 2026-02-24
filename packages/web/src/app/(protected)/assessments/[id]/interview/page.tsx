'use client';

import { use } from 'react';
import { MessageSquare } from 'lucide-react';
import { BreadcrumbTrail } from '@/components/shared/breadcrumb-trail';
import { GuidedInterviewModal } from '@/components/assessment/guided-interview-modal';

interface InterviewPageProps {
  params: Promise<{ id: string }>;
}

export default function InterviewPage({ params }: InterviewPageProps) {
  const { id } = use(params);

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      {/* Breadcrumb */}
      <BreadcrumbTrail
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'New Assessment', href: '#' },
          { label: 'Guided Interview' },
        ]}
      />

      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <MessageSquare className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Guided Interview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Answer questions across 7 risk categories. Takes approximately 20 minutes.
          </p>
        </div>
      </div>

      {/* Interview wizard card */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <GuidedInterviewModal assessmentId={id} />
      </div>
    </div>
  );
}
