'use client';

import { useState, useCallback, memo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
  Save,
  Briefcase,
  DollarSign,
  Settings,
  ShoppingBag,
  Shield,
  Sparkles,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { GapFieldStatus } from '@alliance-risk/shared';

// ─── Category icon + label mapping ────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  OPERATIONAL: Settings,
  FINANCIAL: DollarSign,
  MARKET: ShoppingBag,
  COMPLIANCE: Shield,
  BUSINESS_PROFILE: Briefcase,
};

const CATEGORY_LABELS: Record<string, string> = {
  OPERATIONAL: 'Operations',
  FINANCIAL: 'Financials',
  MARKET: 'Market',
  COMPLIANCE: 'Compliance',
  BUSINESS_PROFILE: 'Business Profile',
};

// ─── Field descriptions — explains WHY each field matters ─────────────────────

const FIELD_DESCRIPTIONS: Record<string, string> = {
  business_model_summary: 'Describes how the business creates and delivers value.',
  enterprise_type: 'Classifies the business structure for regulatory assessment.',
  country_of_operation: 'Determines geopolitical and market-specific risk factors.',
  product_service_description: 'Identifies the offering and its market positioning.',
  revenue_model: 'Helps assess income stability and lending capacity.',
  cost_drivers: 'Understanding costs helps evaluate profitability risk.',
  supply_chain_overview: 'Maps dependencies that could disrupt operations.',
  workforce_summary: 'Assesses human capital risks and organizational capacity.',
  customer_base: 'Evaluates revenue concentration and market risk.',
  key_challenges: 'Identifies known risks the business is already facing.',
};

// ─── GapFieldCard ─────────────────────────────────────────────────────────────

interface GapFieldCardProps {
  id: string;
  field: string;
  label: string;
  currentValue?: string | null;
  extractedValue?: string | null;
  status: GapFieldStatus;
  isMandatory?: boolean;
  confidence?: number | null;
  aiReasoning?: string | null;
  validationFeedback?: string | null;
  onUpdate: (id: string, value: string, currentStatus?: GapFieldStatus) => Promise<void> | void;
  onFieldFocus?: (value: string | null) => void;
}

