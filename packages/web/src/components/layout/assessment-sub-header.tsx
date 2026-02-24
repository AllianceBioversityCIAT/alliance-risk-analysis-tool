import { StatusBadge } from '@/components/shared/status-badge';
import type { AssessmentStatus } from '@/components/shared/status-badge';
import { cn } from '@/lib/utils';

interface AssessmentSubHeaderProps {
  businessName: string;
  businessType?: string;
  date?: Date | string;
  status: AssessmentStatus;
  className?: string;
}

function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function AssessmentSubHeader({
  businessName,
  businessType,
  date,
  status,
  className,
}: AssessmentSubHeaderProps) {
  const formattedDate = date ? formatDate(date) : null;

  return (
    <div
      className={cn(
        'flex items-center gap-4 px-6 py-3 text-white',
        className,
      )}
      style={{ backgroundColor: '#008F8F' }}
    >
      {/* Business info */}
      <div className="flex-1 min-w-0">
        <span className="font-semibold text-sm truncate">{businessName}</span>
        {businessType && (
          <span className="text-xs text-white/70 ml-2">{businessType}</span>
        )}
      </div>

      {/* Date */}
      {formattedDate && (
        <span className="text-xs text-white/80 hidden sm:block shrink-0">
          {formattedDate}
        </span>
      )}

      {/* Status badge — override with white-friendly styles */}
      <StatusBadge status={status} className="bg-white/20 border-white/30 text-white" />
    </div>
  );
}
