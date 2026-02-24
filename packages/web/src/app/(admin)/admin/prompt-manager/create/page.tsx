'use client';

import { PromptEditorForm } from '@/components/prompts/prompt-editor-form';

export default function CreatePromptPage() {
  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <PromptEditorForm mode="create" />
    </div>
  );
}
