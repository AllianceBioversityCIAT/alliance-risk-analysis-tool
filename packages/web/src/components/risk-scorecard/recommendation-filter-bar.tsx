'use client';

import { cn } from '@/lib/utils';
import { RecommendationPriority } from '@alliance-risk/shared';

type FilterValue = 'ALL' | RecommendationPriority;

interface RecommendationFilterBarProps {
  counts: Record<'ALL' | RecommendationPriority, number>;
  active: FilterValue;
  onChange: (filter: FilterValue) => void;
}

const FILTER_OPTIONS: { value: FilterValue; label: string; activeColor: string; inactiveColor: string }[] = [
  {
    value: 'ALL',
    label: 'All',
    activeColor: 'bg-foreground text-background shadow-sm ring-1 ring-foreground/20',
    inactiveColor: 'bg-muted/30 text-muted-foreground border-border hover:bg-muted/80 hover:text-foreground',
  },
  {
    value: RecommendationPriority.HIGH,
    label: 'High',
    activeColor: 'bg-orange-600 text-white shadow-sm ring-1 ring-orange-600/20',
    inactiveColor: 'bg-orange-50/50 text-orange-700 border-orange-200/50 hover:bg-orange-100/80',
  },
  {
    value: RecommendationPriority.MEDIUM,
    label: 'Medium',
    activeColor: 'bg-yellow-500 text-white shadow-sm ring-1 ring-yellow-500/20',
    inactiveColor: 'bg-yellow-50/50 text-yellow-700 border-yellow-200/50 hover:bg-yellow-100/80',
  },
  {
    value: RecommendationPriority.LOW,
    label: 'Low',
    activeColor: 'bg-green-600 text-white shadow-sm ring-1 ring-green-600/20',
    inactiveColor: 'bg-green-50/50 text-green-700 border-green-200/50 hover:bg-green-100/80',
  },
];

export function RecommendationFilterBar({ counts, active, onChange }: RecommendationFilterBarProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {FILTER_OPTIONS.map((opt) => {
        const isActive = active === opt.value;
        const count = counts[opt.value];
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors',
              isActive ? opt.activeColor : opt.inactiveColor,
              isActive && 'border-transparent',
            )}
          >
            {opt.label}
            <span className={cn('text-[10px]', isActive ? 'opacity-80' : 'opacity-60')}>
              ({count})
            </span>
          </button>
        );
      })}
    </div>
  );
}
