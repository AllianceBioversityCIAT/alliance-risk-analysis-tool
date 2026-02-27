'use client';

import { MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import { AvatarInitials } from '@/components/shared/avatar-initials';
import { StatusBadge } from '@/components/shared/status-badge';
import type { AssessmentStatus } from '@/components/shared/status-badge';
import { TableCell, TableRow } from '@/components/ui/table';

export interface AssessmentRowData {
  id: string;
  name: string;
  companyName: string;
  companyType?: string;
  status: string;
  progress: number;
  updatedAt: string;
}

interface AssessmentTableRowProps {
  assessment: AssessmentRowData;
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onResume?: (assessment: AssessmentRowData) => void;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function AssessmentTableRow({
  assessment,
  onView,
  onEdit,
  onDelete,
  onResume,
}: AssessmentTableRowProps) {
  const statusKey = assessment.status.toLowerCase().replace(/ /g, '_') as AssessmentStatus;

  return (
    <TableRow className="hover:bg-[#F8FAFC]/80">
      {/* Business Name */}
      <TableCell>
        <div className="flex items-center gap-3">
          <AvatarInitials name={assessment.companyName} size="md" className="rounded-lg" />
          <div>
            <p className="text-sm font-semibold text-foreground">{assessment.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{assessment.companyName}</p>
          </div>
        </div>
      </TableCell>

      {/* Date Modified */}
      <TableCell>
        <span className="text-sm text-muted-foreground">{formatDate(assessment.updatedAt)}</span>
      </TableCell>

      {/* Progress */}
      <TableCell>
        <div className="flex items-center gap-2">
          <Progress
            value={assessment.progress}
            className="h-2 w-24 rounded-full"
          />
          <span className="text-xs text-muted-foreground w-8">{assessment.progress}%</span>
        </div>
      </TableCell>

      {/* Status */}
      <TableCell>
        <StatusBadge status={statusKey} />
      </TableCell>

      {/* Actions */}
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {assessment.status === 'DRAFT' && onResume && (
              <DropdownMenuItem onClick={() => onResume(assessment)}>
                Resume
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onView?.(assessment.id)}>
              View
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit?.(assessment.id)}>
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => onDelete?.(assessment.id)}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
