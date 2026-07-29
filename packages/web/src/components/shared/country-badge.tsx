'use client';

import { getCountryFlag } from '@alliance-risk/shared';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface CountryBadgeProps {
  country: string;
  className?: string;
  variant?: 'default' | 'onDark';
}

export function CountryBadge({ country, className, variant = 'default' }: CountryBadgeProps) {
  const flag = getCountryFlag(country as Parameters<typeof getCountryFlag>[0]);

  if (variant === 'onDark') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 text-xs text-white/80 shrink-0',
          className,
        )}
      >
        <span className="text-sm">{flag}</span>
        {country}
      </span>
    );
  }

  return (
    <Badge variant="secondary" className={cn('font-normal gap-1', className)}>
      <span>{flag}</span>
      {country}
    </Badge>
  );
}
