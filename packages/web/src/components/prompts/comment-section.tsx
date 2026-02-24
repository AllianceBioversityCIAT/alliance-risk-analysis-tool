'use client';

import { useState } from 'react';
import { MessageSquare, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { usePromptComments, useAddComment } from '@/hooks/use-prompts';
import type { ThreadedComment } from '@/hooks/use-prompts';

function CommentItem({ comment }: { comment: ThreadedComment }) {
  return (
    <div className="space-y-2">
      <div className="rounded-lg border bg-muted/20 px-3 py-2.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium">{comment.author.email}</span>
          <span className="text-xs text-muted-foreground">
            {new Date(comment.createdAt).toLocaleDateString()}
          </span>
        </div>
        <p className="text-sm">{comment.content}</p>
      </div>
      {comment.replies.length > 0 && (
        <div className="ml-4 space-y-2">
          {comment.replies.map((reply) => (
            <div key={reply.id} className="rounded-lg border bg-background px-3 py-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium">{reply.author.email}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(reply.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p className="text-sm">{reply.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface CommentSectionProps {
  promptId: string;
}

export function CommentSection({ promptId }: CommentSectionProps) {
  const [newComment, setNewComment] = useState('');
  const { data: comments, isLoading } = usePromptComments(promptId);
  const addComment = useAddComment();

  const handleSubmit = async () => {
    if (!newComment.trim()) return;
    await addComment.mutateAsync({ promptId, content: newComment.trim() });
    setNewComment('');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <MessageSquare className="h-4 w-4" />
        Comments
        {comments && (
          <span className="text-xs text-muted-foreground">({comments.length})</span>
        )}
      </div>

      {/* Comment input */}
      <div className="space-y-2">
        <Textarea
          placeholder="Add a comment…"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          rows={2}
          className="resize-none text-sm"
        />
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!newComment.trim() || addComment.isPending}
        >
          {addComment.isPending ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="mr-2 h-3.5 w-3.5" />
          )}
          Post Comment
        </Button>
      </div>

      {/* Comment list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-lg border px-3 py-2.5 space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      ) : !comments || comments.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No comments yet.</p>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} />
          ))}
        </div>
      )}
    </div>
  );
}
