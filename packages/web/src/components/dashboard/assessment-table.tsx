'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, FileSearch, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { AssessmentTableRow, type AssessmentRowData } from './assessment-table-row';

type SortKey = 'updatedAt' | 'progress' | 'status';
type SortDir = 'asc' | 'desc';

interface AssessmentTableProps {
  assessments: AssessmentRowData[];
  total: number;
  currentPage: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  isLoading?: boolean;
  /** Active search query — drives contextual heading and empty state */
  searchQuery?: string;
  /** Active country filter — drives country-specific empty state */
  activeCountry?: string;
  /** Active status filter — drives pill highlight */
  activeStatus?: string;
  onStatusFilter?: (status: string | undefined) => void;
  onNextPage: () => void;
  onPrevPage: () => void;
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onResume?: (assessment: AssessmentRowData) => void;
}

const STATUS_PILLS = [
  { key: undefined, label: 'All' },
  { key: 'DRAFT', label: 'Draft' },
  { key: 'ANALYZING', label: 'Analyzing' },
  { key: 'ACTION_REQUIRED', label: 'Action Required' },
  { key: 'COMPLETE', label: 'Complete' },
] as const;

const STATUS_ORDER: Record<string, number> = {
  DRAFT: 0,
  ANALYZING: 1,
  ACTION_REQUIRED: 2,
  COMPLETE: 3,
};

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

function SortIcon({ active, direction }: { active: boolean; direction: SortDir }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
  return direction === 'asc'
    ? <ArrowUp className="h-3 w-3 ml-1" />
    : <ArrowDown className="h-3 w-3 ml-1" />;
}

function getHeading(searchQuery: string, activeStatus: string | undefined): string {
  if (searchQuery.length > 0) return `Results for "${searchQuery}"`;
  if (activeStatus) {
    const label = STATUS_PILLS.find((p) => p.key === activeStatus)?.label ?? '';
    return `${label} Assessments`;
  }
  return 'Active Assessments';
}

function FilteredEmptyState({ searchQuery }: Readonly<{ searchQuery: string }>) {
  return (
    <div className="flex flex-col items-center gap-2">
      <FileSearch className="h-10 w-10 text-muted-foreground/50" />
      <p className="text-sm font-medium text-foreground">No results found</p>
      <p className="text-sm text-muted-foreground">
        {searchQuery
          ? <>No results for &ldquo;{searchQuery}&rdquo;. Try a different search term.</>
          : 'No assessments match this filter.'}
      </p>
    </div>
  );
}

function NoAssessmentsEmptyState({ activeCountry }: Readonly<{ activeCountry: string | undefined }>) {
  return (
    <div className="flex flex-col items-center gap-2">
      <FileSearch className="h-10 w-10 text-muted-foreground/50" />
      <p className="text-sm font-medium text-foreground">
        {activeCountry ? `No assessments for ${activeCountry} yet` : 'No assessments yet'}
      </p>
      <p className="text-sm text-muted-foreground">
        Click &ldquo;Start New Assessment&rdquo; to create your first risk assessment.
      </p>
    </div>
  );
}

interface AssessmentTableBodyProps {
  isLoading: boolean;
  sortedAssessments: AssessmentRowData[];
  isFiltering: boolean;
  searchQuery: string;
  activeCountry: string | undefined;
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onResume?: (assessment: AssessmentRowData) => void;
}

function AssessmentTableBody({
  isLoading,
  sortedAssessments,
  isFiltering,
  searchQuery,
  activeCountry,
  onView,
  onEdit,
  onDelete,
  onResume,
}: Readonly<AssessmentTableBodyProps>) {
  if (isLoading) {
    return <>{Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} />)}</>;
  }

  if (sortedAssessments.length === 0) {
    return (
      <TableRow>
        <td colSpan={5} className="py-16 text-center">
          {isFiltering
            ? <FilteredEmptyState searchQuery={searchQuery} />
            : <NoAssessmentsEmptyState activeCountry={activeCountry} />}
        </td>
      </TableRow>
    );
  }

  return (
    <>
      {sortedAssessments.map((assessment) => (
        <AssessmentTableRow
          key={assessment.id}
          assessment={assessment}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
          onResume={onResume}
        />
      ))}
    </>
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
  searchQuery = '',
  activeCountry,
  activeStatus,
  onStatusFilter,
  onNextPage,
  onPrevPage,
  onView,
  onEdit,
  onDelete,
  onResume,
}: Readonly<AssessmentTableProps>) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const startRecord = (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(currentPage * pageSize, total);
  const isFiltering = searchQuery.length > 0 || !!activeStatus;
  const heading = getHeading(searchQuery, activeStatus);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'updatedAt' ? 'desc' : 'asc');
    }
  };

  const sortedAssessments = useMemo(() => {
    if (!sortKey) return assessments;
    return [...assessments].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'updatedAt':
          cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
        case 'progress':
          cmp = a.progress - b.progress;
          break;
        case 'status':
          cmp = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [assessments, sortKey, sortDir]);

  const thClass = 'text-[11px] font-bold uppercase tracking-[1.1px] text-[#9CA3AF]';
  const sortableThClass = `${thClass} cursor-pointer select-none hover:text-[#6B7280] transition-colors`;

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      {/* Table heading + filter pills */}
      <div className="px-6 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">{heading}</h2>
        {onStatusFilter && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {STATUS_PILLS.map((pill) => (
              <button
                key={pill.label}
                onClick={() => onStatusFilter(pill.key)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                  activeStatus === pill.key || (!activeStatus && !pill.key)
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]',
                )}
              >
                {pill.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow className="bg-[#F8FAFC]/50 hover:bg-[#F8FAFC]/50">
            <TableHead className={cn(thClass, 'w-72')}>
              Business Name
            </TableHead>
            <TableHead
              className={sortableThClass}
              onClick={() => handleSort('updatedAt')}
            >
              <span className="flex items-center">
                Date Modified
                <SortIcon active={sortKey === 'updatedAt'} direction={sortDir} />
              </span>
            </TableHead>
            <TableHead
              className={sortableThClass}
              onClick={() => handleSort('progress')}
            >
              <span className="flex items-center">
                Progress
                <SortIcon active={sortKey === 'progress'} direction={sortDir} />
              </span>
            </TableHead>
            <TableHead
              className={sortableThClass}
              onClick={() => handleSort('status')}
            >
              <span className="flex items-center">
                Status
                <SortIcon active={sortKey === 'status'} direction={sortDir} />
              </span>
            </TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          <AssessmentTableBody
            isLoading={isLoading}
            sortedAssessments={sortedAssessments}
            isFiltering={isFiltering}
            searchQuery={searchQuery}
            activeCountry={activeCountry}
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
            onResume={onResume}
          />
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
