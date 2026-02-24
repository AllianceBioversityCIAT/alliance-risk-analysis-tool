'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Save, ArrowLeft, Plus, Trash2 } from 'lucide-react';
import type { PromptDetail } from '@alliance-risk/shared';
import { AgentSection, AGENT_SECTION_LABELS } from '@alliance-risk/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCreatePrompt, useUpdatePrompt } from '@/hooks/use-prompts';
import { CommentSection } from './comment-section';
import { ChangeHistory } from './change-history';
import { PromptPreviewPanel } from './prompt-preview-panel';

const promptSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  section: z.nativeEnum(AgentSection, { error: 'Section is required' }),
  subSection: z.string().max(100).optional(),
  route: z.string().optional(),
  systemPrompt: z.string().min(1, 'System prompt is required'),
  userPromptTemplate: z.string().min(1, 'User prompt template is required'),
  tone: z.string().max(500).optional(),
  outputFormat: z.string().max(5000).optional(),
  isActive: z.boolean(),
});

type PromptFormValues = z.infer<typeof promptSchema>;

interface PromptEditorFormProps {
  mode: 'create' | 'edit';
  existingPrompt?: PromptDetail;
}

export function PromptEditorForm({ mode, existingPrompt }: PromptEditorFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  // Categories + tags managed as separate state (array fields)
  const [categories, setCategories] = useState<string[]>(
    existingPrompt?.categories ?? [],
  );
  const [tags, setTags] = useState<string[]>(existingPrompt?.tags ?? []);
  const [newCategory, setNewCategory] = useState('');
  const [newTag, setNewTag] = useState('');

  const createPrompt = useCreatePrompt();
  const updatePrompt = useUpdatePrompt();

  const sections = Object.values(AgentSection);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PromptFormValues>({
    resolver: zodResolver(promptSchema),
    defaultValues: {
      name: existingPrompt?.name ?? '',
      section: existingPrompt?.section,
      subSection: existingPrompt?.subSection ?? '',
      route: existingPrompt?.route ?? '',
      systemPrompt: existingPrompt?.systemPrompt ?? '',
      userPromptTemplate: existingPrompt?.userPromptTemplate ?? '',
      tone: existingPrompt?.tone ?? '',
      outputFormat: existingPrompt?.outputFormat ?? '',
      isActive: existingPrompt?.isActive ?? true,
    },
  });

  const isActive = watch('isActive');
  const systemPromptValue = watch('systemPrompt');
  const userPromptTemplateValue = watch('userPromptTemplate');

  const onSubmit = async (values: PromptFormValues) => {
    setServerError(null);
    try {
      const payload = {
        ...values,
        categories,
        tags,
      };

      if (mode === 'create') {
        await createPrompt.mutateAsync(payload);
      } else if (existingPrompt) {
        await updatePrompt.mutateAsync({ id: existingPrompt.id, payload });
      }

      router.push('/admin/prompt-manager');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to save prompt. Please try again.';
      setServerError(msg);
    }
  };

  const addCategory = () => {
    const val = newCategory.trim();
    if (val && !categories.includes(val)) {
      setCategories([...categories, val]);
    }
    setNewCategory('');
  };

  const removeCategory = (cat: string) => {
    setCategories(categories.filter((c) => c !== cat));
  };

  const addTag = () => {
    const val = newTag.trim().toLowerCase().replace(/\s+/g, '-');
    if (val && !tags.includes(val)) {
      setTags([...tags, val]);
    }
    setNewTag('');
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  return (
    <div className="flex gap-6 min-h-0">
      {/* Left: Main Form */}
      <div className="flex-1 min-w-0">
        <div className="space-y-6">
          {/* Breadcrumb header */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="gap-1.5"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-xl font-semibold">
                {mode === 'create' ? 'Create New Prompt' : `Edit: ${existingPrompt?.name}`}
              </h1>
              {existingPrompt && (
                <p className="text-xs text-muted-foreground">
                  Version {existingPrompt.version} ·{' '}
                  {existingPrompt.isActive ? 'Active' : 'Inactive'}
                </p>
              )}
            </div>
          </div>

          {serverError && (
            <div
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {serverError}
            </div>
          )}

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-5"
            noValidate
            aria-label="Prompt editor form"
          >
            {/* Basic fields */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name *</Label>
                <Input id="name" placeholder="Prompt name" {...register('name')} />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="section">Section *</Label>
                <Select
                  value={watch('section') ?? ''}
                  onValueChange={(v) => setValue('section', v as AgentSection, { shouldValidate: true })}
                >
                  <SelectTrigger id="section" aria-label="Select section">
                    <SelectValue placeholder="Choose section…" />
                  </SelectTrigger>
                  <SelectContent>
                    {sections.map((s) => (
                      <SelectItem key={s} value={s}>
                        {AGENT_SECTION_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.section && (
                  <p className="text-sm text-destructive">{errors.section.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="route">Route</Label>
                <Input id="route" placeholder="/optional-route" {...register('route')} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="subSection">Sub-Section</Label>
                <Input id="subSection" placeholder="Optional sub-section" {...register('subSection')} />
              </div>
            </div>

            <Separator />

            {/* Prompt content */}
            <div className="space-y-1.5">
              <Label htmlFor="systemPrompt">System Prompt *</Label>
              <Textarea
                id="systemPrompt"
                placeholder="You are an expert agricultural risk analyst…"
                rows={6}
                className="font-mono text-sm resize-y"
                {...register('systemPrompt')}
              />
              {errors.systemPrompt && (
                <p className="text-sm text-destructive">{errors.systemPrompt.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="userPromptTemplate">User Prompt Template *</Label>
              <Textarea
                id="userPromptTemplate"
                placeholder="Analyze the following {{category_1}} risks…"
                rows={5}
                className="font-mono text-sm resize-y"
                {...register('userPromptTemplate')}
              />
              <p className="text-xs text-muted-foreground">
                Use <code className="bg-muted px-1 rounded">{'{{category_1}}'}</code>,{' '}
                <code className="bg-muted px-1 rounded">{'{{categories}}'}</code> as placeholders.
              </p>
              {errors.userPromptTemplate && (
                <p className="text-sm text-destructive">{errors.userPromptTemplate.message}</p>
              )}
            </div>

            <Separator />

            {/* Categories */}
            <div className="space-y-2">
              <Label>Categories</Label>
              <div className="flex flex-wrap gap-1.5">
                {categories.map((cat) => (
                  <Badge key={cat} variant="secondary" className="gap-1 text-xs">
                    {cat}
                    <button
                      type="button"
                      onClick={() => removeCategory(cat)}
                      aria-label={`Remove category ${cat}`}
                      className="ml-0.5 opacity-60 hover:opacity-100"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add category…"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCategory();
                    }
                  }}
                  className="h-8 text-sm"
                  aria-label="New category"
                />
                <Button type="button" size="sm" variant="outline" onClick={addCategory}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <span key={tag} className="flex items-center gap-1 text-xs bg-muted px-2 py-0.5 rounded">
                    #{tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      aria-label={`Remove tag ${tag}`}
                      className="opacity-60 hover:opacity-100"
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add tag…"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  className="h-8 text-sm"
                  aria-label="New tag"
                />
                <Button type="button" size="sm" variant="outline" onClick={addTag}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <Separator />

            {/* Optional fields */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="tone">Tone</Label>
                <Input
                  id="tone"
                  placeholder="Professional and informative"
                  {...register('tone')}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="outputFormat">Output Format</Label>
                <Textarea
                  id="outputFormat"
                  placeholder="Clear and structured response…"
                  rows={3}
                  {...register('outputFormat')}
                />
              </div>
            </div>

            {/* Active toggle + submit */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-3">
                <Switch
                  id="isActive"
                  checked={isActive}
                  onCheckedChange={(v) => setValue('isActive', v)}
                />
                <Label htmlFor="isActive" className="cursor-pointer">
                  {isActive ? 'Active' : 'Inactive'}
                </Label>
              </div>

              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {mode === 'create' ? 'Create Prompt' : 'Save Changes'}
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Right: Side Panel */}
      <div className="w-80 shrink-0">
        <div className="sticky top-6 rounded-lg border bg-card p-4">
          <Tabs defaultValue="preview">
            <TabsList className="w-full">
              <TabsTrigger value="preview" className="flex-1 text-xs">
                Preview
              </TabsTrigger>
              {mode === 'edit' && (
                <>
                  <TabsTrigger value="comments" className="flex-1 text-xs">
                    Comments
                  </TabsTrigger>
                  <TabsTrigger value="history" className="flex-1 text-xs">
                    History
                  </TabsTrigger>
                </>
              )}
            </TabsList>

            <TabsContent value="preview" className="mt-4">
              <PromptPreviewPanel
                systemPrompt={systemPromptValue}
                userPromptTemplate={userPromptTemplateValue}
              />
            </TabsContent>

            {mode === 'edit' && existingPrompt && (
              <>
                <TabsContent value="comments" className="mt-4">
                  <CommentSection promptId={existingPrompt.id} />
                </TabsContent>
                <TabsContent value="history" className="mt-4">
                  <ChangeHistory promptId={existingPrompt.id} />
                </TabsContent>
              </>
            )}
          </Tabs>
        </div>
      </div>
    </div>
  );
}
