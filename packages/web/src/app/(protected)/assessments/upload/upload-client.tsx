'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AssessmentPageShell } from '@/components/shared/assessment-page-shell';
import { UploadBusinessPlanModal } from '@/components/assessment/upload-business-plan-modal';
import { useAssessment } from '@/hooks/use-assessments';

export default function UploadClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get('id');

  useEffect(() => {
    if (!id) {
      router.replace('/dashboard');
    }
  }, [id, router]);

  const { data: assessment } = useAssessment(id ?? '');

  if (!id) return null;

  return (
    <AssessmentPageShell
      breadcrumbs={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Manage Documents' },
      ]}
      assessment={assessment}
      title="Manage Documents"
      description="View, add or remove documents. New uploads will be analysed automatically."
    >
      <div className="flex-1 px-6 pb-6 max-w-2xl mx-auto w-full">
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <UploadBusinessPlanModal assessmentId={id} />
        </div>
      </div>
    </AssessmentPageShell>
  );
}
