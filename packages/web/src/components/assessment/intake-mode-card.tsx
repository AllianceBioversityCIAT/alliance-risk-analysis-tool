'use client';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Check, ArrowRight } from 'lucide-react';
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
  onSelect,
}: IntakeModeCardProps) {
  return (
    <div
      className={cn(
        'group relative flex flex-col rounded-xl border-2 p-6 transition-all',
        isSelected
          ? 'border-primary bg-white shadow-sm'
          : 'border-[#E2E8F0] bg-white hover:border-primary/40 hover:shadow-sm',
      )}
    >
      {/* Selected checkmark badge */}
      {isSelected && (
        <div className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white">
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </div>
      )}

      {/* Icon */}
      <div className="mb-5 h-14 w-14 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="h-7 w-7 text-primary" />
      </div>

      {/* Title */}
      <h4 className="text-lg font-semibold text-[#111827]">{title}</h4>

      {/* Description */}
      <p className="mt-2 text-sm leading-relaxed text-[#64748B]">{description}</p>

      {/* Features section */}
      <div className="mt-auto pt-6">{features}</div>

      {/* CTA Button */}
      <Button
        className={cn(
          'mt-6 w-full',
          isSelected
            ? 'bg-primary text-white hover:bg-primary/90'
            : 'border border-[#E2E8F0] bg-white text-[#111827] hover:bg-gray-50',
        )}
        variant={isSelected ? 'default' : 'outline'}
        disabled={isPending}
        onClick={onSelect}
      >
        {buttonLabel}
        {isSelected && <ArrowRight className="ml-2 h-4 w-4" />}
      </Button>
    </div>
  );
}

/** Supported formats badges (for Upload card) */
export function FormatBadges() {
  return (
    <div className="rounded-lg bg-[#F8FAFC] p-3">
      <p className="text-[10px] font-bold uppercase tracking-[1.1px] text-[#9CA3AF]">
        Supported Formats
      </p>
      <div className="mt-2 flex gap-2">
        {['PDF', 'DOCX', 'XLSX'].map((fmt) => (
          <span
            key={fmt}
            className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-[#64748B] border border-[#E2E8F0]"
          >
            {fmt}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Feature bullet list with checkmarks (for Interview / Manual cards) */
export function FeatureList({ items }: { items: string[] }) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item} className="flex items-center gap-2.5">
          <Check className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={2.5} />
          <span className="text-xs text-[#64748B]">{item}</span>
        </div>
      ))}
    </div>
  );
}
