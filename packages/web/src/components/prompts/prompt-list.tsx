'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import type { PromptSummary } from '@alliance-risk/shared';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { usePrompts, useToggleActive, useDeletePrompt } from '@/hooks/use-prompts';
import type { PromptFilters } from '@/hooks/use-prompts';
import { PromptFiltersBar } from './prompt-filters';
import { PromptCard } from './prompt-card';

const PAGE_SIZE = 12;

export function PromptList() {
  const router = useRouter();
  const [filters, setFilters] = useState<PromptFilters>({});
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<PromptSummary | null>(null);

  const { data, isLoading, isError } = usePrompts(filters, page, PAGE_SIZE);
  const toggleActive = useToggleActive();
  const deletePrompt = useDeletePrompt();

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  const handleFiltersChange = useCallback((f: PromptFilters) => {
    setFilters(f);
    setPage(1);
  }, []);

  const handleEdit = useCallback(
    (prompt: PromptSummary) => {
      router.push(`/admin/prompt-manager/edit/${prompt.id}`);
    },
    [router],
  );

  const handleToggle = useCallback(
    async (prompt: PromptSummary) => {
      await toggleActive.mutateAsync(prompt.id);
    },
    [toggleActive],
  );

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    await deletePrompt.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Prompt Manager</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage AI prompts for each agent section
          </p>
        </div>
        <Button onClick={() => router.push('/admin/prompt-manager/create')}>
          <Plus className="mr-2 h-4 w-4" />
          Create New Prompt
        </Button>
      </div>

      {/* Filters */}
      <PromptFiltersBar filters={filters} onFiltersChange={handleFiltersChange} />

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="prompt-loading-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-lg border p-4 space-y-3" data-testid="prompt-skeleton">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-14 rounded-full" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-lg border bg-destructive/5 py-10 text-center text-sm text-destructive">
          Failed to load prompts. Please try again.
        </div>
      ) : !data || data.prompts.length === 0 ? (
        <div className="rounded-lg border py-16 text-center">
          <p className="text-sm text-muted-foreground">No prompts found.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => router.push('/admin/prompt-manager/create')}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create your first prompt
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="prompt-grid">
            {data.prompts.map((prompt) => (
              <PromptCard
                key={prompt.id}
                prompt={prompt}
                onEdit={handleEdit}
                onToggle={handleToggle}
                onDelete={setDeleteTarget}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Showing {(page - 1) * PAGE_SIZE + 1}–
                {Math.min(page * PAGE_SIZE, data.total)} of {data.total} prompts
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: totalPages }).map((_, i) => (
                  <Button
                    key={i}
                    variant={i + 1 === page ? 'default' : 'outline'}
                    size="icon"
                    className="h-8 w-8 text-xs"
                    onClick={() => setPage(i + 1)}
                    aria-label={`Page ${i + 1}`}
                    aria-current={i + 1 === page ? 'page' : undefined}
                  >
                    {i + 1}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Prompt</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete{' '}
            <span className="font-medium text-foreground">{deleteTarget?.name}</span>? All
            versions and comments will be permanently removed.
          </p>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deletePrompt.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deletePrompt.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
