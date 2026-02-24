'use client';

import { cn } from '@/lib/utils';

interface CurrencyInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  currency?: string;
  unit?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function CurrencyInput({
  id,
  value,
  onChange,
  currency = 'USD',
  unit,
  placeholder = '0',
  disabled = false,
  className,
}: CurrencyInputProps) {
  return (
    <div className={cn('flex items-stretch rounded-md border border-input overflow-hidden focus-within:ring-2 focus-within:ring-ring', className)}>
      {/* Currency badge */}
      <div className="flex items-center px-3 bg-muted border-r border-input text-sm font-medium text-muted-foreground shrink-0">
        {currency}
      </div>

      {/* Number input */}
      <input
        id={id}
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          'flex-1 h-9 px-3 text-sm bg-background text-foreground outline-none',
          'placeholder:text-muted-foreground',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      />

      {/* Unit suffix */}
      {unit && (
        <div className="flex items-center px-3 bg-muted border-l border-input text-xs text-muted-foreground shrink-0">
          {unit}
        </div>
      )}
    </div>
  );
}
