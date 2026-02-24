import { cn } from '@/lib/utils';

export type AssessmentStatus = 'draft' | 'analyzing' | 'action_required' | 'complete';

interface StatusBadgeProps {
  status: AssessmentStatus;
  className?: string;
}

const statusConfig: Record<
  AssessmentStatus,
  { label: string; bg: string; border: string; text: string }
> = {
  draft: {
    label: 'Draft',
    bg: '#F5F5F5',
    border: '#E2E8F0',
    text: '#475569',
  },
  analyzing: {
    label: 'Analyzing',
    bg: '#F4F9F9',
    border: '#DCFCE7',
    text: '#1D4ED8',
  },
  action_required: {
    label: 'Action Required',
    bg: '#FFF7ED',
    border: '#FED7AA',
    text: '#C2410C',
  },
  complete: {
    label: 'Complete',
    bg: '#F4F9F9',
    border: '#DCFCE7',
    text: '#15803D',
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        className,
      )}
      style={{
        backgroundColor: config.bg,
        borderColor: config.border,
        color: config.text,
      }}
    >
      {config.label}
    </span>
  );
}
