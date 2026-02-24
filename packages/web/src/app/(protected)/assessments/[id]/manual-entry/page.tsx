'use client';

import { use } from 'react';
import { ClipboardList } from 'lucide-react';
import { BreadcrumbTrail } from '@/components/shared/breadcrumb-trail';
import { ManualDataEntryModal } from '@/components/assessment/manual-data-entry-modal';

interface ManualEntryPageProps {
  params: Promise<{ id: string }>;
}

export default function ManualEntryPage({ params }: ManualEntryPageProps) {
  const { id } = use(params);

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
      {/* Breadcrumb */}
      <BreadcrumbTrail
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'New Assessment', href: '#' },
          { label: 'Manual Data Entry' },
        ]}
      />

      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <ClipboardList className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Manual Data Entry</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Fill in 35 structured fields across 7 risk categories. Changes are saved automatically.
          </p>
        </div>
      </div>

      {/* Data entry card */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <ManualDataEntryModal assessmentId={id} />
      </div>
    </div>
  );
}
