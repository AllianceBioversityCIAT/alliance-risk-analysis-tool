'use client';

import { History } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { usePromptHistory } from '@/hooks/use-prompts';

const CHANGE_TYPE_LABELS: Record<string, string> = {
  CREATE: 'Created',
  UPDATE: 'Updated',
  DELETE: 'Deleted',
  ACTIVATE: 'Activated',
  DEACTIVATE: 'Deactivated',
};

const CHANGE_TYPE_COLORS: Record<string, string> = {
  CREATE: 'text-emerald-600 bg-emerald-50',
  UPDATE: 'text-blue-600 bg-blue-50',
  DELETE: 'text-destructive bg-destructive/10',
  ACTIVATE: 'text-emerald-600 bg-emerald-50',
  DEACTIVATE: 'text-amber-600 bg-amber-50',
};

interface ChangeHistoryProps {
  promptId: string;
}

export function ChangeHistory({ promptId }: ChangeHistoryProps) {
  const { data: history, isLoading } = usePromptHistory(promptId);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <History className="h-4 w-4" />
        Change History
        {history && (
          <span className="text-xs text-muted-foreground">({history.length} changes)</span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-6 w-16 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : !history || history.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No history yet.</p>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-3 top-1 bottom-1 w-px bg-border" aria-hidden />

          <div className="space-y-4 pl-8">
            {history.map((change) => (
              <div key={change.id} className="relative">
                {/* Timeline dot */}
                <div className="absolute -left-5 top-1 h-2 w-2 rounded-full border-2 border-border bg-background" />

                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-xs font-medium rounded-full px-2 py-0.5 ${
                        CHANGE_TYPE_COLORS[change.changeType] ?? 'text-muted-foreground bg-muted'
                      }`}
                    >
                      {CHANGE_TYPE_LABELS[change.changeType] ?? change.changeType}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      v{change.version}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      by {change.author.email}
                    </span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {new Date(change.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {change.comment && (
                    <p className="text-xs text-muted-foreground italic">{change.comment}</p>
                  )}

                  {/* Show changed fields */}
                  {Object.keys(change.changes).length > 0 &&
                    change.changeType === 'UPDATE' && (
                      <div className="text-xs text-muted-foreground">
                        Changed:{' '}
                        {Object.keys(change.changes)
                          .slice(0, 3)
                          .join(', ')}
                        {Object.keys(change.changes).length > 3 && (
                          <span> +{Object.keys(change.changes).length - 3} more</span>
                        )}
                      </div>
                    )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
