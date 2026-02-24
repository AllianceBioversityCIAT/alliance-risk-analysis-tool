'use client';

import { useState } from 'react';
import { AlertTriangle, Info, CheckCircle, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { GapFieldStatus } from '@alliance-risk/shared';

interface GapFieldCardProps {
  id: string;
  label: string;
  currentValue?: string | null;
  status: GapFieldStatus;
  isMandatory?: boolean;
  onUpdate: (id: string, value: string) => Promise<void> | void;
}

const STATUS_CONFIG = {
  [GapFieldStatus.MISSING]: {
    icon: AlertTriangle,
    iconClass: 'text-destructive',
    borderClass: 'border-destructive/40',
    bgClass: 'bg-destructive/5',
    label: 'Missing',
    labelClass: 'text-destructive',
  },
  [GapFieldStatus.PARTIAL]: {
    icon: Info,
    iconClass: 'text-yellow-600',
    borderClass: 'border-yellow-400/60',
    bgClass: 'bg-yellow-50',
    label: 'Partial',
    labelClass: 'text-yellow-700',
  },
  [GapFieldStatus.VERIFIED]: {
    icon: CheckCircle,
    iconClass: 'text-green-600',
    borderClass: 'border-green-400/60',
    bgClass: 'bg-green-50',
    label: 'Verified',
    labelClass: 'text-green-700',
  },
};

export function GapFieldCard({
  id,
  label,
  currentValue,
  status,
  isMandatory = false,
  onUpdate,
}: GapFieldCardProps) {
  const [editValue, setEditValue] = useState(currentValue ?? '');
  const [isSaving, setIsSaving] = useState(false);

  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  async function handleSave() {
    setIsSaving(true);
    try {
      await onUpdate(id, editValue);
    } finally {
      setIsSaving(false);
    }
  }

  const hasChanged = editValue !== (currentValue ?? '');

  return (
    <div
      className={cn(
        'rounded-lg border p-4 transition-colors',
        config.borderClass,
        config.bgClass,
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className={cn('h-4 w-4 shrink-0', config.iconClass)} />
          <p className="text-sm font-medium text-foreground truncate">
            {label}
            {isMandatory && <span className="ml-1 text-destructive text-xs">*</span>}
          </p>
        </div>
        <span className={cn('text-xs font-semibold shrink-0', config.labelClass)}>
          {config.label}
        </span>
      </div>

      {/* Current extracted value */}
      {currentValue && (
        <p className="text-xs text-muted-foreground mb-2">
          Extracted: <span className="text-foreground font-medium">{currentValue}</span>
        </p>
      )}

      {/* Correction input */}
      <div className="flex gap-2">
        <Input
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          placeholder={status === GapFieldStatus.MISSING ? 'Enter value...' : 'Override value...'}
          className="h-8 text-sm flex-1"
          disabled={isSaving}
        />
        {hasChanged && (
          <Button
            size="sm"
            className="h-8 px-3 text-xs"
            onClick={handleSave}
            disabled={isSaving || !editValue.trim()}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Category Group ───────────────────────────────────────────────────────────

interface GapCategoryGroupProps {
  category: string;
  fields: GapFieldCardProps[];
}

export function GapCategoryGroup({ category, fields }: GapCategoryGroupProps) {
  const [isOpen, setIsOpen] = useState(true);

  const verifiedCount = fields.filter((f) => f.status === GapFieldStatus.VERIFIED).length;

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Accordion header */}
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <ChevronDown
            className={cn('h-4 w-4 text-muted-foreground transition-transform', !isOpen && '-rotate-90')}
          />
          <span className="text-sm font-semibold text-foreground">{category}</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {verifiedCount} of {fields.length} verified
        </span>
      </button>

      {/* Fields */}
      {isOpen && (
        <div className="p-3 space-y-2">
          {fields.map((field) => (
            <GapFieldCard key={field.id} {...field} />
          ))}
        </div>
      )}
    </div>
  );
}
