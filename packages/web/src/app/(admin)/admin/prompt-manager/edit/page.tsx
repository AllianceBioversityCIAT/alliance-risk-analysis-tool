'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { PromptEditorForm } from '@/components/prompts/prompt-editor-form';
import { usePrompt } from '@/hooks/use-prompts';
import { useEffect } from 'react';

export default function EditPromptPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const router = useRouter();
  const { data: prompt, isLoading, isError } = usePrompt(id ?? '');

  useEffect(() => {
    if (!id || isError) {
      router.push('/admin/prompt-manager');
    }
  }, [id, isError, router]);

  if (!id || isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!prompt) return null;

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <PromptEditorForm mode="edit" existingPrompt={prompt} />
    </div>
  );
}
