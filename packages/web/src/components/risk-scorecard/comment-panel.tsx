'use client';

import { useState } from 'react';
import { X, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AvatarInitials } from '@/components/shared/avatar-initials';
import { cn } from '@/lib/utils';
import type { AssessmentCommentResponse } from '@alliance-risk/shared';

interface CommentPanelProps {
  comments: AssessmentCommentResponse[];
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (content: string) => Promise<void>;
  isSubmitting?: boolean;
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function CommentPanel({
  comments,
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
}: CommentPanelProps) {
  const [newComment, setNewComment] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim()) return;
    await onSubmit(newComment.trim());
    setNewComment('');
  }

  return (
    <div
      className={cn(
        'fixed right-0 top-0 h-full w-80 bg-white border-l border-border shadow-xl flex flex-col z-50 transition-transform duration-300',
        isOpen ? 'translate-x-0' : 'translate-x-full',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
        <h2 className="text-base font-semibold text-foreground">Comments</h2>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
          <span className="sr-only">Close comments</span>
        </Button>
      </div>

      {/* Comment list */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No comments yet. Be the first to comment.
          </p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="flex items-start gap-3">
              <AvatarInitials name={comment.userEmail} size="sm" className="shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold text-foreground truncate">
                    {comment.userEmail.split('@')[0]}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatRelativeTime(comment.createdAt)}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-foreground leading-relaxed">{comment.content}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* New comment form */}
      <form onSubmit={handleSubmit} className="border-t border-border p-4 shrink-0 space-y-2">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          rows={3}
          disabled={isSubmitting}
          className="w-full text-sm bg-background border border-input rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground disabled:opacity-60"
        />
        <Button
          type="submit"
          className="w-full gap-1.5"
          disabled={!newComment.trim() || isSubmitting}
        >
          <Send className="h-3.5 w-3.5" />
          Send
        </Button>
      </form>
    </div>
  );
}
