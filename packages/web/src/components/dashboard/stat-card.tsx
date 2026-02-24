import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface StatCardProps {
  icon: LucideIcon;
  value: number | string;
  label: string;
  trend?: string;
  iconBgClass?: string;
  isLoading?: boolean;
}

export function StatCard({
  icon: Icon,
  value,
  label,
  trend,
  iconBgClass = 'bg-primary/10',
  isLoading = false,
}: StatCardProps) {
  if (isLoading) {
    return (
      <div className="bg-card border border-[#F5F5F5] rounded-xl shadow-sm p-6">
        <div className="flex items-start justify-between">
          <Skeleton className="h-10 w-10 rounded-lg" />
          {trend && <Skeleton className="h-5 w-16 rounded-full" />}
        </div>
        <Skeleton className="h-8 w-16 mt-4" />
        <Skeleton className="h-4 w-24 mt-2" />
      </div>
    );
  }

  return (
    <div className="bg-card border border-[#F5F5F5] rounded-xl shadow-sm p-6">
      <div className="flex items-start justify-between">
        {/* Icon */}
        <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center', iconBgClass)}>
          <Icon className="h-5 w-5 text-primary" />
        </div>

        {/* Trend badge */}
        {trend && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
            {trend}
          </span>
        )}
      </div>

      {/* Value */}
      <p className="mt-4 text-[30px] font-bold text-foreground leading-none">{value}</p>

      {/* Label */}
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
