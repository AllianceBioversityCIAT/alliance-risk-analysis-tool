'use client';

import { use } from 'react';
import { FileUp } from 'lucide-react';
import { BreadcrumbTrail } from '@/components/shared/breadcrumb-trail';
import { UploadBusinessPlanModal } from '@/components/assessment/upload-business-plan-modal';

interface UploadPageProps {
  params: Promise<{ id: string }>;
}

export default function UploadPage({ params }: UploadPageProps) {
  const { id } = use(params);

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      {/* Breadcrumb */}
      <BreadcrumbTrail
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'New Assessment', href: '#' },
          { label: 'Upload Business Plan' },
        ]}
      />

      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <FileUp className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Upload Business Plan</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Upload your business plan and our AI will extract risk data automatically.
          </p>
        </div>
      </div>

      {/* Upload card */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <UploadBusinessPlanModal assessmentId={id} />
      </div>
    </div>
  );
}
