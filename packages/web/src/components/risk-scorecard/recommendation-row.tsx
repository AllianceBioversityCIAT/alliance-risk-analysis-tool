'use client';

import { useState } from 'react';
import { Lightbulb, Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { RecommendationPriority } from '@alliance-risk/shared';
import type { RecommendationResponse } from '@alliance-risk/shared';

const PRIORITY_CONFIG: Record<RecommendationPriority, { label: string; color: string; bg: string; border: string; indicator: string }> = {
  [RecommendationPriority.HIGH]: { label: 'High', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', indicator: 'bg-orange-500' },
  [RecommendationPriority.MEDIUM]: { label: 'Medium', color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200', indicator: 'bg-yellow-400' },
  [RecommendationPriority.LOW]: { label: 'Low', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', indicator: 'bg-green-500' },
};

interface RecommendationRowProps {
  recommendation: RecommendationResponse;
  onSave: (id: string, text: string) => Promise<void>;
}

export function RecommendationRow({ recommendation, onSave }: RecommendationRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(
    recommendation.editedText ?? recommendation.text,
  );
  const [isSaving, setIsSaving] = useState(false);

  const displayText = recommendation.isEdited
    ? recommendation.editedText ?? recommendation.text
    : recommendation.text;

  const priorityConfig = PRIORITY_CONFIG[recommendation.priority];

  async function handleSave() {
    setIsSaving(true);
    try {
      await onSave(recommendation.id, editText);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    setEditText(recommendation.editedText ?? recommendation.text);
    setIsEditing(false);
  }

  return (
    <div className="relative flex items-start gap-4 py-4 px-5 rounded-xl border bg-card shadow-sm hover:border-primary/20 hover:shadow-md transition-all duration-300 overflow-hidden group">
      {/* Priority Left Indicator Line */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-1", priorityConfig.indicator)} />

      {/* Icon */}
      <div className={cn("mt-0.5 rounded-full p-1.5 shrink-0 bg-muted/50")}>
        <Lightbulb className={cn("h-4 w-4", priorityConfig.color)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="w-full text-sm text-foreground bg-background border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-inner"
            rows={3}
            disabled={isSaving}
          />
        ) : (
          <p className="text-sm font-medium text-foreground leading-relaxed">{displayText}</p>
        )}

        <div className="flex items-center gap-2 mt-2">
          {/* Priority badge */}
          <span
            className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider border',
              priorityConfig.color,
              priorityConfig.bg,
              priorityConfig.border,
            )}
          >
            {priorityConfig.label}
          </span>

          {/* Edited badge */}
          {recommendation.isEdited && !isEditing && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-blue-50 text-blue-600 border border-blue-200">
              Edited
            </span>
          )}
        </div>
      </div>

      {/* Edit actions */}
      {isEditing ? (
        <div className="flex gap-1 shrink-0 ml-2">
          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={handleCancel} disabled={isSaving}>
            <X className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-muted-foreground hover:bg-green-100 hover:text-green-700" onClick={handleSave} disabled={isSaving || !editText.trim()}>
            <Check className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 rounded-full text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2 hover:bg-muted"
          onClick={() => setIsEditing(true)}
        >
          <Pencil className="h-4 w-4" />
          <span className="sr-only">Edit recommendation</span>
        </Button>
      )}
    </div>
  );
}
