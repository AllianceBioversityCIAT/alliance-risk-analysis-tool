'use client';

import { useState } from 'react';
import { Lightbulb, Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { RecommendationPriority } from '@alliance-risk/shared';
import type { RecommendationResponse } from '@alliance-risk/shared';

const PRIORITY_CONFIG: Record<RecommendationPriority, { label: string; color: string; bg: string; border: string }> = {
  [RecommendationPriority.HIGH]: { label: 'High', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  [RecommendationPriority.MEDIUM]: { label: 'Medium', color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  [RecommendationPriority.LOW]: { label: 'Low', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
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
    <div className="flex items-start gap-3 py-3 px-4 rounded-lg border border-border hover:bg-muted/20 group transition-colors">
      {/* Icon */}
      <Lightbulb className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />

      {/* Content */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="w-full text-sm text-foreground bg-background border border-input rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            rows={3}
            disabled={isSaving}
          />
        ) : (
          <p className="text-sm text-foreground leading-relaxed">{displayText}</p>
        )}

        <div className="flex items-center gap-2 mt-1.5">
          {/* Priority badge */}
          <span
            className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border',
              priorityConfig.color,
              priorityConfig.bg,
              priorityConfig.border,
            )}
          >
            {priorityConfig.label}
          </span>

          {/* Edited badge */}
          {recommendation.isEdited && !isEditing && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600 border border-blue-200">
              Edited
            </span>
          )}
        </div>
      </div>

      {/* Edit actions */}
      {isEditing ? (
        <div className="flex gap-1 shrink-0">
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={handleCancel} disabled={isSaving}>
            <X className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={handleSave} disabled={isSaving || !editText.trim()}>
            <Check className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 opacity-0 group-hover:opacity-100 shrink-0 transition-opacity"
          onClick={() => setIsEditing(true)}
        >
          <Pencil className="h-3.5 w-3.5" />
          <span className="sr-only">Edit recommendation</span>
        </Button>
      )}
    </div>
  );
}
