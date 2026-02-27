'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardList, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { sileo } from 'sileo';
import { StatCard } from '@/components/dashboard/stat-card';
import { AssessmentTable } from '@/components/dashboard/assessment-table';
import {
  useAssessments,
  useAssessmentStats,
  useDeleteAssessment,
  type AssessmentFilters,
} from '@/hooks/use-assessments';
import type { AssessmentRowData } from '@/components/dashboard/assessment-table-row';

const PAGE_SIZE = 10;

export default function DashboardPage() {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(1);
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [filters, setFilters] = useState<AssessmentFilters>({ limit: PAGE_SIZE });

  const { data: stats, isLoading: statsLoading } = useAssessmentStats();
  const { data: assessmentsData, isLoading: assessmentsLoading } = useAssessments({
    ...filters,
    cursor: cursors[currentPage - 1],
  });
  const { mutate: deleteAssessment } = useDeleteAssessment();

  // Map API response to table row shape
  const tableRows: AssessmentRowData[] = (assessmentsData?.data ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    companyName: a.companyName,
    status: a.status,
    progress: a.progress,
    updatedAt: a.updatedAt,
  }));

  const handleNextPage = useCallback(() => {
    if (assessmentsData?.nextCursor) {
      setCursors((prev) => {
        const next = [...prev];
        next[currentPage] = assessmentsData.nextCursor ?? undefined;
        return next;
      });
      setCurrentPage((p) => p + 1);
    }
  }, [assessmentsData?.nextCursor, currentPage]);

  const handlePrevPage = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage((p) => p - 1);
    }
  }, [currentPage]);

  const handleView = useCallback(
    (id: string) => {
      router.push(`/assessments/gap-detector?id=${id}`);
    },
    [router],
  );

  const handleEdit = useCallback(
    (id: string) => {
      router.push(`/assessments/risk-scorecard?id=${id}`);
    },
    [router],
  );

  const handleDelete = useCallback(
    (id: string) => {
      sileo.action({
        title: 'Delete assessment?',
        description: 'This action cannot be undone.',
        button: {
          title: 'Confirm Delete',
          onClick: () => deleteAssessment(id),
        },
      });
    },
    [deleteAssessment],
  );

  const total = assessmentsData?.total ?? 0;
  const hasNextPage = !!assessmentsData?.nextCursor;
  const hasPrevPage = currentPage > 1;

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Overview of all risk assessments
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={ClipboardList}
          value={stats?.total ?? 0}
          label="Total Assessments"
          iconBgClass="bg-primary/10"
          isLoading={statsLoading}
        />
        <StatCard
          icon={CheckCircle}
          value={stats?.completed ?? 0}
          label="Completed"
          iconBgClass="bg-green-100"
          isLoading={statsLoading}
        />
        <StatCard
          icon={Clock}
          value={stats?.active ?? 0}
          label="Active"
          iconBgClass="bg-blue-100"
          isLoading={statsLoading}
        />
        <StatCard
          icon={AlertTriangle}
          value={stats?.drafts ?? 0}
          label="Drafts"
          iconBgClass="bg-orange-100"
          isLoading={statsLoading}
        />
      </div>

      {/* Assessment Table */}
      <AssessmentTable
        assessments={tableRows}
        total={total}
        currentPage={currentPage}
        pageSize={PAGE_SIZE}
        hasNextPage={hasNextPage}
        hasPrevPage={hasPrevPage}
        isLoading={assessmentsLoading}
        onNextPage={handleNextPage}
        onPrevPage={handlePrevPage}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </div>
  );
}
