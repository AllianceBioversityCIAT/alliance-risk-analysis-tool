'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { AssessmentTableRow, type AssessmentRowData } from './assessment-table-row';

interface AssessmentTableProps {
  assessments: AssessmentRowData[];
  total: number;
  currentPage: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  isLoading?: boolean;
  onNextPage: () => void;
  onPrevPage: () => void;
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

function TableRowSkeleton() {
  return (
    <TableRow>
      <td className="p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      </td>
      <td className="p-4"><Skeleton className="h-4 w-24" /></td>
      <td className="p-4"><Skeleton className="h-2 w-28" /></td>
      <td className="p-4"><Skeleton className="h-5 w-16 rounded-full" /></td>
      <td className="p-4"><Skeleton className="h-8 w-8 rounded" /></td>
    </TableRow>
  );
}

export function AssessmentTable({
  assessments,
  total,
  currentPage,
  pageSize,
  hasNextPage,
  hasPrevPage,
  isLoading = false,
  onNextPage,
  onPrevPage,
  onView,
  onEdit,
  onDelete,
}: AssessmentTableProps) {
  const startRecord = (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(currentPage * pageSize, total);

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      {/* Table heading */}
      <div className="px-6 py-4 border-b border-border">
        <h2 className="text-base font-semibold text-foreground">Active Assessments</h2>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="bg-[#F8FAFC]/50 hover:bg-[#F8FAFC]/50">
            <TableHead className="text-[11px] font-bold uppercase tracking-[1.1px] text-[#9CA3AF] w-72">
              Business Name
            </TableHead>
            <TableHead className="text-[11px] font-bold uppercase tracking-[1.1px] text-[#9CA3AF]">
              Date Modified
            </TableHead>
            <TableHead className="text-[11px] font-bold uppercase tracking-[1.1px] text-[#9CA3AF]">
              Progress
            </TableHead>
            <TableHead className="text-[11px] font-bold uppercase tracking-[1.1px] text-[#9CA3AF]">
              Status
            </TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} />)
          ) : assessments.length === 0 ? (
            <TableRow>
              <td colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                No assessments found. Click &quot;Start New Assessment&quot; to get started.
              </td>
            </TableRow>
          ) : (
            assessments.map((assessment) => (
              <AssessmentTableRow
                key={assessment.id}
                assessment={assessment}
                onView={onView}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))
          )}
        </TableBody>
      </Table>

      {/* Pagination footer */}
      {!isLoading && total > 0 && (
        <div className="flex items-center justify-between px-6 py-4 border-t border-border">
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-medium text-foreground">{startRecord}–{endRecord}</span> of{' '}
            <span className="font-medium text-foreground">{total}</span> records
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onPrevPage}
              disabled={!hasPrevPage}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {/* Active page button */}
            <Button
              variant="outline"
              size="sm"
              className="h-8 min-w-8 shadow-sm font-semibold"
              disabled
            >
              {currentPage}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onNextPage}
              disabled={!hasNextPage}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
