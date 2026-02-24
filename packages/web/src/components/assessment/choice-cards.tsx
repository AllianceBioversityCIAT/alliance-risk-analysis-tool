'use client';

import { cn } from '@/lib/utils';

interface ChoiceCardsProps {
  value: string | null;
  onChange: (value: string) => void;
  options?: { value: string; label: string }[];
  disabled?: boolean;
}

const DEFAULT_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

export function ChoiceCards({
  value,
  onChange,
  options = DEFAULT_OPTIONS,
  disabled = false,
}: ChoiceCardsProps) {
  return (
    <div className="flex gap-3">
      {options.map((opt) => {
        const isSelected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex-1 rounded-xl border-2 py-3 px-4 text-sm font-semibold transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'hover:border-primary/50 hover:bg-primary/5',
              isSelected
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-card text-foreground',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
