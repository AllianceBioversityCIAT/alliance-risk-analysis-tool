'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface AvatarInitialsProps {
  name: string;
  className?: string;
  /** Add an orange ring around the avatar */
  withRing?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
};

export function AvatarInitials({
  name,
  className,
  withRing = false,
  size = 'md',
}: AvatarInitialsProps) {
  return (
    <Avatar
      className={cn(
        sizeClasses[size],
        withRing && 'ring-2 ring-[#F18E1C] ring-offset-1 ring-offset-transparent',
        className,
      )}
    >
      <AvatarFallback className="bg-primary/20 text-primary font-semibold">
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
