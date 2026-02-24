'use client';

import { Pencil, Trash2, ToggleLeft, ToggleRight, MessageSquare } from 'lucide-react';
import type { PromptSummary } from '@alliance-risk/shared';
import { AGENT_SECTION_LABELS } from '@alliance-risk/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface PromptCardProps {
  prompt: PromptSummary;
  onEdit: (prompt: PromptSummary) => void;
  onToggle: (prompt: PromptSummary) => void;
  onDelete: (prompt: PromptSummary) => void;
}

export function PromptCard({ prompt, onEdit, onToggle, onDelete }: PromptCardProps) {
  return (
    <Card className="relative overflow-hidden">
      {/* Active indicator stripe */}
      <div
        className={`absolute left-0 top-0 h-full w-1 ${
          prompt.isActive ? 'bg-emerald-500' : 'bg-gray-300'
        }`}
        aria-hidden
      />
      <CardHeader className="pb-2 pl-5">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold leading-tight line-clamp-2">{prompt.name}</h3>
            <p className="text-xs text-muted-foreground">
              {AGENT_SECTION_LABELS[prompt.section]}
              {prompt.route && <span> · {prompt.route}</span>}
            </p>
          </div>
          <Badge
            variant="outline"
            className={`shrink-0 text-xs ${
              prompt.isActive
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-gray-200 bg-gray-50 text-gray-500'
            }`}
          >
            {prompt.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pl-5 pb-3 space-y-3">
        {/* Categories */}
        {prompt.categories.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {prompt.categories.slice(0, 3).map((cat) => (
              <Badge key={cat} variant="secondary" className="text-xs px-1.5 py-0">
                {cat}
              </Badge>
            ))}
            {prompt.categories.length > 3 && (
              <span className="text-xs text-muted-foreground">
                +{prompt.categories.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Tags */}
        {prompt.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {prompt.tags.slice(0, 4).map((tag) => (
              <span key={tag} className="text-xs text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer: version, comments, actions */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>v{prompt.version}</span>
            {prompt.commentsCount > 0 && (
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {prompt.commentsCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label={`${prompt.isActive ? 'Deactivate' : 'Activate'} ${prompt.name}`}
              onClick={() => onToggle(prompt)}
            >
              {prompt.isActive ? (
                <ToggleRight className="h-4 w-4 text-emerald-600" />
              ) : (
                <ToggleLeft className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label={`Edit ${prompt.name}`}
              onClick={() => onEdit(prompt)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              aria-label={`Delete ${prompt.name}`}
              onClick={() => onDelete(prompt)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
