'use client';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Check, ArrowRight, Lock, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface IntakeModeCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  features: ReactNode;
  buttonLabel: string;
  isSelected?: boolean;
  isPending?: boolean;
  /** When true, card is locked — non-interactive with a "Coming Soon" treatment */
  isComingSoon?: boolean;
  onSelect: () => void;
}

export function IntakeModeCard({
  icon: Icon,
  title,
  description,
  features,
  buttonLabel,
  isSelected = false,
  isPending = false,
  isComingSoon = false,
  onSelect,
}: IntakeModeCardProps) {
  const isDisabled = isPending || isComingSoon;

  return (
    <div
      className={cn(
        'group relative flex flex-col rounded-xl border-2 p-6 transition-all duration-200',
        // Coming soon — muted, locked look
        isComingSoon && 'border-[#E2E8F0] bg-[#F8FAFC] opacity-70 cursor-not-allowed select-none',
        // Active, unselected
        !isComingSoon && !isSelected && 'border-[#E2E8F0] bg-white hover:border-primary/40 hover:shadow-sm cursor-pointer',
        // Active, selected
        !isComingSoon && isSelected && 'border-primary bg-white shadow-md ring-1 ring-primary/20 cursor-pointer',
      )}
      aria-disabled={isComingSoon}
      title={isComingSoon ? `${title} — Coming soon` : undefined}
    >
      {/* Coming Soon pill — top-right badge */}
      {isComingSoon && (
        <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-[#F1F5F9] border border-[#E2E8F0] px-2.5 py-1">
          <Clock className="h-3 w-3 text-[#94A3B8]" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">
            Coming Soon
          </span>
        </div>
      )}

      {/* Selected checkmark badge */}
      {isSelected && !isComingSoon && (
        <div className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white shadow-sm">
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </div>
      )}

      {/* Icon container — dimmed for locked cards */}
      <div
        className={cn(
          'mb-5 h-14 w-14 rounded-lg flex items-center justify-center transition-colors',
          isComingSoon
            ? 'bg-[#F1F5F9]'
            : isSelected
              ? 'bg-primary/10'
              : 'bg-primary/10 group-hover:bg-primary/15',
        )}
      >
        {isComingSoon ? (
          <Lock className="h-6 w-6 text-[#CBD5E1]" />
        ) : (
          <Icon
            className={cn(
              'h-7 w-7 transition-colors',
              isSelected ? 'text-primary' : 'text-primary/80 group-hover:text-primary',
            )}
          />
        )}
      </div>

      {/* Title */}
      <h4
        className={cn(
          'text-lg font-semibold',
          isComingSoon ? 'text-[#94A3B8]' : 'text-[#111827]',
        )}
      >
        {title}
      </h4>

      {/* Description */}
      <p
        className={cn(
          'mt-2 text-sm leading-relaxed',
          isComingSoon ? 'text-[#CBD5E1]' : 'text-[#64748B]',
        )}
      >
        {description}
      </p>

      {/* Features */}
      <div className={cn('mt-auto pt-6', isComingSoon && 'pointer-events-none')}>
        {features}
      </div>

      {/* CTA Button */}
      {isComingSoon ? (
        <div className="mt-6 flex h-9 w-full items-center justify-center rounded-md border border-[#E2E8F0] bg-[#F1F5F9] text-sm font-medium text-[#CBD5E1] cursor-not-allowed">
          Not available yet
        </div>
      ) : (
        <Button
          className={cn(
            'mt-6 w-full transition-all',
            isSelected
              ? 'bg-primary text-white hover:bg-primary/90 shadow-sm'
              : 'border border-[#E2E8F0] bg-white text-[#111827] hover:bg-gray-50',
          )}
          variant={isSelected ? 'default' : 'outline'}
          disabled={isDisabled}
          onClick={onSelect}
        >
          {buttonLabel}
          {isSelected && <ArrowRight className="ml-2 h-4 w-4" />}
        </Button>
      )}
    </div>
  );
}

// ─── FormatBadges ─────────────────────────────────────────────────────────────

/** Supported formats badges (for Upload card) — PDF only for MVP */
export function FormatBadges() {
  return (
    <div className="rounded-lg bg-[#F8FAFC] p-3">
      <p className="text-[10px] font-bold uppercase tracking-[1.1px] text-[#9CA3AF]">
        Supported Formats
      </p>
      <div className="mt-2 flex gap-2">
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-[#64748B] border border-[#E2E8F0]">
          PDF
        </span>
      </div>
    </div>
  );
}

// ─── FeatureList ──────────────────────────────────────────────────────────────

/** Feature bullet list with checkmarks */
export function FeatureList({ items, muted = false }: { items: string[]; muted?: boolean }) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item} className="flex items-center gap-2.5">
          <Check
            className={cn('h-3.5 w-3.5 shrink-0', muted ? 'text-[#CBD5E1]' : 'text-primary')}
            strokeWidth={2.5}
          />
          <span className={cn('text-xs', muted ? 'text-[#CBD5E1]' : 'text-[#64748B]')}>
            {item}
          </span>
        </div>
      ))}
    </div>
  );
}
