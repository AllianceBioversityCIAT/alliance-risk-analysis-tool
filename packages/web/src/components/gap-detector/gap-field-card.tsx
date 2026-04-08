'use client';

import { useState, useCallback, useEffect, memo, useRef } from 'react';
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
  Pencil,
  X,
  Check,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
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
  isExpanded?: boolean;
  onToggleExpand?: (id: string) => void;
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
  isExpanded = false,
  onToggleExpand,
}: GapFieldCardProps) {
  const [editValue, setEditValue] = useState(currentValue ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea when expanded
  useEffect(() => {
    if (isExpanded) {
      // Small timeout to allow transition to complete
      setTimeout(() => {
        textareaRef.current?.focus();
        // Move cursor to end
        const length = textareaRef.current?.value.length ?? 0;
        textareaRef.current?.setSelectionRange(length, length);
      }, 50);
    } else {
      // Sync editValue when collapsed to discard unsaved typing or pick up new server data
      setEditValue(currentValue ?? '');
      setShowReasoning(false);
    }
  }, [isExpanded, currentValue]);

  // Sync editValue when currentValue changes externally (e.g. server response after save)
  useEffect(() => {
    if (!isExpanded) {
      setEditValue(currentValue ?? '');
    }
  }, [currentValue, isExpanded]);

  const isDirty = editValue !== (currentValue ?? '');
  const isMissing = status === GapFieldStatus.MISSING;
  const isPartial = status === GapFieldStatus.PARTIAL;
  const isVerified = status === GapFieldStatus.VERIFIED;

  const description = FIELD_DESCRIPTIONS[field];

  const handleSave = useCallback(async () => {
    if (!editValue.trim() && isMandatory) return; // Prevent saving empty if mandatory (optional validation)
    setIsSaving(true);
    try {
      await onUpdate(id, editValue, status);
      onToggleExpand?.(id); // Auto-collapse on successful save
    } finally {
      setIsSaving(false);
    }
  }, [id, editValue, isMandatory, onUpdate, status, onToggleExpand]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && isDirty && editValue.trim()) {
        e.preventDefault();
        handleSave();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onToggleExpand?.(id);
      }
    },
    [isDirty, editValue, handleSave, onToggleExpand, id],
  );

  const handleContainerClick = () => {
    if (!isExpanded) {
      onToggleExpand?.(id);
      onFieldFocus?.(`${label} ${extractedValue ?? currentValue ?? ''}`);
    }
  };

  // Border color by state
  const borderIndicatorColor = isMissing
    ? 'bg-red-500'
    : isPartial
      ? 'bg-amber-400'
      : 'bg-emerald-500';

  const previewText = currentValue || extractedValue || 'No data found...';

  return (
    <div
      className={cn(
        'relative rounded-xl border bg-card transition-all duration-200 overflow-hidden group',
        isExpanded 
          ? 'border-primary/30 shadow-md my-4' 
          : 'border-border/60 hover:border-primary/30 hover:shadow-sm cursor-pointer',
      )}
      onClick={handleContainerClick}
    >
      {/* Left indicator bar */}
      <div className={cn('absolute left-0 top-0 bottom-0 w-1 transition-colors', borderIndicatorColor)} />

      {!isExpanded ? (
        /* ─── Collapsed State (Inbox Row) ─────────────────────────────────────── */
        <div className="flex items-center gap-3 py-3 px-4 pl-5">
          <div className="flex items-center gap-2 shrink-0 w-1/3 min-w-[200px]">
            {isMissing ? (
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
            ) : isPartial ? (
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            )}
            <span className="text-sm font-semibold text-foreground truncate">
              {label}
              {isMandatory && <span className="ml-0.5 text-destructive text-xs align-super">*</span>}
            </span>
          </div>

          <p className={cn(
            'flex-1 text-sm truncate pr-8',
            (!currentValue && !extractedValue) ? 'text-muted-foreground/60 italic' : 'text-muted-foreground'
          )}>
            {previewText}
          </p>

          {/* Hover Action */}
          <div className="absolute right-3 opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
             <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-muted-foreground hover:bg-muted" tabIndex={-1}>
               <Pencil className="h-4 w-4" />
             </Button>
          </div>
        </div>
      ) : (
        /* ─── Expanded State (Editor) ─────────────────────────────────────────── */
        <div className="p-5 pl-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                {isMissing ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700 border border-red-200 shadow-sm">
                    <AlertTriangle className="h-3 w-3" />
                    Missing Data
                  </span>
                ) : isPartial ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-200 shadow-sm">
                    Partial
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-sm">
                    <CheckCircle2 className="h-3 w-3" />
                    Verified
                  </span>
                )}
                
                {confidence != null && confidence > 0 && (
                  <span
                    className={cn(
                      'text-[10px] font-bold px-1.5 py-0.5 rounded-md border shadow-sm',
                      confidence >= 0.8
                        ? 'text-green-700 bg-green-50 border-green-200'
                        : confidence >= 0.5
                          ? 'text-yellow-700 bg-yellow-50 border-yellow-200'
                          : 'text-red-700 bg-red-50 border-red-200',
                    )}
                  >
                    {Math.round(confidence * 100)}% Confident
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-foreground tracking-tight">
                {label}
                {isMandatory && <span className="ml-1 text-destructive">*</span>}
              </h3>
              {description && (
                <p className="text-sm text-muted-foreground mt-1">{description}</p>
              )}
            </div>

            {/* Top right actions (Close) */}
            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full shrink-0 text-muted-foreground hover:bg-muted" onClick={() => onToggleExpand?.(id)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Validation feedback warning */}
          {validationFeedback && isPartial && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200 shadow-sm">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800 leading-relaxed">{validationFeedback}</p>
            </div>
          )}

          {/* AI Extraction — read-only block showing what AI found */}
          {extractedValue && (
            <div className="px-4 py-3 bg-muted/30 rounded-lg border border-border/60 shadow-sm">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary/70" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">AI Extracted</span>
              </div>
              <p className="text-sm text-foreground/90 leading-relaxed">{extractedValue}</p>
            </div>
          )}

          {/* Editor Area */}
          <div className="space-y-3">
            <Textarea
              ref={textareaRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isMissing
                  ? 'Provide the missing information...'
                  : isPartial
                    ? 'Add more details to complete this field...'
                    : 'Correct or add to the AI extraction...'
              }
              className={cn(
                'text-sm min-h-[5rem] resize-y rounded-lg shadow-inner focus-visible:ring-primary/50',
                isMissing && !isDirty && 'border-red-200 focus-visible:ring-red-300 bg-red-50/20',
              )}
              disabled={isSaving}
            />
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-medium text-muted-foreground">
                  <kbd className="px-1.5 py-0.5 rounded-md bg-muted border border-border font-mono text-[10px] shadow-sm">Esc</kbd> to cancel
                </p>
                <p className="text-[11px] font-medium text-muted-foreground">
                  <kbd className="px-1.5 py-0.5 rounded-md bg-muted border border-border font-mono text-[10px] shadow-sm">Ctrl+Enter</kbd> to save
                </p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => onToggleExpand?.(id)} disabled={isSaving}>
                  Cancel
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleSave} 
                  disabled={(!isDirty && !isMissing) || (!editValue.trim() && isMandatory) || isSaving}
                  className="shadow-sm"
                >
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </div>

          {/* AI Reasoning expandable */}
          {aiReasoning && (
            <div className="pt-2 border-t border-border/50">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowReasoning((prev) => !prev); }}
                aria-expanded={showReasoning}
                className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronDown
                  className={cn('h-3.5 w-3.5 transition-transform', showReasoning && 'rotate-180')}
                />
                <span>View AI Reasoning</span>
              </button>
              {showReasoning && (
                <div className="mt-2 p-3 bg-muted/40 rounded-lg border border-border/50 text-sm text-foreground/80 leading-relaxed shadow-sm">
                  {aiReasoning}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// ─── Category Group ───────────────────────────────────────────────────────────

interface GapCategoryGroupProps {
  category: string;
  fields: Omit<GapFieldCardProps, 'isExpanded' | 'onToggleExpand'>[];
}

const GapCategoryGroupInner = function GapCategoryGroup({
  category,
  fields,
}: GapCategoryGroupProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const Icon = CATEGORY_ICONS[category] ?? Briefcase;
  const displayName = CATEGORY_LABELS[category] ?? category;

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedId((current) => (current === id ? null : id));
  }, []);

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
      {/* Accordion header */}
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <span className="text-sm font-bold text-foreground tracking-tight">{displayName}</span>
          <span className="ml-2 px-2 py-0.5 rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
            {fields.length}
          </span>
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
        <div className="px-5 pb-5 pt-1 space-y-2">
          {fields.map((field) => (
            <GapFieldCard 
              key={field.id} 
              {...field} 
              isExpanded={expandedId === field.id}
              onToggleExpand={handleToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const GapCategoryGroup = memo(GapCategoryGroupInner);
export { GapFieldCard };