const GapFieldCard = memo(function GapFieldCard({
  id,
  field,
  label,
  currentValue,
  extractedValue,
  status,
  isMandatory = false,
  confidence,
  aiReasoning,
  validationFeedback,
  onUpdate,
  onFieldFocus,
}: GapFieldCardProps) {
  const [editValue, setEditValue] = useState(currentValue ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);

  const isDirty = editValue !== (currentValue ?? '');
  const isEditing = isFocused || isDirty;
  const isMissing = status === GapFieldStatus.MISSING;
  const isPartial = status === GapFieldStatus.PARTIAL;
  const isVerified = status === GapFieldStatus.VERIFIED && !isDirty;

  const description = FIELD_DESCRIPTIONS[field];

  const handleSave = useCallback(async () => {
    if (!editValue.trim()) return;
    setIsSaving(true);
    try {
      await onUpdate(id, editValue, status);
    } finally {
      setIsSaving(false);
      setIsFocused(false);
    }
  }, [id, editValue, onUpdate, status]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && isDirty && editValue.trim()) {
        e.preventDefault();
        handleSave();
      }
    },
    [isDirty, editValue, handleSave],
  );

  // Left border color by state
  const borderLeftColor = isMissing && !isEditing
    ? 'border-l-red-500'
    : isEditing
      ? 'border-l-emerald-500'
      : isVerified
        ? 'border-l-emerald-500'
        : 'border-l-amber-400';

  // Show save icon when field needs action
  const showSaveIcon = !isVerified || isDirty;

  return (
    <div
      className={cn(
        'rounded-lg border border-border/80 p-4 transition-all border-l-4 cursor-pointer hover:shadow-sm',
        borderLeftColor,
        isMissing && !isEditing && 'bg-red-50/40',
      )}
      onClick={() => onFieldFocus?.(`${label} ${extractedValue ?? currentValue ?? ''}`)}
    >
      {/* Label + Status badge */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-medium text-foreground">
          {label}
          {isMandatory && <span className="ml-0.5 text-destructive text-xs align-super">*</span>}
        </span>

        {/* Status badges */}
        {isMissing && !isEditing && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-red-500 text-white">
            <AlertTriangle className="h-3 w-3" />
            MISSING DATA
          </span>
        )}
        {isVerified && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500 text-white">
            <CheckCircle2 className="h-3 w-3" />
            VERIFIED
          </span>
        )}
        {isEditing && (
          <span className="text-[11px] font-semibold text-emerald-600">Editing...</span>
        )}
        {confidence != null && confidence > 0 && !isEditing && (
          <span
            className={cn(
              'text-[10px] font-medium px-1.5 py-0.5 rounded',
              confidence >= 0.8
                ? 'text-green-700 bg-green-100'
                : confidence >= 0.5
                  ? 'text-yellow-700 bg-yellow-100'
                  : 'text-red-700 bg-red-100',
            )}
          >
            {Math.round(confidence * 100)}%
          </span>
        )}
        {isPartial && !isEditing && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500 text-white">
            PARTIAL
          </span>
        )}
      </div>

      {/* Helper text — explains WHY this field matters */}
      {description && (
        <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{description}</p>
      )}

      {/* AI Extraction — read-only block showing what AI found */}
      {extractedValue && (
        <div className="mb-3 px-3 py-2 bg-muted/40 rounded-md border-l-2 border-primary/30">
          <div className="flex items-center gap-1 mb-0.5">
            <Sparkles className="h-3 w-3 text-primary/70" />
            <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wide">AI Extracted</span>
          </div>
          <p className="text-xs text-foreground/80 leading-relaxed line-clamp-3">{extractedValue}</p>
        </div>
      )}

      {/* Textarea + Save icon */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div className="flex items-start gap-2" onClick={(e) => e.stopPropagation()}>
        <Textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => !isDirty && setIsFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder={
            isMissing
              ? 'Provide the missing information...'
              : isPartial
                ? 'Add more details to complete this field...'
                : 'Correct or add to the AI extraction...'
          }
          className={cn(
            'text-sm flex-1 min-h-[2.25rem] resize-none',
            isMissing && !isEditing && 'border-red-200 focus-visible:ring-red-300',
          )}
          disabled={isSaving}
        />
        {showSaveIcon && (
          <button
            type="button"
            onClick={isDirty && editValue.trim() ? handleSave : undefined}
            disabled={!isDirty || !editValue.trim() || isSaving}
            title="Save changes (Ctrl+Enter)"
            aria-label={`Save ${label}`}
            className={cn(
              'h-9 w-9 rounded-lg flex items-center justify-center shrink-0 transition-colors mt-0.5',
              isDirty && editValue.trim()
                ? 'bg-emerald-500 text-white hover:bg-emerald-600 cursor-pointer'
                : isMissing || isPartial
                  ? 'bg-red-100 text-red-400 cursor-default'
                  : 'bg-muted text-muted-foreground cursor-default',
            )}
          >
            <Save className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Validation feedback warning */}
      {validationFeedback && isPartial && !isEditing && (
        <div className="flex items-start gap-1.5 mt-2 px-2.5 py-2 rounded-md bg-amber-50 border border-amber-200">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 leading-relaxed">{validationFeedback}</p>
        </div>
      )}

      {/* Save hint when editing */}
      {isFocused && isDirty && (
        <p className="text-[10px] text-muted-foreground mt-1.5 ml-0.5">
          Press <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">Ctrl+Enter</kbd> to save
        </p>
      )}

      {/* AI Reasoning expandable */}
      {aiReasoning && (
        <div className="mt-2.5">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowReasoning((prev) => !prev); }}
            aria-expanded={showReasoning}
            aria-label="Toggle AI reasoning"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown
              className={cn('h-3 w-3 transition-transform', showReasoning && 'rotate-180')}
            />
            <span>AI Reasoning</span>
          </button>
          {showReasoning && (
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2.5 mt-1.5 leading-relaxed">
              {aiReasoning}
            </p>
          )}
        </div>
      )}
    </div>
  );
});

// ─── Category Group ───────────────────────────────────────────────────────────

interface GapCategoryGroupProps {
  category: string;
  fields: GapFieldCardProps[];
}

const GapCategoryGroupInner = function GapCategoryGroup({
  category,
  fields,
}: GapCategoryGroupProps) {
  const [isOpen, setIsOpen] = useState(true);

  const Icon = CATEGORY_ICONS[category] ?? Briefcase;
  const displayName = CATEGORY_LABELS[category] ?? category;

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      {/* Accordion header */}
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <span className="text-sm font-semibold text-foreground">{displayName}</span>
        </div>
        <ChevronUp
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform',
            !isOpen && 'rotate-180',
          )}
        />
      </button>

      {/* Fields */}
      {isOpen && (
        <div className="px-4 pb-4 space-y-3">
          {fields.map((field) => (
            <GapFieldCard key={field.id} {...field} />
          ))}
        </div>
      )}
    </div>
  );
};

export const GapCategoryGroup = memo(GapCategoryGroupInner);
export { GapFieldCard };
